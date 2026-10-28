import { GuardianXConfig } from '../types/index.js';
import { BuiltInInvariants } from './invariantEngine.js';

/**
 * Type-safe helper for authoring `guardianx.config.ts` with full IDE autocompletion.
 */
export function defineGuardianXConfig(config: GuardianXConfig): GuardianXConfig {
  return config;
}

/**
 * Default starter configuration used by the CLI (`guardianx init` / `guardianx simulate`)
 * and the interactive dashboard.
 */
export const defaultGuardianXConfig: GuardianXConfig = defineGuardianXConfig({
  projectName: 'GuardianX-Protected-Protocol',
  network: {
    chain: 'ethereum',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    chainId: 1,
    privateRelayUrl: 'https://relay.flashbots.net',
    relayProvider: 'flashbots',
  },
  contracts: [
    {
      name: 'CoreTreasuryVault',
      address: '0x1111111111111111111111111111111111111111',
      chain: 'ethereum',
      safeTreasuryAddress: '0x9999999999999999999999999999999999999999',
    },
  ],
  invariants: [
    BuiltInInvariants.maxBalanceDrainPercentage(
      '0x1111111111111111111111111111111111111111',
      15,
      'critical'
    ),
    BuiltInInvariants.immutableStorageSlot(
      '0x1111111111111111111111111111111111111111',
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
      ['0x9999999999999999999999999999999999999999']
    ),
  ],
  agentGuardrails: {
    maxSlippageBps: 100, // 1.00%
    maxGasBurnWei: 50000000000000000n, // 0.05 ETH
    maxTransferValueWei: 10000000000000000000n, // 10 ETH
    allowedContractWhitelist: [
      '0x1111111111111111111111111111111111111111',
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
      '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap V3 Router
    ],
  },
  circuitBreaker: {
    enabled: true,
    autoPauseOnTier3: true,
    autoSweepOnTier3: true,
    safeVaultAddress: '0x9999999999999999999999999999999999999999',
    maxPriorityFeeGwei: 75,
  },
});
