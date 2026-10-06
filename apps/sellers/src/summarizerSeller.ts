import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type Hex } from 'viem';
import OpenAI from 'openai';
import { CONFIG, SUMMARIZER_SELLER_ACCOUNT } from './config.js';
import { VoucherVerifier } from './verify.js';
import { ClaimBatcher } from './batcher.js';

export function createSummarizerSellerApp() {
  const app = new Hono();
  app.use('*', cors());

  const verifier = new VoucherVerifier(CONFIG.RPC_URL, CONFIG.SPEND_GUARD_ADDRESS);
  const batcher = new ClaimBatcher({
    rpcUrl: CONFIG.RPC_URL,
    spendGuardAddress: CONFIG.SPEND_GUARD_ADDRESS,
    account: SUMMARIZER_SELLER_ACCOUNT,
    claimIntervalMs: 5000,
  });

  const openai = new OpenAI({
    apiKey: CONFIG.OPENAI_API_KEY,
    baseURL: CONFIG.OPENAI_BASE_URL,
  });

  const PRICE_PER_CALL = 1_000n; // $0.001 USDC (6 decimals)
  const PAYEE_AGENT_ID = 102n;

  // Agent Card metadata
  app.get('/card', (c) => {
    return c.json({
      name: 'SummarizerSeller',
      description: 'AI Text Summarization and Insights Service',
      endpoint: `http://localhost:${CONFIG.SUMMARIZER_SELLER_PORT}`,
      sellerAddress: SUMMARIZER_SELLER_ACCOUNT.address,
      payeeAgentId: Number(PAYEE_AGENT_ID),
      priceUSDC: '0.001',
      priceUnits: Number(PRICE_PER_CALL),
      minChannelDeposit: 50_000, // $0.05 USDC
      simulated: false,
    });
  });

  // Query endpoint with HTTP 402
  app.post('/query', async (c) => {
    const tStart = Date.now();
    const channelId = c.req.header('X-Channel-Id') as Hex;
    const voucherHeader = c.req.header('X-Voucher');

    if (!channelId || !voucherHeader) {
      return c.json(
        {
          error: 'Payment Required',
          message: 'State channel voucher required to access SummarizerSeller',
          payee: SUMMARIZER_SELLER_ACCOUNT.address,
          payeeAgentId: Number(PAYEE_AGENT_ID),
          priceUnits: Number(PRICE_PER_CALL),
          minChannelDeposit: 50_000,
        },
        402,
        {
          'WWW-Authenticate': 'Voucher realm="SummarizerSeller"',
          'X-Price': String(PRICE_PER_CALL),
        }
      );
    }

    try {
      let voucherPayload: { cumulativeAmount: string; sig: Hex };
      try {
        voucherPayload = JSON.parse(
          Buffer.from(voucherHeader, 'base64').toString('utf8')
        );
      } catch {
        voucherPayload = JSON.parse(voucherHeader);
      }

      const cumulativeAmount = BigInt(voucherPayload.cumulativeAmount);
      const sig = voucherPayload.sig;

      const verification = await verifier.verifyVoucher({
        channelId,
        cumulativeAmount,
        sig,
        price: PRICE_PER_CALL,
      });

      if (!verification.valid) {
        return c.json(
          {
            error: 'Invalid Payment Voucher',
            reason: verification.reason,
          },
          403
        );
      }

      batcher.recordVoucher(channelId, cumulativeAmount, sig);

      const body = await c.req.json().catch(() => ({}));
      const inputText = body?.text || 'No text provided.';

      let summary = '';
      if (CONFIG.OPENAI_API_KEY && CONFIG.OPENAI_API_KEY !== 'mock-key') {
        try {
          const completion = await openai.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
              {
                role: 'system',
                content: 'You are an ultra-fast summarizer agent. Provide a concise 2-sentence summary.',
              },
              { role: 'user', content: inputText },
            ],
            max_tokens: 150,
            temperature: 0,
          });
          summary = completion.choices[0]?.message?.content || 'Unable to generate summary.';
        } catch (e: any) {
          summary = `[Fast Fallback Summary]: ${inputText.slice(0, 120)}...`;
        }
      } else {
        // Fast local fallback summary
        summary = `[Fast Summary]: Key takeaways: ${inputText.slice(0, 100)}... (Processed ${inputText.length} chars)`;
      }

      const tEnd = Date.now();
      const latencyMs = tEnd - tStart;

      return c.json(
        {
          status: 'success',
          summary,
          charCount: inputText.length,
          verificationLatencyMs: latencyMs,
          cumulativePaid: String(cumulativeAmount),
        },
        200,
        {
          'X-Served-By': 'SummarizerSeller-8102',
          'X-Voucher-Latency-Ms': String(latencyMs),
        }
      );
    } catch (err: any) {
      return c.json({ error: 'Internal Error', message: err?.message }, 500);
    }
  });

  return { app, batcher };
}
