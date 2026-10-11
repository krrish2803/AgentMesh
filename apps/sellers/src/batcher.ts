import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  type Account,
} from 'viem';
import { monadTestnet, SpendGuardAbi } from '@agentmesh/sdk';

// Monad base fee ~100 gwei; cap 1559 fees so viem does not reserve
// gasLimit*~180gwei up front and drain the funded seller accounts.
const TX_FEE_OVERRIDES = {
  maxFeePerGas: 130_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
} as const;

export interface PendingVoucher {
  channelId: Hex;
  cumulativeAmount: bigint;
  sig: Hex;
  callsCount: number;
  lastUpdated: number;
}

export class ClaimBatcher {
  private pending = new Map<Hex, PendingVoucher>();
  private knownChannels = new Set<Hex>();
  private client: ReturnType<typeof createPublicClient>;
  private wallet: ReturnType<typeof createWalletClient>;
  private spendGuardAddress: Address;
  private account: Account;
  private timer: NodeJS.Timeout | null = null;
  private isClaiming = false;

  constructor(params: {
    rpcUrl: string;
    spendGuardAddress: Address;
    account: Account;
    claimIntervalMs?: number;
  }) {
    this.account = params.account;
    this.spendGuardAddress = params.spendGuardAddress;
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(params.rpcUrl),
    });
    this.wallet = createWalletClient({
      chain: monadTestnet,
      transport: http(params.rpcUrl),
      account: this.account,
    });

    const interval = params.claimIntervalMs || 5000;
    this.timer = setInterval(() => {
      void this.flush().catch((err) => {
        console.error(`[Batcher] Unhandled flush error:`, err?.message || err);
      });
    }, interval);
  }

  recordVoucher(channelId: Hex, cumulativeAmount: bigint, sig: Hex) {
    this.knownChannels.add(channelId);
    const existing = this.pending.get(channelId);
    if (!existing || cumulativeAmount > existing.cumulativeAmount) {
      this.pending.set(channelId, {
        channelId,
        cumulativeAmount,
        sig,
        callsCount: (existing?.callsCount || 0) + 1,
        lastUpdated: Date.now(),
      });
    } else {
      existing.callsCount += 1;
    }

    // Flush immediately if channel reached 20 calls
    if (this.pending.get(channelId)!.callsCount >= 20) {
      void this.flush();
    }
  }

  async flush() {
    if (this.isClaiming || this.pending.size === 0) return;
    this.isClaiming = true;

    try {
      const items = Array.from(this.pending.values());
      for (const item of items) {
        if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') {
          // If contract not yet deployed, skip on-chain tx
          this.pending.delete(item.channelId);
          continue;
        }

        try {
          const hash = await this.wallet.writeContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'claim',
            args: [item.channelId, item.cumulativeAmount, item.sig],
            chain: monadTestnet,
            account: this.account,
            gas: 400_000n, // claim(verify+state+USDC transfer) needs >200k on Monad
            ...TX_FEE_OVERRIDES,
          });

          const receipt = await this.client.waitForTransactionReceipt({
            hash,
            timeout: 30_000,
          });
          if (receipt.status === 'success') {
            console.log(`[Batcher] Claim confirmed for channel ${item.channelId.slice(0, 10)}... tx: ${hash} (${item.callsCount} calls covered)`);
            this.pending.delete(item.channelId);
          } else {
            console.error(`[Batcher] Claim reverted on-chain for channel ${item.channelId.slice(0, 10)}... tx: ${hash} (dropping voucher)`);
            this.pending.delete(item.channelId);
          }
        } catch (err: any) {
          console.error(`[Batcher] Claim error for channel ${item.channelId.slice(0, 10)}:`, err?.message || err);
        }
      }
    } catch (err: any) {
      console.error(`[Batcher] Flush error:`, err?.message || err);
    } finally {
      this.isClaiming = false;
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // Settle pending claims, then close every channel we have served as the payee,
  // refunding the unspent remainder to the buyer's vault. The payee may close a
  // channel at any time, so this runs cleanly on shutdown — unlike the buyer,
  // who can only reclaim after the channel expiry.
  async settleAndClose(): Promise<void> {
    this.stop();

    try {
      await this.flush();
    } catch (err: any) {
      console.error(`[Batcher] Final flush error:`, err?.message || err);
    }

    if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') {
      this.knownChannels.clear();
      return;
    }

    const channels = Array.from(this.knownChannels);
    if (channels.length === 0) return;

    console.log(`[Batcher] Settling and closing ${channels.length} channel(s) as payee...`);
    for (const channelId of channels) {
      try {
        const { request } = await this.client.simulateContract({
          address: this.spendGuardAddress,
          abi: SpendGuardAbi,
          functionName: 'closeChannel',
          args: [channelId],
          account: this.account,
        });
        const hash = await this.wallet.writeContract({ ...request, ...TX_FEE_OVERRIDES } as any);
        const receipt = await this.client.waitForTransactionReceipt({ hash, timeout: 30_000 });
        if (receipt.status === 'success') {
          console.log(`[Batcher] Closed channel ${channelId.slice(0, 10)}... (payee settlement) tx: ${hash}`);
        } else {
          console.error(`[Batcher] Close reverted for channel ${channelId.slice(0, 10)}... tx: ${hash}`);
        }
      } catch (err: any) {
        console.error(`[Batcher] Close error for channel ${channelId.slice(0, 10)}:`, err?.message || err);
      }
    }
    this.knownChannels.clear();
  }
}
