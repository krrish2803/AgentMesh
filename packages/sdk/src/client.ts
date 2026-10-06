import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  getContract,
} from 'viem';
import SpendGuardAbi from './abis/SpendGuard.json';
import IdentityRegistryAbi from './abis/IdentityRegistry.json';
import ReputationRegistryAbi from './abis/ReputationRegistry.json';
import { monadTestnet } from './chain.js';

export interface SpendGuardClientConfig {
  spendGuardAddress: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  identityRegistryAddress?: Address;
  reputationRegistryAddress?: Address;
}

export class SpendGuardClient {
  public spendGuardAddress: Address;
  public publicClient: PublicClient;
  public walletClient?: WalletClient;
  public identityAddress?: Address;
  public reputationAddress?: Address;

  constructor(config: SpendGuardClientConfig) {
    this.spendGuardAddress = config.spendGuardAddress;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.identityAddress = config.identityRegistryAddress;
    this.reputationAddress = config.reputationRegistryAddress;
  }

  get spendGuard() {
    return getContract({
      address: this.spendGuardAddress,
      abi: SpendGuardAbi,
      client: {
        public: this.publicClient,
        wallet: this.walletClient,
      },
    });
  }

  async getVaultBalance(): Promise<bigint> {
    return (await this.spendGuard.read.vaultBalance()) as bigint;
  }

  async getPolicy(agent: Address) {
    return this.spendGuard.read.policies([agent]);
  }

  async getChannel(channelId: Hex) {
    return this.spendGuard.read.channels([channelId]);
  }

  async checkOpenChannel(params: {
    agent: Address;
    payee: Address;
    payeeAgentId: bigint;
    deposit: bigint;
  }): Promise<{ ok: boolean; reason: string }> {
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

    const [count, score, decimals] = (await repContract.read.getSummary([
      payeeAgentId,
      [],
      '',
      '',
    ])) as [bigint, bigint, number];

    return { count, score, decimals };
  }
}
