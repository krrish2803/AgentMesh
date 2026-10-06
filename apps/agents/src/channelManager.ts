import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
} from 'viem';
import { type PrivateKeyAccount } from 'viem/accounts';
import { monadTestnet, SpendGuardAbi, signVoucher, decodeSpendGuardError } from '@agentmesh/sdk';

export interface OpenChannelResult {
  channelId: Hex;
  deposit: bigint;
  expiry: bigint;
}

export class AgentChannelManager {
  private client: ReturnType<typeof createPublicClient>;
  private wallet: ReturnType<typeof createWalletClient>;
  private account: PrivateKeyAccount;
  private spendGuardAddress: Address;
  private activeChannels = new Map<string, { channelId: Hex; cumulativeAmount: bigint; deposit: bigint }>();

  constructor(rpcUrl: string, spendGuardAddress: Address, account: PrivateKeyAccount) {
    this.account = account;
    this.spendGuardAddress = spendGuardAddress;
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(rpcUrl),
    });
    this.wallet = createWalletClient({
      chain: monadTestnet,
      transport: http(rpcUrl),
      account: this.account,
    });
  }

  async ensureChannel(payee: Address, payeeAgentId: bigint, minDeposit: bigint): Promise<Hex> {
    const key = `${payee.toLowerCase()}`;
    const existing = this.activeChannels.get(key);
    if (existing && existing.cumulativeAmount + minDeposit <= existing.deposit) {
      return existing.channelId;
    }

    if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') {
      const mockId = ('0x' + '1'.repeat(64)) as Hex;
      this.activeChannels.set(key, { channelId: mockId, cumulativeAmount: 0n, deposit: 10_000_000n });
      return mockId;
    }

    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const deposit = minDeposit > 50000n ? minDeposit : 50000n; // Default deposit $0.05

    try {
      const hash = await this.wallet.writeContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'openChannel',
        args: [payee, payeeAgentId, deposit, expiry],
        chain: monadTestnet,
        account: this.account,
        gas: 350_000n, // Explicit tight gas limit for Monad
      });

      const receipt = await this.client.waitForTransactionReceipt({ hash });
      let channelId: Hex | null = null;

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: SpendGuardAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'ChannelOpened') {
            channelId = (decoded.args as any).channelId;
            break;
          }
        } catch {}
      }

      if (!channelId) {
        throw new Error('ChannelOpened event not found in receipt');
      }

      this.activeChannels.set(key, { channelId, cumulativeAmount: 0n, deposit });
      console.log(`[Agent ${this.account.address.slice(0, 8)}] Opened channel ${channelId.slice(0, 10)}... (deposit: ${deposit})`);
      return channelId;
    } catch (err: any) {
      const decodedErr = decodeSpendGuardError(err);
      if (decodedErr) {
        console.error(`[Agent ${this.account.address.slice(0, 8)}] openChannel rejected by SpendGuard: ${decodedErr.errorName}`);
      }
      throw err;
    }
  }

  async createVoucher(payee: Address, channelId: Hex, price: bigint): Promise<{ cumulativeAmount: bigint; sig: Hex }> {
    const key = `${payee.toLowerCase()}`;
    const ch = this.activeChannels.get(key);
    const newCumulative = (ch?.cumulativeAmount || 0n) + price;

    const sig = await signVoucher(
      this.account,
      { channelId, cumulativeAmount: newCumulative },
      this.spendGuardAddress
    );

    if (ch) {
      ch.cumulativeAmount = newCumulative;
    }

    return { cumulativeAmount: newCumulative, sig };
  }

  async closeChannel(channelId: Hex): Promise<Hex | null> {
    if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') return null;

    try {
      const hash = await this.wallet.writeContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'closeChannel',
        args: [channelId],
        chain: monadTestnet,
        account: this.account,
        gas: 150_000n,
      });
      return hash;
    } catch (err) {
      console.error(`[Agent] Failed to close channel ${channelId}:`, err);
      return null;
    }
  }
}
