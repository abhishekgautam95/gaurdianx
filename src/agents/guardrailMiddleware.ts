import {
  AgentToolCallRequest,
  DeterministicHardCaps,
  GuardrailDecision,
  SemanticIntentVerificationResult,
} from '../types/index.js';

/**
 * Dictionary of common 4-byte EVM function selectors to their semantic category and signature.
 */
const SELECTOR_CATALOG: Record<
  string,
  {
    name: string;
    category: SemanticIntentVerificationResult['inferredIntentCategory'];
  }
> = {
  '0x38ed1739': { name: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)', category: 'swap' },
  '0x7ff36ab5': { name: 'swapExactETHForTokens(uint256,address[],address,uint256)', category: 'swap' },
  '0x04e45aaf': { name: 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))', category: 'swap' },
  '0xa9059cbb': { name: 'transfer(address,uint256)', category: 'transfer' },
  '0x23b872dd': { name: 'transferFrom(address,address,uint256)', category: 'transfer' },
  '0x095ea7b3': { name: 'approve(address,uint256)', category: 'approve' },
  '0xa694fc3a': { name: 'stake(uint256)', category: 'stake' },
  '0xb6b55f25': { name: 'deposit(uint256)', category: 'stake' },
  '0xda95691a': { name: 'propose(address[],uint256[],string[],bytes[],string)', category: 'governance' },
  '0x56781388': { name: 'castVote(uint256,uint8)', category: 'governance' },
  '0xf2fde38b': { name: 'transferOwnership(address)', category: 'admin_mutation' },
  '0x3659cfe6': { name: 'upgradeTo(address)', category: 'admin_mutation' },
  '0x4f1ef286': { name: 'upgradeToAndCall(address,bytes)', category: 'admin_mutation' },
  '0x853828b6': { name: 'drainAll()', category: 'admin_mutation' },
  '0x441a3e70': { name: 'emergencyWithdraw(uint256,uint256)', category: 'admin_mutation' },
};

/**
 * Prompt injection and adversarial jailbreak markers frequently used to hijack LLM tool calls.
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*override/i,
  /transferownership/i,
  /drain\s+all\s+funds/i,
  /send\s+to\s+attacker/i,
  /bypass\s+guardrail/i,
  /sudo\s+mode/i,
];

/**
 * Phase 3: AI Agent Runtime Guardrail Middleware.
 *
 * Acts as an inline execution firewall for autonomous on-chain AI agents.
 * Intercepts LLM-generated tool calls and unsigned transaction payloads before signing:
 * 1. **Semantic Intent Verification**: Decodes the actual `calldata` selector and parameters,
 *    ensuring they align with the agent's stated natural-language objective and blocking prompt injections.
 * 2. **Deterministic Hard Caps**: Enforces strict, non-negotiable boundaries on slippage (bps),
 *    gas burn ceiling (wei), per-tx transfer value (wei), and destination contract whitelisting.
 */
export class AgentGuardrailMiddleware {
  private readonly hardCaps: DeterministicHardCaps;

  constructor(hardCaps: DeterministicHardCaps) {
    this.hardCaps = {
      ...hardCaps,
      allowedContractWhitelist: hardCaps.allowedContractWhitelist.map((addr) => addr.toLowerCase()),
      blockedSelectors: (
        hardCaps.blockedSelectors ?? ['0xf2fde38b', '0x3659cfe6', '0x4f1ef286', '0x853828b6']
      ).map((s) => s.toLowerCase()),
    };
  }

  /**
   * Intercepts and validates an autonomous agent's proposed transaction before signing.
   */
  public verifyAgentToolCall(request: AgentToolCallRequest): GuardrailDecision {
    const semanticVerification = this.verifySemanticIntent(request);
    const hardCapViolations = this.enforceDeterministicHardCaps(request);

    const allowed =
      semanticVerification.matched &&
      !semanticVerification.promptInjectionDetected &&
      hardCapViolations.length === 0;

    return {
      allowed,
      agentId: request.agentId,
      semanticVerification,
      hardCapViolations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verifies that the generated `calldata` matches the agent's natural-language objective.
   */
  public verifySemanticIntent(request: AgentToolCallRequest): SemanticIntentVerificationResult {
    const objective = request.naturalLanguageObjective.trim();
    const rawData = request.tx.data.toLowerCase();
    const selector = rawData.startsWith('0x') && rawData.length >= 10 ? rawData.slice(0, 10) : '0x00000000';

    const promptInjectionDetected = PROMPT_INJECTION_PATTERNS.some((pattern) =>
      pattern.test(objective)
    );

    const statedIntentCategory = this.classifyNaturalLanguageObjective(objective);

    // Native value transfer with empty calldata (`0x`)
    if (rawData === '0x' || rawData === '') {
      const matched = statedIntentCategory === 'transfer' && !promptInjectionDetected;
      return {
        matched,
        confidence: matched ? 0.96 : 0.99,
        decodedSelector: '0x',
        decodedFunctionName: 'nativeTransfer()',
        inferredIntentCategory: 'transfer',
        statedIntentCategory,
        promptInjectionDetected,
        reason: matched
          ? 'Native transfer calldata matches stated transfer intent.'
          : `Semantic mismatch: Objective states '${statedIntentCategory}' but transaction is a raw native transfer.`,
      };
    }

    const catalogEntry = SELECTOR_CATALOG[selector];
    const inferredIntentCategory = catalogEntry?.category ?? 'unknown';
    const decodedFunctionName = catalogEntry?.name ?? `unknownSelector(${selector})`;

    // Detect unlimited ERC-20 approval disguised as a swap or bounded approval
    const isUnlimitedApproval =
      selector === '0x095ea7b3' &&
      rawData.includes('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    if (isUnlimitedApproval && !objective.toLowerCase().includes('unlimited')) {
      return {
        matched: false,
        confidence: 0.99,
        decodedSelector: selector,
        decodedFunctionName,
        inferredIntentCategory: 'approve',
        statedIntentCategory,
        promptInjectionDetected: true,
        reason:
          'Rogue calldata detected: Transaction requests unlimited ERC-20 approval (uint256.max) not authorized by natural-language objective.',
      };
    }

    if (promptInjectionDetected) {
      return {
        matched: false,
        confidence: 0.99,
        decodedSelector: selector,
        decodedFunctionName,
        inferredIntentCategory,
        statedIntentCategory,
        promptInjectionDetected: true,
        reason: 'Adversarial prompt injection pattern detected in agent objective.',
      };
    }

    const matched =
      inferredIntentCategory !== 'unknown' &&
      inferredIntentCategory !== 'admin_mutation' &&
      inferredIntentCategory === statedIntentCategory;

    return {
      matched,
      confidence: matched ? 0.95 : 0.92,
      decodedSelector: selector,
      decodedFunctionName,
      inferredIntentCategory,
      statedIntentCategory,
      promptInjectionDetected: false,
      reason: matched
        ? `Decoded function ${decodedFunctionName} matches stated '${statedIntentCategory}' objective.`
        : `Semantic Intent Mismatch: Agent objective is '${statedIntentCategory}', but calldata invokes '${decodedFunctionName}' (${inferredIntentCategory}).`,
    };
  }

  /**
   * Enforces deterministic hard caps (Max Slippage, Max Gas Burn, Max Transfer Value, Whitelist).
   */
  public enforceDeterministicHardCaps(request: AgentToolCallRequest): string[] {
    const violations: string[] = [];
    const { tx, estimatedSlippageBps } = request;

    // 1. Contract Whitelist Check
    const normalizedTo = tx.to.toLowerCase();
    if (!this.hardCaps.allowedContractWhitelist.includes(normalizedTo)) {
      violations.push(
        `Destination contract ${tx.to} is not in the allowedContractWhitelist.`
      );
    }

    // 2. Blocked Selector Check
    const selector = tx.data.toLowerCase().slice(0, 10);
    if (this.hardCaps.blockedSelectors?.includes(selector)) {
      violations.push(
        `Function selector ${selector} is explicitly blocked by agent guardrail policy.`
      );
    }

    // 3. Max Slippage Check
    if (
      estimatedSlippageBps !== undefined &&
      estimatedSlippageBps > this.hardCaps.maxSlippageBps
    ) {
      violations.push(
        `Estimated slippage (${estimatedSlippageBps} bps) exceeds hard cap (${this.hardCaps.maxSlippageBps} bps).`
      );
    }

    // 4. Max Per-Transaction Transfer Value Limit
    if (tx.value > this.hardCaps.maxTransferValueWei) {
      violations.push(
        `Transaction value (${tx.value.toString()} wei) exceeds maxTransferValueWei hard cap (${this.hardCaps.maxTransferValueWei.toString()} wei).`
      );
    }

    // Also inspect ERC-20 transfer(address,uint256) amount encoded in calldata
    if (selector === '0xa9059cbb' && tx.data.length >= 138) {
      const amountHex = `0x${tx.data.slice(74, 138)}`;
      try {
        const tokenAmount = BigInt(amountHex);
        if (tokenAmount > this.hardCaps.maxTransferValueWei) {
          violations.push(
            `ERC-20 transfer amount (${tokenAmount.toString()}) exceeds maxTransferValueWei hard cap (${this.hardCaps.maxTransferValueWei.toString()}).`
          );
        }
      } catch {
        violations.push('Malformed ERC-20 transfer amount in calldata.');
      }
    }

    // 5. Max Gas Burn Ceiling Check
    const gasLimit = tx.gasLimit ?? 21000n;
    const maxFeePerGas = tx.maxFeePerGas ?? 50n * 10n ** 9n;
    const estimatedGasBurnWei = gasLimit * maxFeePerGas;

    if (estimatedGasBurnWei > this.hardCaps.maxGasBurnWei) {
      violations.push(
        `Maximum gas burn (${estimatedGasBurnWei.toString()} wei) exceeds maxGasBurnWei ceiling (${this.hardCaps.maxGasBurnWei.toString()} wei).`
      );
    }

    return violations;
  }

  private classifyNaturalLanguageObjective(
    objective: string
  ): SemanticIntentVerificationResult['statedIntentCategory'] {
    const lower = objective.toLowerCase();
    if (/\b(swap|exchange|trade|buy|sell)\b/.test(lower)) return 'swap';
    if (/\b(stake|deposit|supply|yield)\b/.test(lower)) return 'stake';
    if (/\b(approve|allowance|permit)\b/.test(lower)) return 'approve';
    if (/\b(vote|propose|governance|ballot)\b/.test(lower)) return 'governance';
    if (/\b(upgrade|ownership|admin|pause|drain)\b/.test(lower)) return 'admin_mutation';
    if (/\b(send|transfer|pay|remit)\b/.test(lower)) return 'transfer';
    return 'unknown';
  }
}
