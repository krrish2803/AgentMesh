import { type PrivateKeyAccount } from 'viem/accounts';
import OpenAI from 'openai';
import { CONFIG } from './config.js';
import { AgentChannelManager } from './channelManager.js';

export class PlannerBuyer {
  private account: PrivateKeyAccount;
  private channelManager: AgentChannelManager;
  private openai: OpenAI;
  private isRunning = false;

  constructor(account: PrivateKeyAccount) {
    this.account = account;
    this.channelManager = new AgentChannelManager(
      CONFIG.RPC_URL,
      CONFIG.SPEND_GUARD_ADDRESS,
      this.account
    );
    this.openai = new OpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
      baseURL: CONFIG.OPENAI_BASE_URL,
    });
  }

  async planChoice(taskDescription: string, sellerCards: any[]): Promise<string> {
    if (!CONFIG.OPENAI_API_KEY || CONFIG.OPENAI_API_KEY === 'mock-key') {
      // Deterministic planning fallback
      return taskDescription.toLowerCase().includes('sentiment') || taskDescription.toLowerCase().includes('data')
        ? CONFIG.DATA_SELLER_URL
        : CONFIG.SUMMARIZER_SELLER_URL;
    }

    try {
      const prompt = `You are a financial procurement planner agent.
Given these sellers:
${JSON.stringify(sellerCards, null, 2)}

Task: "${taskDescription}"

Which seller endpoint should be hired? Return JSON: {"selectedEndpoint": "url", "rationale": "short explanation"}`;

      const res = await this.openai.chat.completions.create({
        model: CONFIG.OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const parsed = JSON.parse(res.choices[0].message.content || '{}');
      return parsed.selectedEndpoint || CONFIG.DATA_SELLER_URL;
    } catch {
      return CONFIG.DATA_SELLER_URL;
    }
  }

  // Returns the number of iterations that failed.
  async runLoop(iterations = 5, intervalMs = 2500): Promise<number> {
    this.isRunning = true;
    let failures = 0;
    console.log(`[Tier B Planner ${this.account.address.slice(0, 8)}] Starting planning loop...`);

    const tasks = [
      'Need sentiment score for latest MON token movement',
      'Summarize quarterly network throughput on Monad testnet',
      'Check macro crypto volatility indicators',
      'Provide concise briefing on EVM parallel state transition',
    ];

    for (let i = 0; i < iterations && this.isRunning; i++) {
      try {
        const task = tasks[i % tasks.length];
        const cards = await Promise.all([
          fetch(`${CONFIG.DATA_SELLER_URL}/card`).then((r) => r.json()),
          fetch(`${CONFIG.SUMMARIZER_SELLER_URL}/card`).then((r) => r.json()),
        ]);

        const chosenEndpoint = await this.planChoice(task, cards);
        const card = cards.find((c) => chosenEndpoint.includes(c.endpoint)) || cards[0];

        const channelId = await this.channelManager.ensureChannel(
          card.sellerAddress,
          BigInt(card.payeeAgentId),
          BigInt(card.minChannelDeposit)
        );

        const { cumulativeAmount, sig, channelId: activeChannelId } = await this.channelManager.createVoucher(
          card.sellerAddress,
          channelId,
          BigInt(card.priceUnits)
        );

        const voucherHeader = Buffer.from(
          JSON.stringify({ cumulativeAmount: String(cumulativeAmount), sig })
        ).toString('base64');

        const tStart = Date.now();
        const res = await fetch(`${card.endpoint}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Channel-Id': activeChannelId,
            'X-Voucher': voucherHeader,
          },
          body: JSON.stringify({ text: task }),
        });

        await res.json();
        if (res.status < 200 || res.status >= 300) failures++;
        console.log(`[Tier B Plan #${i + 1}] Task: "${task.slice(0, 30)}..." -> Hired: ${card.name} (${Date.now() - tStart}ms)`);
      } catch (err: any) {
        failures++;
        console.error(`[Tier B Plan #${i + 1}] Error:`, err?.message || err);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    return failures;
  }

  stop() {
    this.isRunning = false;
  }

  async closeAllChannels(): Promise<number> {
    return this.channelManager.closeAllChannels();
  }
}
