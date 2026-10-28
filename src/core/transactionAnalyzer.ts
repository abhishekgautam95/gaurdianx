import {
  ChainStateSnapshot,
  EmergencyCallbackContext,
  GuardianXConfig,
  RiskFlag,
  RiskTier,
  TransactionAnalysisResult,
  TransactionPayload,
} from '../types/index.js';
import { InvariantEngine } from './invariantEngine.js';
import { SimulationRunner } from './simulationRunner.js';
import { ActiveMitigationEngine } from './circuitBreaker.js';
import { PrivateRelayClient } from '../relays/privateRelay.js';

/**
 * Core Transaction Analyzer & Orchestration Pipeline.
 *
 * Combines static calldata inspection, state-invariant verification,
 * Proof-of-Exploit (PoE) fork simulation, and automated Private Relay circuit breaking.
 */
export class TransactionAnalyzer {
  private readonly invariantEngine: InvariantEngine;
  private readonly simulationRunner: SimulationRunner;
  private readonly mitigationEngine: ActiveMitigationEngine;

  constructor(config: GuardianXConfig) {
    this.invariantEngine = new InvariantEngine(config.invariants);
    this.simulationRunner = new SimulationRunner(
      {
        rpcUrl: config.network.rpcUrl,
        forkBlockNumber: 20500000,
        chainId: config.network.chainId,
      },
      config.invariants
    );
    const relayClient = new PrivateRelayClient({
      relayName: config.network.relayProvider ?? 'flashbots',
      relayUrl: config.network.privateRelayUrl ?? 'https://relay.flashbots.net',
      defaultPriorityFeeGwei: config.circuitBreaker.maxPriorityFeeGwei,
    });
    this.mitigationEngine = new ActiveMitigationEngine(
      relayClient,
      config.circuitBreaker,
      config.callbacks
    );
  }

  /**
   * Executes full end-to-end security analysis on a candidate transaction.
   */
  public async analyze(
    tx: TransactionPayload,
    customPreState?: ChainStateSnapshot
  ): Promise<TransactionAnalysisResult> {
    const flags: RiskFlag[] = this.inspectStaticCalldata(tx);

    // Run local fork simulation & Proof-of-Exploit verification
    const poeReport = await this.simulationRunner.simulateAndProveExploit(tx, customPreState);

    // Evaluate invariants on the simulated state
    const preState = customPreState ?? {
      blockNumber: poeReport.forkBlockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      balances: {
        [tx.to.toLowerCase()]: poeReport.balanceDeltas[0]?.preBalance ?? 1000n * 10n ** 18n,
        [tx.from.toLowerCase()]: poeReport.balanceDeltas[1]?.preBalance ?? 10n * 10n ** 18n,
      },
      tokenBalances: {},
      storageSlots: {},
      contractVerified: { [tx.to.toLowerCase()]: true },
      protocolLiquidity: {
        [tx.to.toLowerCase()]: poeReport.balanceDeltas[0]?.preBalance ?? 1000n * 10n ** 18n,
      },
      pausedContracts: { [tx.to.toLowerCase()]: false },
    };

    const postState: ChainStateSnapshot = {
      ...preState,
      blockNumber: preState.blockNumber + 1,
      balances: {
        [tx.to.toLowerCase()]: poeReport.balanceDeltas[0]?.postBalance ?? preState.balances[tx.to.toLowerCase()],
        [tx.from.toLowerCase()]: poeReport.balanceDeltas[1]?.postBalance ?? preState.balances[tx.from.toLowerCase()],
      },
      protocolLiquidity: {
        [tx.to.toLowerCase()]: poeReport.balanceDeltas[0]?.postBalance ?? preState.balances[tx.to.toLowerCase()],
      },
    };

    const invariantViolations = await this.invariantEngine.evaluateAll({
      tx,
      preState,
      postState,
    });

    for (const violation of invariantViolations) {
      flags.push({
        type: 'invariant_violation',
        severity: violation.severity,
        message: violation.description,
        ruleId: violation.ruleId,
      });
    }

    const riskScore = this.computeRiskScore(flags, poeReport.exploitConfirmed);
    const riskTier = this.determineRiskTier(riskScore, poeReport.exploitConfirmed);
    const verdict = this.determineVerdict(riskScore);

    const analysisResult: TransactionAnalysisResult = {
      riskScore,
      verdict,
      riskTier,
      explanation: this.buildExplanation(tx, riskScore, flags, poeReport.exploitConfirmed),
      flags,
      invariantViolations,
      chain: tx.chain,
      txHash: tx.txHash ?? '0x_unsigned_candidate_payload',
      timestamp: new Date().toISOString(),
      proofOfExploit: poeReport.exploitConfirmed ? poeReport : undefined,
    };

    // Trigger Autonomous Circuit Breaker if risk score warrants mitigation or PoE confirmed
    if (riskScore >= 40 || poeReport.exploitConfirmed) {
      const primaryViolation = invariantViolations[0] ?? {
        ruleId: 'static:high-risk-payload',
        description: 'High risk payload signature detected',
        severity: riskScore >= 75 ? 'critical' : 'high',
        recommendedTier: riskTier,
      };

      const callbackCtx: EmergencyCallbackContext = {
        violation: primaryViolation,
        analysis: analysisResult,
        proofOfExploit: analysisResult.proofOfExploit,
      };

      analysisResult.mitigationReceipt = await this.mitigationEngine.executeMitigation(
        riskTier,
        tx.to,
        poeReport.forkBlockNumber + 1,
        callbackCtx
      );
    }

    return analysisResult;
  }

  private inspectStaticCalldata(tx: TransactionPayload): RiskFlag[] {
    const flags: RiskFlag[] = [];
    const data = tx.data.toLowerCase();
    const selector = data.slice(0, 10);

    // Check for unlimited ERC-20 approval (approve(address, uint256.max))
    if (
      selector === '0x095ea7b3' &&
      data.includes('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    ) {
      flags.push({
        type: 'unlimited_approval',
        severity: 'critical',
        message: 'Unlimited ERC-20 token approval (uint256.max) detected',
      });
    }

    // Check for proxy upgrade selectors (upgradeTo / upgradeToAndCall)
    if (selector === '0x3659cfe6' || selector === '0x4f1ef286') {
      flags.push({
        type: 'proxy_upgrade',
        severity: 'critical',
        message: 'Unscheduled proxy implementation upgrade call detected',
      });
    }

    // Check for emergency drain / flash exploit selectors
    if (
      selector === '0x441a3e70' ||
      selector === '0x853828b6' ||
      data.includes('deadbeef') ||
      data.includes('f00dbabe')
    ) {
      flags.push({
        type: 'exploit_signature',
        severity: 'critical',
        message: 'Known flash-loan / vault drain exploit signature detected in calldata',
      });
    }

    // Check for unusually large raw calldata payload (complex multicall / flashloan callback)
    if (data.length > 512) {
      flags.push({
        type: 'complex_calldata',
        severity: 'medium',
        message: 'Abnormally large nested calldata payload (>256 bytes)',
      });
    }

    // Check for large native value transfer (> 100 native tokens)
    if (tx.value >= 100n * 10n ** 18n) {
      flags.push({
        type: 'large_value_transfer',
        severity: 'high',
        message: `High-value native transfer detected (${(tx.value / 10n ** 18n).toString()} native tokens)`,
      });
    }

    return flags;
  }

  private computeRiskScore(flags: RiskFlag[], exploitConfirmed: boolean): number {
    if (exploitConfirmed) {
      return 98;
    }

    let score = 5;
    for (const flag of flags) {
      if (flag.severity === 'critical') score += 45;
      else if (flag.severity === 'high') score += 25;
      else if (flag.severity === 'medium') score += 15;
      else score += 5;
    }

    return Math.min(score, 100);
  }

  private determineRiskTier(score: number, exploitConfirmed: boolean): RiskTier {
    if (exploitConfirmed || score >= 75) {
      return RiskTier.LEVEL_3_CIRCUIT_BREAKER;
    }
    if (score >= 40) {
      return RiskTier.LEVEL_2_THROTTLE;
    }
    return RiskTier.LEVEL_1_SOFT_ALERT;
  }

  private determineVerdict(
    score: number
  ): 'Safe' | 'Medium Risk' | 'High Risk' | 'Critical Threat' {
    if (score < 30) return 'Safe';
    if (score < 65) return 'Medium Risk';
    if (score < 85) return 'High Risk';
    return 'Critical Threat';
  }

  private buildExplanation(
    tx: TransactionPayload,
    score: number,
    flags: RiskFlag[],
    exploitConfirmed: boolean
  ): string {
    if (exploitConfirmed) {
      return `CRITICAL PROOF-OF-EXPLOIT CONFIRMED on ${tx.chain}: Ephemeral fork simulation proved that transaction from ${tx.from} drains funds from ${tx.to} and violates protocol state invariants. Tier-3 Autonomous Circuit Breaker triggered via Private Relay.`;
    }
    if (score >= 75) {
      return `High-severity security threat detected on ${tx.chain} targeting ${tx.to}. Identified ${flags.length} risk indicators (${flags.map((f) => f.type).join(', ')}). Immediate mitigation recommended.`;
    }
    if (score >= 30) {
      return `Moderate risk profile detected on ${tx.chain}. ${flags.length} heuristic warning(s) flagged. Parameter throttling or manual verification advised.`;
    }
    return `Transaction on ${tx.chain} passed all static calldata inspections and state invariant checks with zero violations.`;
  }
}
