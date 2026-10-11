import {
  type Address,
  type Hex,
  createPublicClient,
  http,
} from 'viem';
import { monadTestnet, SpendGuardAbi, verifyVoucherSignature } from '@agentmesh/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface CachedChannel {
  agent: Address;
  payee: Address;
  deposit: bigint;
  claimed: bigint;
  expiry: bigint;
  closed: boolean;
  cachedAt: number;
}

const STATE_FILE = resolve(process.cwd(), '.voucher-state.json');

export class VoucherVerifier {
  private client: ReturnType<typeof createPublicClient>;
  private spendGuardAddress: Address;
  private channelCache = new Map<Hex, CachedChannel>();
  private lastAcceptedAmount = new Map<Hex, bigint>();
  private locks = new Map<Hex, Promise<void>>();
  private stateFile: string;

  constructor(rpcUrl: string, spendGuardAddress: Address, stateFile?: string) {
    this.spendGuardAddress = spendGuardAddress;
    this.stateFile = stateFile || STATE_FILE;
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(rpcUrl),
    });
    this.loadState();
  }

  private loadState() {
    try {
      if (existsSync(this.stateFile)) {
        const data = JSON.parse(readFileSync(this.stateFile, 'utf8')) as Record<string, string>;
        for (const [k, v] of Object.entries(data)) {
          try {
            this.lastAcceptedAmount.set(k as Hex, BigInt(v));
          } catch {}
        }
      }
    } catch (err) {
      console.error('[Verifier] Failed to load state:', err);
    }
  }

  private saveState() {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of this.lastAcceptedAmount.entries()) {
        obj[k] = v.toString();
      }
      writeFileSync(this.stateFile, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error('[Verifier] Failed to save state:', err);
    }
  }

  private async acquireLock(channelId: Hex): Promise<() => void> {
    const prev = this.locks.get(channelId);
    let release: () => void;
    const next = new Promise<void>((res) => {
      release = res;
    });
    this.locks.set(channelId, prev ? prev.then(() => next) : next);
    await (prev || Promise.resolve());
    return release!;
  }

  async getChannel(channelId: Hex): Promise<CachedChannel | null> {
    const cached = this.channelCache.get(channelId);
    if (cached && Date.now() - cached.cachedAt < 5000) {
      return cached;
    }

    if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') {
      // Mock mode fallback for local test
      return {
        agent: '0x1111111111111111111111111111111111111111',
        payee: '0x2222222222222222222222222222222222222222',
        deposit: 10_000_000n,
        claimed: 0n,
        expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
        closed: false,
        cachedAt: Date.now(),
      };
    }

    try {
      const result = (await this.client.readContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'channels',
        args: [channelId],
      })) as [Address, Address, bigint, bigint, bigint, bigint, boolean];

      const ch: CachedChannel = {
        agent: result[0],
        payee: result[1],
        deposit: result[3],
        claimed: result[4],
        expiry: result[5],
        closed: result[6],
        cachedAt: Date.now(),
      };

      this.channelCache.set(channelId, ch);
      return ch;
    } catch (err) {
      console.error('[Verifier] Failed to fetch channel:', err);
      return null;
    }
  }

  async verifyVoucher(params: {
    channelId: Hex;
    cumulativeAmount: bigint;
    sig: Hex;
    price: bigint;
    record?: boolean;
  }): Promise<{
    valid: boolean;
    reason?: string;
    channel?: CachedChannel;
    previousAmount?: bigint;
  }> {
    const { channelId, cumulativeAmount, sig, price, record = true } = params;

    const release = await this.acquireLock(channelId);
    try {
      const channel = await this.getChannel(channelId);
      if (!channel) {
        return { valid: false, reason: 'ChannelNotFound' };
      }

      if (channel.closed) {
        return { valid: false, reason: 'ChannelClosed' };
      }

      const nowSecs = BigInt(Math.floor(Date.now() / 1000));
      if (nowSecs > channel.expiry) {
        return { valid: false, reason: 'ChannelExpired' };
      }

      if (cumulativeAmount > channel.deposit) {
        return { valid: false, reason: 'VoucherExceedsDeposit' };
      }

      const previousAmount = this.lastAcceptedAmount.get(channelId) || channel.claimed;
      if (cumulativeAmount < previousAmount + price) {
        return {
          valid: false,
          reason: `InsufficientPaymentIncrement: got ${cumulativeAmount}, needed at least ${previousAmount + price}`,
        };
      }

      // Verify EIP-712 Signature
      if (this.spendGuardAddress !== '0x0000000000000000000000000000000000000000') {
        const isValidSig = await verifyVoucherSignature({
          address: channel.agent,
          signature: sig,
          voucher: { channelId, cumulativeAmount },
          verifyingContract: this.spendGuardAddress,
        });

        if (!isValidSig) {
          return { valid: false, reason: 'InvalidSignature' };
        }
      }

      // Record accepted cumulative amount
      if (record) {
        this.lastAcceptedAmount.set(channelId, cumulativeAmount);
        this.saveState();
      }

      return { valid: true, channel, previousAmount };
    } finally {
      release();
    }
  }

  async commitVoucher(channelId: Hex, cumulativeAmount: bigint) {
    const release = await this.acquireLock(channelId);
    try {
      this.lastAcceptedAmount.set(channelId, cumulativeAmount);
      this.saveState();
    } finally {
      release();
    }
  }

  async rollbackVoucher(channelId: Hex, expectedCumulative: bigint, previousAmount: bigint) {
    const release = await this.acquireLock(channelId);
    try {
      // Only roll back if no other request has advanced the channel past what we recorded
      const current = this.lastAcceptedAmount.get(channelId);
      if (current === expectedCumulative) {
        this.lastAcceptedAmount.set(channelId, previousAmount);
        this.saveState();
      }
    } finally {
      release();
    }
  }
}
