import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeErrorResult,
  http,
} from 'viem';
import { randomBytes } from 'node:crypto';
import { type PrivateKeyAccount } from 'viem/accounts';
import { monadTestnet, SpendGuardAbi, signVoucher, decodeSpendGuardError } from '@agentmesh/sdk';
import { TX_FEE_OVERRIDES } from './config.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Simulated policy limits used while SpendGuard is undeployed (mock mode).
// Matches the $10 per-channel policy cap used by the rogue scenarios.
const MOCK_MAX_PER_CHANNEL = 10_000_000n;
const REAL_DEFAULT_DEPOSIT = 50_000n; // $0.05 USDC

interface ChannelState {
  channelId: Hex;
  cumulativeAmount: bigint;
  deposit: bigint;
  payee: Address;
  payeeAgentId: bigint;
}

// Result of a close attempt:
//  - 'closed'   the channel was settled and the remainder refunded to the vault
//  - 'deferred' the buyer may not close before expiry; the payee (seller) settles it
//  - 'failed'   an unexpected on-chain error occurred and should be retried
export type CloseResult = 'closed' | 'deferred' | 'failed';

export class AgentChannelManager {
  private client: ReturnType<typeof createPublicClient>;
  private wallet: ReturnType<typeof createWalletClient>;
  private account: PrivateKeyAccount;
  private spendGuardAddress: Address;
  private activeChannels = new Map<string, ChannelState>();
  private pendingClose: Hex[] = [];

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

  get isMock(): boolean {
    return (this.spendGuardAddress as string).toLowerCase() === ZERO_ADDRESS;
  }

  // Channels are keyed per (payee, payeeAgentId) so two listings served by the
  // same address never collide on one shared channel.
  private channelKey(payee: Address, payeeAgentId: bigint): string {
    return `${payee.toLowerCase()}-${payeeAgentId}`;
  }

  private findByChannelId(channelId: Hex): ChannelState | undefined {
    for (const ch of this.activeChannels.values()) {
      if (ch.channelId === channelId) return ch;
    }
    return undefined;
  }

  // Close a channel we are done with. If the on-chain close fails we stop using it
  // but remember it so it is retried at shutdown instead of leaking the funds.
  // A 'deferred' result (buyer is not allowed to close before expiry) is expected
  // and is not treated as a failure — the payee settles those channels instead.
  private async retireChannel(key: string, ch: ChannelState): Promise<void> {
    const result = await this.closeChannel(ch.channelId);
    if (result !== 'closed') {
      this.activeChannels.delete(key);
      if (result === 'failed') this.pendingClose.push(ch.channelId);
    }
  }

  async ensureChannel(payee: Address, payeeAgentId: bigint, minDeposit: bigint): Promise<Hex> {
    const key = this.channelKey(payee, payeeAgentId);

    // Reject policy-violating deposits before touching any existing channel, so a
    // rejected open never leaves a closed-but-unreplaced channel behind.
    if (this.isMock && minDeposit > MOCK_MAX_PER_CHANNEL) {
      const err: any = new Error(
        `SpendGuard not deployed (mock mode): simulated revert OverChannelCap ` +
          `(requested ${minDeposit}, maxAllowed ${MOCK_MAX_PER_CHANNEL})`
      );
      try {
        err.data = encodeErrorResult({
          abi: SpendGuardAbi,
          errorName: 'OverChannelCap',
          args: [minDeposit, MOCK_MAX_PER_CHANNEL],
        });
      } catch {
        err.data = '0x00000000';
      }
      console.warn(
        `[Agent ${this.account.address.slice(0, 8)}] [MOCK] SpendGuard not deployed — simulated: true; ` +
          `simulating revert OverChannelCap for deposit ${minDeposit} (cap ${MOCK_MAX_PER_CHANNEL})`
      );
      throw err;
    }

    const existing = this.activeChannels.get(key);
    if (existing) {
      if (existing.cumulativeAmount + minDeposit <= existing.deposit) {
        return existing.channelId;
      }
      // Remaining deposit cannot cover the next voucher: close the old channel
      // first so its funds are not locked/leaked, then open a fresh one.
      console.log(
        `[Agent ${this.account.address.slice(0, 8)}] Channel ${existing.channelId.slice(0, 10)}... exhausted ` +
          `(cumulative ${existing.cumulativeAmount}/${existing.deposit}); closing it before opening a new one`
      );
      await this.retireChannel(key, existing);
    }

    if (this.isMock) {
      const mockId = ('0x' + randomBytes(32).toString('hex')) as Hex;
      this.activeChannels.set(key, {
        channelId: mockId,
        cumulativeAmount: 0n,
        deposit: MOCK_MAX_PER_CHANNEL,
        payee,
        payeeAgentId,
      });
      console.log(
        `[Agent ${this.account.address.slice(0, 8)}] [MOCK] opened simulated channel ${mockId.slice(0, 10)}... ` +
          `(deposit: ${MOCK_MAX_PER_CHANNEL}, simulated: true)`
      );
      return mockId;
    }

    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const deposit = minDeposit > REAL_DEFAULT_DEPOSIT ? minDeposit : REAL_DEFAULT_DEPOSIT;

    // Pre-simulate so a policy rejection surfaces its named error instead of a
    // generic revert after a real (gas-burning) transaction is already sent.
    try {
      await this.client.simulateContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'openChannel',
        args: [payee, payeeAgentId, deposit, expiry],
        account: this.account,
      });
    } catch (err: any) {
      const decodedErr = decodeSpendGuardError(err);
      if (decodedErr) {
        console.error(`[Agent ${this.account.address.slice(0, 8)}] openChannel rejected by SpendGuard: ${decodedErr.errorName}`);
      }
      throw err;
    }

    try {
      const hash = await this.wallet.writeContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'openChannel',
        args: [payee, payeeAgentId, deposit, expiry],
        chain: monadTestnet,
        account: this.account,
        gas: 350_000n,
        ...TX_FEE_OVERRIDES,
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

      this.activeChannels.set(key, { channelId, cumulativeAmount: 0n, deposit, payee, payeeAgentId });
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

  async createVoucher(
    payee: Address,
    channelId: Hex,
    price: bigint
  ): Promise<{ cumulativeAmount: bigint; sig: Hex; channelId: Hex }> {
    let ch = this.findByChannelId(channelId);

    if (ch && ch.cumulativeAmount + price > ch.deposit) {
      // The channel cannot cover this voucher: ensureChannel closes the exhausted
      // channel first and opens a fresh one so spending can continue instead of
      // signing a voucher over the deposit.
      console.log(
        `[Agent ${this.account.address.slice(0, 8)}] Voucher of ${price} exceeds remaining deposit of ` +
          `${ch.channelId.slice(0, 10)}... (${ch.cumulativeAmount}/${ch.deposit}); rotating channel`
      );
      const key = this.channelKey(ch.payee, ch.payeeAgentId);
      await this.ensureChannel(ch.payee, ch.payeeAgentId, price);
      ch = this.activeChannels.get(key);
      if (!ch) {
        throw new Error(`Failed to open replacement channel for ${payee}`);
      }
    }

    if (!ch) {
      // Unknown channel: no local deposit to cap against, sign the requested amount.
      const sig = await signVoucher(this.account, { channelId, cumulativeAmount: price }, this.spendGuardAddress);
      return { cumulativeAmount: price, sig, channelId };
    }

    const uncapped = ch.cumulativeAmount + price;
    const newCumulative = uncapped > ch.deposit ? ch.deposit : uncapped; // never exceed the locked deposit

    const sig = await signVoucher(
      this.account,
      { channelId: ch.channelId, cumulativeAmount: newCumulative },
      this.spendGuardAddress
    );

    ch.cumulativeAmount = newCumulative;

    return { cumulativeAmount: newCumulative, sig, channelId: ch.channelId };
  }

  async closeChannel(channelId: Hex): Promise<CloseResult> {
    const key = [...this.activeChannels.entries()].find(([, ch]) => ch.channelId === channelId)?.[0];

    if (this.isMock) {
      if (key) this.activeChannels.delete(key);
      console.log(
        `[Agent ${this.account.address.slice(0, 8)}] [MOCK] simulated closeChannel ${channelId.slice(0, 10)}... ` +
          `(simulated: true — no contract deployed)`
      );
      return 'closed';
    }

    // Pre-simulate first: a reverted close burns gas and, more importantly, a
    // buyer attempting to close before expiry is an expected, benign outcome
    // (ChannelNotExpirableYet) that must be classified, not retried forever.
    try {
      await this.client.simulateContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'closeChannel',
        args: [channelId],
        account: this.account,
      });
    } catch (err: any) {
      const decoded = decodeSpendGuardError(err);
      if (decoded?.errorName === 'ChannelNotExpirableYet') {
        console.log(
          `[Agent ${this.account.address.slice(0, 8)}] closeChannel ${channelId.slice(0, 10)}... deferred — ` +
            `buyer may only close after expiry; payee settles it earlier`
        );
        return 'deferred';
      }
      console.error(
        `[Agent ${this.account.address.slice(0, 8)}] closeChannel simulation rejected for ${channelId}: ` +
          `${decoded?.errorName ?? (err?.message || err)}`
      );
      return 'failed';
    }

    try {
      const hash = await this.wallet.writeContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'closeChannel',
        args: [channelId],
        chain: monadTestnet,
        account: this.account,
        gas: 150_000n,
        ...TX_FEE_OVERRIDES,
      });
      const receipt = await this.client.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        console.error(`[Agent ${this.account.address.slice(0, 8)}] closeChannel tx reverted for ${channelId}`);
        return 'failed';
      }
      if (key) this.activeChannels.delete(key);
      console.log(`[Agent ${this.account.address.slice(0, 8)}] Closed channel ${channelId.slice(0, 10)}...`);
      return 'closed';
    } catch (err) {
      console.error(`[Agent ${this.account.address.slice(0, 8)}] Failed to close channel ${channelId}:`, err);
      return 'failed';
    }
  }

  // Close every channel still open (plus any whose close previously failed).
  // Returns the number of channels closed. Channels the buyer may not close yet
  // are reported as deferred and handed off to the payee for settlement.
  async closeAllChannels(): Promise<number> {
    let closed = 0;
    let deferred = 0;
    const stillOpen: Hex[] = [];
    const open = [...this.activeChannels.values()];
    if (open.length > 0) {
      console.log(`[Agent ${this.account.address.slice(0, 8)}] Closing ${open.length} still-open channel(s)...`);
    }

    for (const ch of open) {
      const result = await this.closeChannel(ch.channelId);
      if (result === 'closed') closed++;
      else if (result === 'deferred') deferred++;
      else stillOpen.push(ch.channelId);
    }
    this.activeChannels.clear();

    // Retry closes that failed in an earlier attempt.
    for (const channelId of this.pendingClose.splice(0)) {
      const result = await this.closeChannel(channelId);
      if (result === 'closed') closed++;
      else if (result === 'deferred') deferred++;
      else stillOpen.push(channelId);
    }
    this.pendingClose = stillOpen;

    if (deferred > 0) {
      console.log(
        `[Agent ${this.account.address.slice(0, 8)}] ${deferred} channel(s) still inside their expiry window — ` +
          `the payee (seller) settles them and refunds the remainder.`
      );
    }

    if (this.pendingClose.length > 0) {
      console.error(
        `[Agent ${this.account.address.slice(0, 8)}] ${this.pendingClose.length} channel(s) still unclosed: ` +
          this.pendingClose.join(', ')
      );
    }

    return closed;
  }
}
