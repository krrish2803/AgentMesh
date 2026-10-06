import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  type Account,
} from 'viem';
import { monadTestnet, SpendGuardAbi } from '@agentmesh/sdk';

export interface PendingVoucher {
  channelId: Hex;
  cumulativeAmount: bigint;
  sig: Hex;
  callsCount: number;
  lastUpdated: number;
}

export class ClaimBatcher {
  private pending = new Map<Hex, PendingVoucher>();
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
    this.timer = setInterval(() => this.flush(), interval);
  }

  recordVoucher(channelId: Hex, cumulativeAmount: bigint, sig: Hex) {
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
      this.flush();
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
            gas: 200_000n, // Explicit tight gas limit for Monad
          });

          console.log(`[Batcher] Claim submitted for channel ${item.channelId.slice(0, 10)}... tx: ${hash} (${item.callsCount} calls covered)`);
          this.pending.delete(item.channelId);
        } catch (err: any) {
          console.error(`[Batcher] Claim error for channel ${item.channelId.slice(0, 10)}:`, err?.message || err);
        }
      }
    } finally {
      this.isClaiming = false;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}
