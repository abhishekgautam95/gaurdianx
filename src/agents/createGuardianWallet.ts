import {
  CreateGuardianWalletOptions,
  CreateGuardianWalletPolicyInput,
  GuardianProtectedExecutionResult,
  GuardianWalletClient,
  TransactionAnalysisResult,
  TransactionPayload,
  ViemOrEthersWalletClient,
  WalletSendTransactionParameters,
  WalletWriteContractParameters,
} from '../types/index.js';
import { AgentGuardrailMiddleware } from './guardrailMiddleware.js';
import { TransactionAnalyzer } from '../core/transactionAnalyzer.js';
import { defaultGuardianXConfig } from '../core/config.js';
import { BuiltInInvariants } from '../core/invariantEngine.js';

/**
 * Maps common contract function names to their canonical 4-byte EVM selectors
 * when raw calldata is not explicitly pre-encoded on `writeContract`.
 */
const FUNCTION_NAME_TO_SELECTOR: Record<string, string> = {
  swapExactTokensForTokens: '0x38ed1739',
  swapExactETHForTokens: '0x7ff36ab5',
  exactInputSingle: '0x04e45aaf',
  transfer: '0xa9059cbb',
  transferFrom: '0x23b872dd',
  approve: '0x095ea7b3',
  stake: '0xa694fc3a',
  deposit: '0xb6b55f25',
  propose: '0xda95691a',
  castVote: '0x56781388',
  transferOwnership: '0xf2fde38b',
  upgradeTo: '0x3659cfe6',
  upgradeToAndCall: '0x4f1ef286',
  drainAll: '0x853828b6',
  emergencyWithdraw: '0x441a3e70',
};

export class GuardianFirewallBlockedError extends Error {
  public readonly agentId: string;
  public readonly reasons: string[];

  constructor(agentId: string, reasons: string[]) {
    super(`[GuardianX Agent Firewall Blocked (${agentId})]: ${reasons.join(' | ')}`);
    this.name = 'GuardianFirewallBlockedError';
    this.agentId = agentId;
    this.reasons = reasons;
  }
}

/**
 * Drop-in AI Agent Wallet Wrapper for Viem (`WalletClient`) and Ethers (`Signer` / Wallet).
 *
 * Intercepts `sendTransaction` and `writeContract` calls to enforce:
 * 1. `AgentGuardrailMiddleware` (Semantic Intent Verification + Deterministic Hard Caps).
 * 2. Local Ephemeral Fork Simulation & Invariant checks via `TransactionAnalyzer` before broadcasting.
 */
export function createGuardianWallet<TClient extends ViemOrEthersWalletClient>(
  config: CreateGuardianWalletPolicyInput<TClient>
): GuardianWalletClient<TClient>;
export function createGuardianWallet<TClient extends ViemOrEthersWalletClient>(
  walletClient: TClient,
  options: CreateGuardianWalletOptions
): GuardianWalletClient<TClient>;
export function createGuardianWallet<TClient extends ViemOrEthersWalletClient>(
  clientOrConfig: TClient | CreateGuardianWalletPolicyInput<TClient>,
  maybeOptions?: CreateGuardianWalletOptions
): GuardianWalletClient<TClient> {
  const isPolicyInput = (
    input: TClient | CreateGuardianWalletPolicyInput<TClient>
  ): input is CreateGuardianWalletPolicyInput<TClient> => {
    return typeof input === 'object' && input !== null && 'client' in input && 'policy' in input;
  };

  const walletClient: TClient = isPolicyInput(clientOrConfig)
    ? clientOrConfig.client
    : clientOrConfig;

  const options: CreateGuardianWalletOptions = isPolicyInput(clientOrConfig)
    ? {
        agentId: clientOrConfig.agentId ?? 'guardianx-agent',
        chain: clientOrConfig.chain,
        chainId: clientOrConfig.chainId,
        rpcUrl: clientOrConfig.rpcUrl,
        hardCaps: {
          maxSlippageBps: clientOrConfig.policy.maxSlippageBps,
          maxGasBurnWei: clientOrConfig.policy.maxGasBurnWei ?? 50000000000000000n,
          maxTransferValueWei: clientOrConfig.policy.maxDailySpendWei ?? 1000000000000000000n,
          allowedContractWhitelist: clientOrConfig.policy.allowedContracts,
          blockedSelectors: clientOrConfig.policy.blockedSelectors,
        },
        invariants: clientOrConfig.invariants,
        defaultIntentObjective: clientOrConfig.defaultIntentObjective,
        runLocalSimulation: clientOrConfig.runLocalSimulation,
        maxAllowedRiskScore: clientOrConfig.maxAllowedRiskScore,
      }
    : maybeOptions!;
  const middleware = new AgentGuardrailMiddleware(options.hardCaps);
  const runLocalSimulation = options.runLocalSimulation ?? true;
  const maxAllowedRiskScore = options.maxAllowedRiskScore ?? 70;
  const chain = options.chain ?? 'ethereum';

  const resolveFromAddress = (): string => {
    if (!walletClient.account) {
      return '0xAgentDefaultWallet000000000000000000000001';
    }
    if (typeof walletClient.account === 'string') {
      return walletClient.account;
    }
    return walletClient.account.address;
  };

  const verifyAndSimulate = async (params: {
    to: string;
    data: string;
    value: bigint;
    gasLimit?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    nonce?: number;
    toolName: string;
    intentObjective: string;
    estimatedSlippageBps?: number;
  }): Promise<{
    guardrailDecision: GuardianProtectedExecutionResult['guardrailDecision'];
    simulationAnalysis?: TransactionAnalysisResult;
  }> => {
    const txPayload: TransactionPayload = {
      chain,
      from: resolveFromAddress(),
      to: params.to,
      value: params.value,
      data: params.data,
      gasLimit: params.gasLimit,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      nonce: params.nonce,
    };

    // Step 1: Run AI Agent Guardrail Middleware (Semantic Intent + Deterministic Hard Caps)
    const guardrailDecision = middleware.verifyAgentToolCall({
      agentId: options.agentId,
      naturalLanguageObjective: params.intentObjective,
      toolName: params.toolName,
      tx: txPayload,
      estimatedSlippageBps: params.estimatedSlippageBps,
    });

    if (!guardrailDecision.allowed) {
      const reasons: string[] = [];
      if (!guardrailDecision.semanticVerification.matched || guardrailDecision.semanticVerification.promptInjectionDetected) {
        reasons.push(guardrailDecision.semanticVerification.reason);
      }
      reasons.push(...guardrailDecision.hardCapViolations);
      throw new GuardianFirewallBlockedError(options.agentId, reasons);
    }

    // Step 2: Run Local Fork Invariant Simulation before signing/broadcasting
    let simulationAnalysis: TransactionAnalysisResult | undefined;
    if (runLocalSimulation) {
      const invariants = options.invariants ?? [
        BuiltInInvariants.maxBalanceDrainPercentage(params.to, 15, 'critical'),
      ];

      const analyzer = new TransactionAnalyzer({
        ...defaultGuardianXConfig,
        network: {
          ...defaultGuardianXConfig.network,
          chain,
          chainId: options.chainId ?? walletClient.chain?.id ?? 1,
          rpcUrl: options.rpcUrl ?? defaultGuardianXConfig.network.rpcUrl,
        },
        invariants,
      });

      simulationAnalysis = await analyzer.analyze(txPayload);

      if (
        simulationAnalysis.proofOfExploit?.exploitConfirmed ||
        simulationAnalysis.riskScore > maxAllowedRiskScore ||
        simulationAnalysis.invariantViolations.length > 0
      ) {
        const simReasons = [
          `Local fork simulation blocked transaction (Risk Score: ${simulationAnalysis.riskScore}/100, Verdict: ${simulationAnalysis.verdict})`,
          ...simulationAnalysis.invariantViolations.map((v) => v.description),
        ];
        throw new GuardianFirewallBlockedError(options.agentId, simReasons);
      }
    }

    return { guardrailDecision, simulationAnalysis };
  };

  const sendTransactionWithReport = async (
    args: WalletSendTransactionParameters
  ): Promise<GuardianProtectedExecutionResult> => {
    const data = args.data ?? '0x';
    const value = args.value ?? 0n;
    const gasLimit = args.gas ?? args.gasLimit;
    const intentObjective =
      args.intentObjective ?? options.defaultIntentObjective ?? 'Send native transfer';

    const { guardrailDecision, simulationAnalysis } = await verifyAndSimulate({
      to: args.to,
      data,
      value,
      gasLimit,
      maxFeePerGas: args.maxFeePerGas,
      maxPriorityFeePerGas: args.maxPriorityFeePerGas,
      nonce: args.nonce,
      toolName: 'sendTransaction',
      intentObjective,
      estimatedSlippageBps: args.estimatedSlippageBps,
    });

    const txHash = await walletClient.sendTransaction(args);
    return {
      txHash,
      guardrailDecision,
      simulationAnalysis,
    };
  };

  const writeContractWithReport = async (
    args: WalletWriteContractParameters
  ): Promise<GuardianProtectedExecutionResult> => {
    const inferredSelector = FUNCTION_NAME_TO_SELECTOR[args.functionName] ?? '0x00000000';
    const data = args.data ?? `${inferredSelector}${'0'.repeat(64)}`;
    const value = args.value ?? 0n;
    const gasLimit = args.gas ?? args.gasLimit;
    const intentObjective =
      args.intentObjective ??
      options.defaultIntentObjective ??
      `Execute ${args.functionName} on contract ${args.address}`;

    const { guardrailDecision, simulationAnalysis } = await verifyAndSimulate({
      to: args.address,
      data,
      value,
      gasLimit,
      maxFeePerGas: args.maxFeePerGas,
      maxPriorityFeePerGas: args.maxPriorityFeePerGas,
      toolName: args.functionName,
      intentObjective,
      estimatedSlippageBps: args.estimatedSlippageBps,
    });

    const txHash = walletClient.writeContract
      ? await walletClient.writeContract(args)
      : await walletClient.sendTransaction({
          to: args.address,
          data,
          value,
          gas: gasLimit,
          maxFeePerGas: args.maxFeePerGas,
          maxPriorityFeePerGas: args.maxPriorityFeePerGas,
        });

    return {
      txHash,
      guardrailDecision,
      simulationAnalysis,
    };
  };

  return {
    rawClient: walletClient,
    agentId: options.agentId,
    sendTransaction: async (args: WalletSendTransactionParameters): Promise<string> => {
      const res = await sendTransactionWithReport(args);
      return res.txHash;
    },
    writeContract: async (args: WalletWriteContractParameters): Promise<string> => {
      const res = await writeContractWithReport(args);
      return res.txHash;
    },
    sendTransactionWithReport,
    writeContractWithReport,
  };
}
