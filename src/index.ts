/**
 * GuardianX SDK & Security Engine Entrypoint
 * @module guardianx
 */

export * from './types/index.js';
export { InvariantEngine, BuiltInInvariants } from './core/invariantEngine.js';
export { SimulationRunner } from './core/simulationRunner.js';
export { EvmRpcForkAdapter } from './core/evmRpcForkAdapter.js';
export { ActiveMitigationEngine } from './core/circuitBreaker.js';
export { TransactionAnalyzer } from './core/transactionAnalyzer.js';
export { defineGuardianXConfig, defaultGuardianXConfig } from './core/config.js';
export { MockAttackEngine, HISTORICAL_ATTACK_SCENARIOS } from './core/mockAttackEngine.js';
export { AgentGuardrailMiddleware } from './agents/guardrailMiddleware.js';
export {
  createGuardianWallet,
  GuardianFirewallBlockedError,
} from './agents/createGuardianWallet.js';
export { withGuardianToolGuardrails } from './agents/frameworkAdapters.js';
export { IncidentNotifier } from './alerts/incidentNotifier.js';
export { PrivateRelayClient, EMERGENCY_SELECTORS } from './relays/privateRelay.js';
export {
  MultiBuilderBroadcaster,
  DEFAULT_BUILDER_ENDPOINTS,
} from './relays/multiBuilderBroadcaster.js';
export {
  LocalPrivateKeySigner,
  KmsSignerAdapter,
  MultisigSafeSignerAdapter,
} from './signers/index.js';
export { ResilientRpcManager } from './providers/resilientRpcManager.js';
export { GuardianXCLI } from './cli/index.js';
