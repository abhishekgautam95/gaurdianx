import { defineGuardianXConfig, BuiltInInvariants } from './src/index';

/**
 * GuardianX Declarative Security & Active Mitigation Configuration
 */
export default defineGuardianXConfig({
  projectName: 'GuardianX-DeFi-Core',
  network: {
    chain: 'ethereum',
    rpcUrl: process.env.ETH_RPC_URL ?? 'https://eth-mainnet.g.alchemy.com/v2/demo',
    chainId: 1,
    privateRelayUrl: 'https://relay.flashbots.net',
    relayProvider: 'flashbots',
  },
  contracts: [
    {
      name: 'OmnichainLiquidityVault',
      address: '0x1111111111111111111111111111111111111111',
      chain: 'ethereum',
      safeTreasuryAddress: '0x9999999999999999999999999999999999999999',
    },
  ],
  invariants: [
    // Invariant 1: Vault reserve must never drop by >15% in a single transaction
    BuiltInInvariants.maxBalanceDrainPercentage(
      '0x1111111111111111111111111111111111111111',
      15,
      'critical'
    ),
    // Invariant 2: EIP-1967 proxy implementation slot must never be mutated by non-multisig callers
    BuiltInInvariants.immutableStorageSlot(
      '0x1111111111111111111111111111111111111111',
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
      ['0x9999999999999999999999999999999999999999']
    ),
  ],
  agentGuardrails: {
    maxSlippageBps: 100, // 1.00% max slippage
    maxGasBurnWei: 50000000000000000n, // 0.05 ETH ceiling
    maxTransferValueWei: 10000000000000000000n, // 10 ETH per-tx cap
    allowedContractWhitelist: [
      '0x1111111111111111111111111111111111111111',
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
    ],
  },
  circuitBreaker: {
    enabled: true,
    autoPauseOnTier3: true,
    autoSweepOnTier3: true,
    safeVaultAddress: '0x9999999999999999999999999999999999999999',
    maxPriorityFeeGwei: 80,
  },
  callbacks: {
    onSoftAlert: async ({ violation }) => {
      console.log(`[Alert Tier 1] ${violation.ruleId}: ${violation.description}`);
    },
    onThrottle: async ({ violation }) => {
      console.log(`[Throttle Tier 2] Throttling parameters due to ${violation.ruleId}`);
    },
    onCircuitBreaker: async ({ violation }, receipt) => {
      console.log(
        `[Circuit Breaker Tier 3] Dispatched bundle ${receipt.bundleResponse?.bundleHash} for ${violation.ruleId}`
      );
    },
  },
});
