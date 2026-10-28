/**
 * GuardianX Core Types & Declarative Configuration Schema
 * @module src/types
 */

export type SupportedChain = 'ethereum' | 'arbitrum' | 'optimism' | 'base' | 'avalanche' | 'polygon' | 'solana';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Configurable risk tiers for the Autonomous Circuit Breaker
 * - Level 1: Log & Soft Alert
 * - Level 2: Parameter Throttling
 * - Level 3: Immediate Automated Contract Pause / Fund Sweep
 */
export enum RiskTier {
  LEVEL_1_SOFT_ALERT = 1,
  LEVEL_2_THROTTLE = 2,
  LEVEL_3_CIRCUIT_BREAKER = 3,
}

export interface TransactionPayload {
  chain: SupportedChain;
  txHash?: string;
  from: string;
  to: string;
  value: bigint;
  data: string;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  blockNumber?: number;
}

export interface ChainStateSnapshot {
  blockNumber: number;
  timestamp: number;
  balances: Record<string, bigint>;
  tokenBalances: Record<string, Record<string, bigint>>;
  storageSlots: Record<string, Record<string, string>>;
  contractVerified: Record<string, boolean>;
  protocolLiquidity: Record<string, bigint>;
  pausedContracts: Record<string, boolean>;
}

export interface InvariantContext {
  tx: TransactionPayload;
  preState: ChainStateSnapshot;
  postState: ChainStateSnapshot;
}

export interface InvariantViolation {
  ruleId: string;
  description: string;
  severity: RiskSeverity;
  recommendedTier: RiskTier;
  metadata?: Record<string, unknown>;
}

export interface InvariantRule {
  id: string;
  description: string;
  severity: RiskSeverity;
  recommendedTier?: RiskTier;
  evaluate: (ctx: InvariantContext) => boolean | Promise<boolean>;
}

export interface RiskFlag {
  type: string;
  severity: RiskSeverity;
  message: string;
  ruleId?: string;
}

export interface TransactionAnalysisResult {
  riskScore: number;
  verdict: 'Safe' | 'Medium Risk' | 'High Risk' | 'Critical Threat';
  riskTier: RiskTier;
  explanation: string;
  flags: RiskFlag[];
  invariantViolations: InvariantViolation[];
  chain: SupportedChain;
  txHash: string;
  timestamp: string;
  proofOfExploit?: ProofOfExploitReport;
  mitigationReceipt?: MitigationExecutionReceipt;
}

/**
 * Phase 2: Active Mitigation & Private Relay Types
 */
export type EmergencyActionType = 'pause' | 'freezeVault' | 'sweepToSafe' | 'throttleParameters';

export interface EmergencyTransaction {
  action: EmergencyActionType;
  targetContract: string;
  calldata: string;
  value: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
}

export interface FlashbotsBundleTransaction {
  signedTransaction?: string;
  transaction?: EmergencyTransaction;
  canRevert?: boolean;
}

export interface PrivateRelayBundleRequest {
  relayName: 'flashbots' | 'eden' | 'mev-blocker' | 'custom';
  relayUrl: string;
  targetBlockNumber: number;
  transactions: FlashbotsBundleTransaction[];
  minTimestamp?: number;
  maxTimestamp?: number;
  revertingTxHashes?: string[];
}

export interface PrivateRelayBundleResponse {
  bundleHash: string;
  relayName: string;
  targetBlockNumber: number;
  simulatedSuccess: boolean;
  effectiveGasPriceGwei: number;
  frontrunGuaranteed: boolean;
  timestamp: string;
}

export interface MitigationExecutionReceipt {
  triggered: boolean;
  tier: RiskTier;
  actionsTaken: EmergencyActionType[];
  bundleResponse?: PrivateRelayBundleResponse;
  throttledParams?: Record<string, string | number>;
  logs: string[];
  timestamp: string;
}

/**
 * Phase 3: AI Agent Runtime Guardrail Middleware Types
 */
export interface AgentToolCallRequest {
  agentId: string;
  naturalLanguageObjective: string;
  toolName: string;
  tx: TransactionPayload;
  estimatedSlippageBps?: number;
}

export interface DeterministicHardCaps {
  /** Maximum allowed slippage in basis points (e.g. 100 = 1.00%) */
  maxSlippageBps: number;
  /** Maximum gas burn ceiling in wei */
  maxGasBurnWei: bigint;
  /** Maximum per-transaction native or token transfer limit in wei */
  maxTransferValueWei: bigint;
  /** Explicit list of allowed destination contract addresses (lowercase normalized) */
  allowedContractWhitelist: string[];
  /** Explicit list of blocked function selectors (e.g. unlimited approve or ownership transfer) */
  blockedSelectors?: string[];
}

export interface SemanticIntentVerificationResult {
  matched: boolean;
  confidence: number;
  decodedSelector: string;
  decodedFunctionName: string;
  inferredIntentCategory: 'swap' | 'transfer' | 'approve' | 'stake' | 'governance' | 'admin_mutation' | 'unknown';
  statedIntentCategory: 'swap' | 'transfer' | 'approve' | 'stake' | 'governance' | 'admin_mutation' | 'unknown';
  promptInjectionDetected: boolean;
  reason: string;
}

export interface GuardrailDecision {
  allowed: boolean;
  agentId: string;
  semanticVerification: SemanticIntentVerificationResult;
  hardCapViolations: string[];
  timestamp: string;
}

/**
 * Phase 4: Proof-of-Exploit (PoE) & Local Fork Simulation Types
 */
export interface ForkSimulationConfig {
  rpcUrl: string;
  forkBlockNumber: number;
  chainId: number;
  simulatorBackend?: 'anvil' | 'hardhat' | 'evm-memory-fork';
}

export interface BalanceDelta {
  address: string;
  asset: string;
  preBalance: bigint;
  postBalance: bigint;
  delta: bigint;
}

export interface ProofOfExploitReport {
  exploitConfirmed: boolean;
  forkBlockNumber: number;
  chainId: number;
  attackerAddress: string;
  targetContract: string;
  totalValueDrainedWei: bigint;
  balanceDeltas: BalanceDelta[];
  violatedInvariants: string[];
  gasUsed: bigint;
  reproducibleFoundryTestSolidity: string;
  foundryTestFileName: string;
  timestamp: string;
}

/**
 * Phase 5: Declarative Config Schema (`guardianx.config.ts`)
 */
export interface MonitoredContractConfig {
  name: string;
  address: string;
  chain: SupportedChain;
  safeTreasuryAddress?: string;
  abiSelectors?: Record<string, string>;
}

export interface EmergencyCallbackContext {
  violation: InvariantViolation;
  analysis: TransactionAnalysisResult;
  proofOfExploit?: ProofOfExploitReport;
}

export interface GuardianXConfig {
  projectName: string;
  network: {
    chain: SupportedChain;
    rpcUrl: string;
    chainId: number;
    privateRelayUrl?: string;
    relayProvider?: 'flashbots' | 'eden' | 'mev-blocker';
  };
  contracts: MonitoredContractConfig[];
  invariants: InvariantRule[];
  agentGuardrails: DeterministicHardCaps;
  circuitBreaker: {
    enabled: boolean;
    autoPauseOnTier3: boolean;
    autoSweepOnTier3: boolean;
    safeVaultAddress: string;
    maxPriorityFeeGwei: number;
  };
  callbacks?: {
    onSoftAlert?: (ctx: EmergencyCallbackContext) => void | Promise<void>;
    onThrottle?: (ctx: EmergencyCallbackContext) => void | Promise<void>;
    onCircuitBreaker?: (ctx: EmergencyCallbackContext, receipt: MitigationExecutionReceipt) => void | Promise<void>;
  };
}

/**
 * Milestone 1: Production Signer & Key Management Abstraction (KMS / Safe Multisig / Local)
 */
export interface TransactionRequest {
  to: string;
  data: string;
  value?: bigint;
  nonce?: number;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  chainId?: number;
}

export interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
}

export interface TypedDataField {
  name: string;
  type: string;
}

export type TypedDataTypes = Record<string, TypedDataField[]>;

export interface IKeySigner {
  readonly signerType: 'local' | 'kms' | 'multisig-safe';
  getAddress(): Promise<string>;
  signTransaction(tx: TransactionRequest): Promise<string>;
  signTypedData(
    domain: TypedDataDomain,
    types: TypedDataTypes,
    value: Record<string, unknown>
  ): Promise<string>;
}

export interface SafeTransactionProposal {
  safeAddress: string;
  chainId: number;
  to: string;
  value: string;
  data: string;
  operation: 0 | 1; // 0 = Call, 1 = DelegateCall
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
  safeTxHash: string;
  proposerAddress: string;
  eip712Signature: string;
  timestamp: string;
}

/**
 * Milestone 2: Resilient Multi-RPC Fallback & Mempool Stream Types
 */
export interface RpcEndpointConfig {
  name: string;
  httpUrl: string;
  wsUrl?: string;
  priority: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface RpcHealthMetrics {
  name: string;
  httpUrl: string;
  healthy: boolean;
  latencyMs: number;
  consecutiveFailures: number;
  score: number;
  lastCheckedAt: string;
}

export interface MempoolBlockHeader {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  baseFeePerGasWei?: bigint;
}

export interface MempoolStreamEvent {
  type: 'newHeads' | 'pendingTransactions';
  blockHeader?: MempoolBlockHeader;
  pendingTxHash?: string;
  pendingTx?: TransactionPayload;
  receivedAt: number;
}

/**
 * Milestone 3: Historical Mock Attack Scenario Types
 */
export type AttackScenarioId =
  | 'euler-flashloan-2023'
  | 'curve-readonly-reentrancy-2023'
  | 'proxy-ownership-hijack';

export interface HistoricalAttackScenario {
  id: AttackScenarioId;
  title: string;
  protocol: string;
  date: string;
  historicalLossUsd: string;
  summary: string;
  attackCategory: 'Flash Loan Manipulation' | 'Read-Only Reentrancy' | 'Access Control / Proxy Hijack';
  txPayload: TransactionPayload;
  preState: ChainStateSnapshot;
  invariants: InvariantRule[];
}

export interface AttackReplayVerificationResult {
  scenario: HistoricalAttackScenario;
  analysis: TransactionAnalysisResult;
  preVaultBalanceEth: string;
  postVaultBalanceWithoutGuardianEth: string;
  postVaultBalanceWithGuardianEth: string;
  rescuedValueWei: bigint;
}
