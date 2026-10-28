import {
  InvariantContext,
  InvariantRule,
  InvariantViolation,
  RiskSeverity,
  RiskTier,
} from '../types/index.js';

/**
 * Built-in invariant rules for common DeFi / Vault protection scenarios.
 */
export const BuiltInInvariants = {
  /**
   * Ensures a vault or protocol pool never loses more than `maxDrainPercentage`% of its balance in a single transaction.
   */
  maxBalanceDrainPercentage(
    contractAddress: string,
    maxDrainPercentage: number,
    severity: RiskSeverity = 'critical'
  ): InvariantRule {
    const normalizedAddr = contractAddress.toLowerCase();
    return {
      id: `invariant:max-balance-drain-${maxDrainPercentage}pct`,
      description: `Contract ${contractAddress} balance must not drop by more than ${maxDrainPercentage}% in a single tx`,
      severity,
      recommendedTier: RiskTier.LEVEL_3_CIRCUIT_BREAKER,
      evaluate: (ctx: InvariantContext): boolean => {
        const preBal = ctx.preState.balances[normalizedAddr] ?? 0n;
        const postBal = ctx.postState.balances[normalizedAddr] ?? 0n;
        if (preBal === 0n || postBal >= preBal) {
          return true;
        }
        const drained = preBal - postBal;
        const drainBps = Number((drained * 10000n) / preBal);
        return drainBps <= maxDrainPercentage * 100;
      },
    };
  },

  /**
   * Prevents unauthorized modification of critical storage slots (e.g., EIP-1967 implementation slot or owner slot).
   */
  immutableStorageSlot(
    contractAddress: string,
    slotHex: string,
    authorizedCallers: string[] = []
  ): InvariantRule {
    const normalizedAddr = contractAddress.toLowerCase();
    const normalizedCallers = new Set(authorizedCallers.map((c) => c.toLowerCase()));
    return {
      id: `invariant:immutable-slot-${slotHex.slice(0, 10)}`,
      description: `Storage slot ${slotHex} on ${contractAddress} must not be mutated by unauthorized callers`,
      severity: 'critical',
      recommendedTier: RiskTier.LEVEL_3_CIRCUIT_BREAKER,
      evaluate: (ctx: InvariantContext): boolean => {
        const preVal = ctx.preState.storageSlots[normalizedAddr]?.[slotHex];
        const postVal = ctx.postState.storageSlots[normalizedAddr]?.[slotHex];
        if (preVal === postVal) {
          return true;
        }
        return normalizedCallers.has(ctx.tx.from.toLowerCase());
      },
    };
  },

  /**
   * Prevents flash-loan or large single-tx reserve ratio distortion beyond threshold.
   */
  minimumProtocolLiquidity(
    protocolAddress: string,
    minLiquidityWei: bigint
  ): InvariantRule {
    const normalizedAddr = protocolAddress.toLowerCase();
    return {
      id: `invariant:min-liquidity-${normalizedAddr.slice(0, 8)}`,
      description: `Protocol liquidity for ${protocolAddress} must remain above ${minLiquidityWei.toString()} wei`,
      severity: 'high',
      recommendedTier: RiskTier.LEVEL_2_THROTTLE,
      evaluate: (ctx: InvariantContext): boolean => {
        const postLiq = ctx.postState.protocolLiquidity[normalizedAddr];
        if (postLiq === undefined) return true;
        return postLiq >= minLiquidityWei;
      },
    };
  },
};

/**
 * Deterministic state-invariant evaluation engine.
 * Evaluates registered invariant rules against pre- and post-transaction state snapshots.
 */
export class InvariantEngine {
  private readonly rules: Map<string, InvariantRule> = new Map();

  constructor(initialRules: InvariantRule[] = []) {
    for (const rule of initialRules) {
      this.registerRule(rule);
    }
  }

  public registerRule(rule: InvariantRule): void {
    this.rules.set(rule.id, rule);
  }

  public removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  public getRules(): InvariantRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluates all registered invariants against a transaction context.
   * Returns a list of violations (empty if all invariants hold).
   */
  public async evaluateAll(ctx: InvariantContext): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];

    for (const rule of this.rules.values()) {
      const passed = await rule.evaluate(ctx);
      if (!passed) {
        violations.push({
          ruleId: rule.id,
          description: rule.description,
          severity: rule.severity,
          recommendedTier: rule.recommendedTier ?? this.mapSeverityToTier(rule.severity),
          metadata: {
            txHash: ctx.tx.txHash,
            from: ctx.tx.from,
            to: ctx.tx.to,
            blockNumber: ctx.postState.blockNumber,
          },
        });
      }
    }

    return violations;
  }

  private mapSeverityToTier(severity: RiskSeverity): RiskTier {
    switch (severity) {
      case 'critical':
        return RiskTier.LEVEL_3_CIRCUIT_BREAKER;
      case 'high':
        return RiskTier.LEVEL_2_THROTTLE;
      case 'medium':
      case 'low':
      default:
        return RiskTier.LEVEL_1_SOFT_ALERT;
    }
  }
}
