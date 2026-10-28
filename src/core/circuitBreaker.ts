import {
  EmergencyActionType,
  EmergencyCallbackContext,
  EmergencyTransaction,
  GuardianXConfig,
  IKeySigner,
  MitigationExecutionReceipt,
  RiskTier,
} from '../types/index.js';
import { PrivateRelayClient } from '../relays/privateRelay.js';

/**
 * Phase 2 & Milestone 1: Autonomous Circuit Breaker & Active Mitigation Engine.
 *
 * Consumes `IKeySigner` (via `PrivateRelayClient` or direct injection) to sign emergency payloads
 * or create EIP-712 Safe multisig proposals without ever handling raw private keys in memory.
 */
export class ActiveMitigationEngine {
  private readonly relayClient: PrivateRelayClient;
  private readonly config: GuardianXConfig['circuitBreaker'];
  private readonly callbacks?: GuardianXConfig['callbacks'];
  private readonly signer?: IKeySigner;

  constructor(
    relayClient: PrivateRelayClient,
    config: GuardianXConfig['circuitBreaker'],
    callbacks?: GuardianXConfig['callbacks'],
    signer?: IKeySigner
  ) {
    this.relayClient = relayClient;
    this.config = config;
    this.callbacks = callbacks;
    this.signer = signer ?? relayClient.getSigner();
  }

  public getSigner(): IKeySigner | undefined {
    return this.signer;
  }

  /**
   * Executes the appropriate mitigation response for the evaluated risk tier.
   */
  public async executeMitigation(
    tier: RiskTier,
    targetContract: string,
    targetBlockNumber: number,
    callbackContext?: EmergencyCallbackContext
  ): Promise<MitigationExecutionReceipt> {
    const timestamp = new Date().toISOString();
    const logs: string[] = [];

    if (!this.config.enabled) {
      logs.push('[CircuitBreaker] Active mitigation disabled in configuration; logging only.');
      return {
        triggered: false,
        tier,
        actionsTaken: [],
        logs,
        timestamp,
      };
    }

    if (this.signer) {
      const signerAddr = await this.signer.getAddress();
      logs.push(`[Signer:${this.signer.signerType}] Authenticated mitigation authority ${signerAddr}.`);
    }

    // Tier 1: Log & Soft Alert
    if (tier === RiskTier.LEVEL_1_SOFT_ALERT) {
      logs.push(`[Tier 1: Soft Alert] Anomaly recorded for contract ${targetContract} at block ${targetBlockNumber}.`);
      if (callbackContext && this.callbacks?.onSoftAlert) {
        await this.callbacks.onSoftAlert(callbackContext);
      }
      return {
        triggered: true,
        tier: RiskTier.LEVEL_1_SOFT_ALERT,
        actionsTaken: [],
        logs,
        timestamp,
      };
    }

    // Tier 2: Parameter Throttling
    if (tier === RiskTier.LEVEL_2_THROTTLE) {
      const throttleTx = this.relayClient.buildEmergencyTransaction({
        action: 'throttleParameters',
        targetContract,
        priorityFeeGwei: this.config.maxPriorityFeeGwei,
      });

      if (this.signer && !this.relayClient.getSigner()) {
        await this.signer.signTransaction({
          to: throttleTx.targetContract,
          data: throttleTx.calldata,
          value: throttleTx.value,
          gasLimit: throttleTx.gasLimit,
          maxFeePerGas: throttleTx.maxFeePerGas,
          maxPriorityFeePerGas: throttleTx.maxPriorityFeePerGas,
        });
      }

      const bundleResponse = await this.relayClient.submitFrontrunRescueBundle({
        targetBlockNumber,
        emergencyTransactions: [throttleTx],
        exploiterTxHash: callbackContext?.analysis.txHash,
      });

      const throttledParams = {
        maxWithdrawalBps: 1000,
        cooldownSeconds: 3600,
        bundleHash: bundleResponse.bundleHash,
      };

      logs.push(
        `[Tier 2: Parameter Throttling] Dispatched throttleParameters() bundle (${bundleResponse.bundleHash}) for ${targetContract}.`
      );

      if (callbackContext && this.callbacks?.onThrottle) {
        await this.callbacks.onThrottle(callbackContext);
      }

      return {
        triggered: true,
        tier: RiskTier.LEVEL_2_THROTTLE,
        actionsTaken: ['throttleParameters'],
        bundleResponse,
        throttledParams,
        logs,
        timestamp,
      };
    }

    // Tier 3: Immediate Automated Contract Pause / Vault Freeze / Fund Sweep via Private Relay
    const emergencyTxs: EmergencyTransaction[] = [];
    const actionsTaken: EmergencyActionType[] = [];

    if (this.config.autoPauseOnTier3) {
      emergencyTxs.push(
        this.relayClient.buildEmergencyTransaction({
          action: 'pause',
          targetContract,
          priorityFeeGwei: this.config.maxPriorityFeeGwei,
        }),
        this.relayClient.buildEmergencyTransaction({
          action: 'freezeVault',
          targetContract,
          priorityFeeGwei: this.config.maxPriorityFeeGwei,
        })
      );
      actionsTaken.push('pause', 'freezeVault');
    }

    if (this.config.autoSweepOnTier3 && this.config.safeVaultAddress) {
      emergencyTxs.push(
        this.relayClient.buildEmergencyTransaction({
          action: 'sweepToSafe',
          targetContract,
          safeAddress: this.config.safeVaultAddress,
          priorityFeeGwei: this.config.maxPriorityFeeGwei,
        })
      );
      actionsTaken.push('sweepToSafe');
    }

    if (this.signer && !this.relayClient.getSigner()) {
      for (const tx of emergencyTxs) {
        await this.signer.signTransaction({
          to: tx.targetContract,
          data: tx.calldata,
          value: tx.value,
          gasLimit: tx.gasLimit,
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        });
      }
    }

    const bundleResponse = await this.relayClient.submitFrontrunRescueBundle({
      targetBlockNumber,
      emergencyTransactions: emergencyTxs,
      exploiterTxHash: callbackContext?.analysis.txHash,
    });

    logs.push(
      `[Tier 3: Autonomous Circuit Breaker] Front-run MEV rescue bundle (${bundleResponse.bundleHash}) broadcast via ${bundleResponse.relayName} for block ${targetBlockNumber}.`,
      `[Tier 3: Actions Executed] ${actionsTaken.join(', ')} on ${targetContract}.`
    );

    const receipt: MitigationExecutionReceipt = {
      triggered: true,
      tier: RiskTier.LEVEL_3_CIRCUIT_BREAKER,
      actionsTaken,
      bundleResponse,
      logs,
      timestamp,
    };

    if (callbackContext && this.callbacks?.onCircuitBreaker) {
      await this.callbacks.onCircuitBreaker(callbackContext, receipt);
    }

    return receipt;
  }
}
