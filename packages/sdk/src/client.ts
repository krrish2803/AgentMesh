import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  type Abi,
  getContract,
} from 'viem';
import SpendGuardAbiJson from './abis/SpendGuard.json';
import IdentityRegistryAbiJson from './abis/IdentityRegistry.json';
import ReputationRegistryAbiJson from './abis/ReputationRegistry.json';
import { monadTestnet } from './chain.js';
import { MONAD_TESTNET_ADDRESSES } from './addresses.js';

export interface SpendGuardClientConfig {
  spendGuardAddress: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  identityRegistryAddress?: Address;
  reputationRegistryAddress?: Address;
}

const SpendGuardAbi = SpendGuardAbiJson as Abi;
const IdentityRegistryAbi = IdentityRegistryAbiJson as Abi;
const ReputationRegistryAbi = ReputationRegistryAbiJson as Abi;

export class SpendGuardClient {
  public spendGuardAddress: Address;
  public publicClient: PublicClient;
  public walletClient?: WalletClient;
  public identityAddress?: Address;
  public reputationAddress?: Address;
  private _spendGuard: any;

  constructor(config: SpendGuardClientConfig) {
    this.spendGuardAddress =
      config.spendGuardAddress ?? (MONAD_TESTNET_ADDRESSES.SPEND_GUARD as Address);
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.identityAddress =
      config.identityRegistryAddress ?? (MONAD_TESTNET_ADDRESSES.ERC8004_IDENTITY as Address);
    this.reputationAddress =
      config.reputationRegistryAddress ?? (MONAD_TESTNET_ADDRESSES.ERC8004_REPUTATION as Address);
    this._spendGuard = getContract({
      address: this.spendGuardAddress,
      abi: SpendGuardAbi,
      client: {
        public: this.publicClient,
        wallet: this.walletClient,
      },
    });
  }

  get spendGuard() {
    return this._spendGuard;
  }

  isDeployed(): boolean {
    return this.spendGuardAddress !== ('0x0000000000000000000000000000000000000000' as Address);
  }

  async getVaultBalance(): Promise<bigint> {
    if (!this.isDeployed()) {
      throw new Error('SpendGuard not deployed');
    }
    return (await this.spendGuard.read.vaultBalance()) as bigint;
  }

  async getPolicy(agent: Address) {
    if (!this.isDeployed()) {
      throw new Error('SpendGuard not deployed');
    }
    return this.spendGuard.read.policies([agent]);
  }

  async getChannel(channelId: Hex) {
    if (!this.isDeployed()) {
      throw new Error('SpendGuard not deployed');
    }
    return this.spendGuard.read.channels([channelId]);
  }

  async checkOpenChannel(params: {
    agent: Address;
    payee: Address;
    payeeAgentId: bigint;
    deposit: bigint;
  }): Promise<{ ok: boolean; reason: string }> {
    if (!this.isDeployed()) {
      throw new Error('SpendGuard not deployed');
    }
    const [ok, reason] = (await this.spendGuard.read.checkOpenChannel([
      params.agent,
      params.payee,
      params.payeeAgentId,
      params.deposit,
    ])) as [boolean, string];
    return { ok, reason };
  }

  async getPayeeReputation(payeeAgentId: bigint): Promise<{ count: bigint; score: bigint; decimals: number }> {
    if (!this.reputationAddress) {
      throw new Error('Reputation registry address not configured');
    }
    const repContract = getContract({
      address: this.reputationAddress,
      abi: ReputationRegistryAbi,
      client: { public: this.publicClient },
    });

    // ERC-8004's getSummary reverts unless the client list is non-empty, so
    // resolve the feedback-givers first. No clients means "no feedback yet".
    const clients = (await repContract.read.getClients([payeeAgentId])) as readonly Address[];
    if (clients.length === 0) {
      return { count: 0n, score: 0n, decimals: 0 };
    }

    const [count, score, decimals] = (await repContract.read.getSummary([
      payeeAgentId,
      clients,
      '',
      '',
    ])) as [bigint, bigint, number];

    return { count, score, decimals };
  }
}
