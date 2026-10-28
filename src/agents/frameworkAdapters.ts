import {
  AgentToolExecutionInput,
  DeterministicHardCaps,
  GenericAgentFrameworkTool,
  SupportedChain,
} from '../types/index.js';
import { AgentGuardrailMiddleware } from './guardrailMiddleware.js';
import { GuardianFirewallBlockedError } from './createGuardianWallet.js';

export interface WrapAgentToolOptions {
  agentId: string;
  chain?: SupportedChain;
  hardCaps: DeterministicHardCaps;
}

/**
 * Universal AI Agent Tool Guardrail Wrapper for **LangChain**, **Coinbase AgentKit**, and **ElizaOS** actions.
 *
 * Wraps any autonomous agent tool (`{ name, description, invoke }`) so every invocation is
 * verified against `AgentGuardrailMiddleware` (Semantic Intent + Deterministic Hard Caps)
 * before the underlying tool is allowed to execute.
 */
export function withGuardianToolGuardrails<
  TInput extends AgentToolExecutionInput,
  TOutput = unknown,
>(
  tool: GenericAgentFrameworkTool<TInput, TOutput>,
  options: WrapAgentToolOptions
): GenericAgentFrameworkTool<TInput, TOutput> {
  const middleware = new AgentGuardrailMiddleware(options.hardCaps);
  const chain = options.chain ?? 'ethereum';

  return {
    name: tool.name,
    description: `[Protected by GuardianX Firewall] ${tool.description}`,
    invoke: async (input: TInput): Promise<TOutput> => {
      const decision = middleware.verifyAgentToolCall({
        agentId: options.agentId,
        naturalLanguageObjective: input.intentObjective ?? tool.description,
        toolName: tool.name,
        estimatedSlippageBps: input.estimatedSlippageBps,
        tx: {
          chain,
          from: '0xAgentFrameworkExecutor000000000000000001',
          to: input.to,
          value: input.value ?? 0n,
          data: input.data ?? '0x',
        },
      });

      if (!decision.allowed) {
        const reasons: string[] = [];
        if (
          !decision.semanticVerification.matched ||
          decision.semanticVerification.promptInjectionDetected
        ) {
          reasons.push(decision.semanticVerification.reason);
        }
        reasons.push(...decision.hardCapViolations);
        throw new GuardianFirewallBlockedError(options.agentId, reasons);
      }

      return tool.invoke(input);
    },
  };
}
