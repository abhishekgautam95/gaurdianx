/**
 * GuardianXSafeModule Deployment & Verification Script
 * Usage: npx tsx scripts/deploySafeModule.ts
 */
import { KmsSignerAdapter, MultisigSafeSignerAdapter } from '../src/signers/index.js';
import { defaultGuardianXConfig } from '../src/core/config.js';

export interface SafeModuleDeploymentManifest {
  contractName: 'GuardianXSafeModule';
  network: string;
  chainId: number;
  avatarAddress: string;
  immutableSafeTreasury: string;
  guardianOperatorAddress: string;
  protectedTargets: string[];
  minCooldownSeconds: number;
  deterministicDeploymentAddress: string;
  timestamp: string;
}

export async function generateSafeModuleDeploymentManifest(): Promise<SafeModuleDeploymentManifest> {
  const kmsOperator = new KmsSignerAdapter({
    provider: 'aws-kms',
    keyId: 'arn:aws:kms:us-east-1:123456789012:key/guardianx-prod-operator',
    region: 'us-east-1',
    env: {},
  });

  const safeMultisig = new MultisigSafeSignerAdapter({
    safeAddress: defaultGuardianXConfig.circuitBreaker.safeVaultAddress,
    chainId: defaultGuardianXConfig.network.chainId,
    proposerSigner: kmsOperator,
  });

  const operatorAddress = await kmsOperator.getAddress();
  const safeAddress = await safeMultisig.getAddress();
  const protectedTargets = defaultGuardianXConfig.contracts.map((c) => c.address);

  return {
    contractName: 'GuardianXSafeModule',
    network: defaultGuardianXConfig.network.chain,
    chainId: defaultGuardianXConfig.network.chainId,
    avatarAddress: safeAddress,
    immutableSafeTreasury: safeAddress,
    guardianOperatorAddress: operatorAddress,
    protectedTargets,
    minCooldownSeconds: 60,
    deterministicDeploymentAddress: '0x6a72d1a98c4e5f3b2a1d0c9b8a7f6e5d4c3b2a10',
    timestamp: new Date().toISOString(),
  };
}
