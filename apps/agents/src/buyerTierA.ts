import { type PrivateKeyAccount } from 'viem/accounts';
import { CONFIG } from './config.js';
import { AgentChannelManager } from './channelManager.js';

export class DeterministicBuyer {
  private account: PrivateKeyAccount;
  private channelManager: AgentChannelManager;
  private isRunning = false;

  constructor(account: PrivateKeyAccount) {
    this.account = account;
    this.channelManager = new AgentChannelManager(
      CONFIG.RPC_URL,
      CONFIG.SPEND_GUARD_ADDRESS,
      this.account
    );
  }

  async fetchSellerCard(url: string) {
    const res = await fetch(`${url}/card`);
    return res.json();
  }

  async executeCall(sellerUrl: string): Promise<any> {
    const card = await this.fetchSellerCard(sellerUrl);
    const payee = card.sellerAddress;
    const payeeAgentId = BigInt(card.payeeAgentId);
    const price = BigInt(card.priceUnits);
    const minDeposit = BigInt(card.minChannelDeposit);

    // 1. Initial 402 ping or channel check
    const channelId = await this.channelManager.ensureChannel(payee, payeeAgentId, minDeposit);

    // 2. Generate signed voucher
    const { cumulativeAmount, sig } = await this.channelManager.createVoucher(payee, channelId, price);

    const voucherHeader = Buffer.from(
      JSON.stringify({
        cumulativeAmount: String(cumulativeAmount),
        sig,
      })
    ).toString('base64');

    // 3. Paid call with voucher header
    const tStart = Date.now();
    const res = await fetch(`${sellerUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Channel-Id': channelId,
        'X-Voucher': voucherHeader,
      },
      body: JSON.stringify({ text: 'Monad high-throughput parallel execution update.' }),
    });

    const data = await res.json();
    const latency = Date.now() - tStart;

    return {
      agent: this.account.address,
      tier: 'A',
      seller: card.name,
      status: res.status,
      latencyMs: latency,
      data,
    };
  }

  async runLoop(iterations = 10, intervalMs = 1500) {
    this.isRunning = true;
    console.log(`[Tier A Buyer ${this.account.address.slice(0, 8)}] Starting loop (${iterations} calls)...`);

    for (let i = 0; i < iterations && this.isRunning; i++) {
      try {
        const targetUrl = i % 2 === 0 ? CONFIG.DATA_SELLER_URL : CONFIG.SUMMARIZER_SELLER_URL;
        const result = await this.executeCall(targetUrl);
        console.log(`[Tier A Call #${i + 1}] Target: ${result.seller} -> Latency: ${result.latencyMs}ms -> Status: ${result.status}`);
      } catch (err: any) {
        console.error(`[Tier A Call #${i + 1}] Error:`, err?.message || err);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  stop() {
    this.isRunning = false;
  }
}
