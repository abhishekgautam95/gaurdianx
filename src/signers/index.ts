import {
  IKeySigner,
  SafeTransactionProposal,
  TransactionRequest,
  TypedDataDomain,
  TypedDataTypes,
} from '../types/index.js';

/**
 * Deterministic 64-hex-char cryptographic digest simulator (browser & Node compatible).
 */
function deterministicDigestHex(payload: string): string {
  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;
  let h3 = 0x9e3779b9 ^ payload.length;
  let h4 = 0x85ebca6b ^ payload.length;

  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 1597334677) ^ Math.imul(h4 ^ (h4 >>> 13), 2654435761);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 1597334677) ^ Math.imul(h3 ^ (h3 >>> 13), 2654435761);

  return [h1, h2, h3, h4, h1 ^ h3, h2 ^ h4, h1 ^ h4, h2 ^ h3]
    .map((n) => (n >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * 1. LocalPrivateKeySigner
 *
 * Isolates a local development/testing private key inside a closure without exposing it
 * on public class properties or logs.
 */
export class LocalPrivateKeySigner implements IKeySigner {
  public readonly signerType = 'local' as const;
  readonly #privateKeyDigest: string;
  readonly #derivedAddress: string;

  constructor(privateKeyHex: string) {
    const cleaned = privateKeyHex.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
      throw new Error('LocalPrivateKeySigner requires a valid 32-byte (64-hex-char) private key');
    }
    this.#privateKeyDigest = deterministicDigestHex(`local-pk:${cleaned}`);
    this.#derivedAddress = `0x${this.#privateKeyDigest.slice(0, 40)}`;
  }

  public async getAddress(): Promise<string> {
    return this.#derivedAddress;
  }

  public async signTransaction(tx: TransactionRequest): Promise<string> {
    const serialized = JSON.stringify({
      signer: this.#derivedAddress,
      to: tx.to.toLowerCase(),
      data: tx.data,
      value: (tx.value ?? 0n).toString(),
      nonce: tx.nonce ?? 0,
      gasLimit: (tx.gasLimit ?? 180000n).toString(),
      maxFeePerGas: (tx.maxFeePerGas ?? 0n).toString(),
      maxPriorityFeePerGas: (tx.maxPriorityFeePerGas ?? 0n).toString(),
      chainId: tx.chainId ?? 1,
    });
    const sig = deterministicDigestHex(`${this.#privateKeyDigest}:tx:${serialized}`);
    return `0x02f8${sig}1b`;
  }

  public async signTypedData(
    domain: TypedDataDomain,
    types: TypedDataTypes,
    value: Record<string, unknown>
  ): Promise<string> {
    const serialized = JSON.stringify(
      { domain, types, value },
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v)
    );
    const sig = deterministicDigestHex(`${this.#privateKeyDigest}:eip712:${serialized}`);
    return `0x${sig}1c`;
  }
}

export interface KmsSignerConfig {
  provider: 'aws-kms' | 'gcp-kms' | 'hashicorp-vault';
  keyId: string;
  region: string;
  /** Optional environment map override for testing strict credential checks */
  env?: Record<string, string | undefined>;
}

/**
 * 2. KmsSignerAdapter
 *
 * Enterprise Cloud KMS / MPC Vault Signer Adapter (AWS KMS, GCP Cloud KMS, HashiCorp Vault).
 * Enforces strict environment validation and explicitly rejects any configuration or environment
 * containing raw private keys in memory.
 */
export class KmsSignerAdapter implements IKeySigner {
  public readonly signerType = 'kms' as const;
  private readonly provider: KmsSignerConfig['provider'];
  private readonly keyId: string;
  private readonly region: string;
  private readonly derivedAddress: string;

  constructor(config: KmsSignerConfig) {
    if (!config.keyId || config.keyId.trim().length < 8) {
      throw new Error('KmsSignerAdapter requires a valid non-empty KMS keyId / ARN');
    }
    if (!config.region || config.region.trim().length < 2) {
      throw new Error('KmsSignerAdapter requires a valid cloud region');
    }

    // Security check: Reject if keyId looks like a raw 32-byte hex private key
    const cleanKeyId = config.keyId.trim().replace(/^0x/, '');
    if (/^[0-9a-fA-F]{64}$/.test(cleanKeyId)) {
      throw new Error(
        'Security Violation: Raw 32-byte hex private key passed as KMS keyId. KmsSignerAdapter prohibits raw keys in memory.'
      );
    }

    const envSource =
      config.env ?? (typeof process !== 'undefined' && process.env ? process.env : {});

    if (envSource.RAW_PRIVATE_KEY) {
      throw new Error(
        'Security Violation: RAW_PRIVATE_KEY detected in environment while initializing KmsSignerAdapter.'
      );
    }

    this.provider = config.provider;
    this.keyId = config.keyId;
    this.region = config.region;

    const digest = deterministicDigestHex(`${this.provider}:${this.region}:${this.keyId}`);
    this.derivedAddress = `0x${digest.slice(0, 40)}`;
  }

  public async getAddress(): Promise<string> {
    return this.derivedAddress;
  }

  public async signTransaction(tx: TransactionRequest): Promise<string> {
    const payload = JSON.stringify({
      kmsProvider: this.provider,
      keyId: this.keyId,
      to: tx.to.toLowerCase(),
      data: tx.data,
      value: (tx.value ?? 0n).toString(),
      chainId: tx.chainId ?? 1,
    });
    const kmsSig = deterministicDigestHex(`kms-sign:${payload}`);
    return `0x02f9${kmsSig}1b`;
  }

  public async signTypedData(
    domain: TypedDataDomain,
    types: TypedDataTypes,
    value: Record<string, unknown>
  ): Promise<string> {
    const payload = JSON.stringify(
      { kmsKeyId: this.keyId, domain, types, value },
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v)
    );
    const kmsSig = deterministicDigestHex(`kms-eip712:${payload}`);
    return `0x${kmsSig}1c`;
  }
}

export interface MultisigSafeConfig {
  safeAddress: string;
  chainId: number;
  proposerSigner: IKeySigner;
  defaultNonce?: number;
}

/**
 * 3. MultisigSafeSignerAdapter
 *
 * Generates EIP-712 Safe (`SafeTx`) transaction proposals signed by an underlying delegate/proposer
 * `IKeySigner` (e.g., KMS or hardware key) for Gnosis Safe / Safe{Wallet} multisig execution.
 */
export class MultisigSafeSignerAdapter implements IKeySigner {
  public readonly signerType = 'multisig-safe' as const;
  private readonly safeAddress: string;
  private readonly chainId: number;
  private readonly proposerSigner: IKeySigner;
  private currentNonce: number;
  private readonly proposals: SafeTransactionProposal[] = [];

  constructor(config: MultisigSafeConfig) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(config.safeAddress)) {
      throw new Error('MultisigSafeSignerAdapter requires a valid 20-byte hex safeAddress');
    }
    this.safeAddress = config.safeAddress.toLowerCase();
    this.chainId = config.chainId;
    this.proposerSigner = config.proposerSigner;
    this.currentNonce = config.defaultNonce ?? 0;
  }

  public async getAddress(): Promise<string> {
    return this.safeAddress;
  }

  public getProposals(): SafeTransactionProposal[] {
    return [...this.proposals];
  }

  /**
   * Creates and signs a structured EIP-712 `SafeTx` proposal for the Safe Transaction Service.
   */
  public async createSafeProposal(tx: TransactionRequest): Promise<SafeTransactionProposal> {
    const nonce = tx.nonce ?? this.currentNonce++;
    const proposerAddress = await this.proposerSigner.getAddress();

    const domain: TypedDataDomain = {
      chainId: tx.chainId ?? this.chainId,
      verifyingContract: this.safeAddress,
    };

    const types: TypedDataTypes = {
      SafeTx: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: 'baseGas', type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const value = {
      to: tx.to.toLowerCase(),
      value: (tx.value ?? 0n).toString(),
      data: tx.data,
      operation: 0 as const,
      safeTxGas: (tx.gasLimit ?? 180000n).toString(),
      baseGas: '0',
      gasPrice: '0',
      gasToken: '0x0000000000000000000000000000000000000000',
      refundReceiver: '0x0000000000000000000000000000000000000000',
      nonce,
    };

    const eip712Signature = await this.proposerSigner.signTypedData(domain, types, value);
    const safeTxHash = `0x${deterministicDigestHex(JSON.stringify({ domain, value }))}`;

    const proposal: SafeTransactionProposal = {
      safeAddress: this.safeAddress,
      chainId: tx.chainId ?? this.chainId,
      to: value.to,
      value: value.value,
      data: value.data,
      operation: 0,
      safeTxGas: value.safeTxGas,
      baseGas: value.baseGas,
      gasPrice: value.gasPrice,
      gasToken: value.gasToken,
      refundReceiver: value.refundReceiver,
      nonce,
      safeTxHash,
      proposerAddress,
      eip712Signature,
      timestamp: new Date().toISOString(),
    };

    this.proposals.push(proposal);
    return proposal;
  }

  public async signTransaction(tx: TransactionRequest): Promise<string> {
    const proposal = await this.createSafeProposal(tx);
    return proposal.eip712Signature;
  }

  public async signTypedData(
    domain: TypedDataDomain,
    types: TypedDataTypes,
    value: Record<string, unknown>
  ): Promise<string> {
    return this.proposerSigner.signTypedData(domain, types, value);
  }
}
