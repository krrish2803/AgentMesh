import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type Hex } from 'viem';
import { CONFIG, DATA_SELLER_ACCOUNT } from './config.js';
import { VoucherVerifier } from './verify.js';
import { ClaimBatcher } from './batcher.js';
import { reportUsage } from './usage.js';

export function createDataSellerApp() {
  const app = new Hono();
  app.use('*', cors());

  const verifier = new VoucherVerifier(CONFIG.RPC_URL, CONFIG.SPEND_GUARD_ADDRESS);
  const batcher = new ClaimBatcher({
    rpcUrl: CONFIG.RPC_URL,
    spendGuardAddress: CONFIG.SPEND_GUARD_ADDRESS,
    account: DATA_SELLER_ACCOUNT,
    claimIntervalMs: 5000,
  });

  const PRICE_PER_CALL = 100n; // $0.0001 USDC (6 decimals)
  const PAYEE_AGENT_ID = CONFIG.DATA_SELLER_AGENT_ID;

  // Agent Card metadata
  app.get('/card', (c) => {
    return c.json({
      name: 'DataSeller',
      description: 'Real-time headline financial sentiment feed (simulated data)',
      endpoint: `http://localhost:${CONFIG.DATA_SELLER_PORT}`,
      sellerAddress: DATA_SELLER_ACCOUNT.address,
      payeeAgentId: Number(PAYEE_AGENT_ID),
      priceUSDC: '0.0001',
      priceUnits: Number(PRICE_PER_CALL),
      minChannelDeposit: 10_000, // $0.01 USDC
      simulated: true,
    });
  });

  // Query endpoint with HTTP 402 Payment Required
  app.post('/query', async (c) => {
    const tStart = Date.now();
    const channelId = c.req.header('X-Channel-Id') as Hex;
    const voucherHeader = c.req.header('X-Voucher');

    if (!channelId || !voucherHeader) {
      return c.json(
        {
          error: 'Payment Required',
          message: 'State channel voucher required to access DataSeller',
          payee: DATA_SELLER_ACCOUNT.address,
          payeeAgentId: Number(PAYEE_AGENT_ID),
          priceUnits: Number(PRICE_PER_CALL),
          minChannelDeposit: 10_000,
        },
        402,
        {
          'WWW-Authenticate': 'Voucher realm="DataSeller"',
          'X-Price': String(PRICE_PER_CALL),
        }
      );
    }

    try {
      let voucherPayload: { cumulativeAmount: string; sig: Hex };
      try {
        try {
          voucherPayload = JSON.parse(
            Buffer.from(voucherHeader, 'base64').toString('utf8')
          );
        } catch {
          voucherPayload = JSON.parse(voucherHeader);
        }
      } catch (e: any) {
        return c.json(
          { error: 'Bad Request', message: `Invalid voucher format: ${e?.message}` },
          400
        );
      }

      let cumulativeAmount: bigint;
      let sig: Hex;
      try {
        cumulativeAmount = BigInt(voucherPayload.cumulativeAmount);
        sig = voucherPayload.sig;
      } catch (e: any) {
        return c.json(
          { error: 'Bad Request', message: `Invalid voucher fields: ${e?.message}` },
          400
        );
      }

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

      // Record voucher into batcher
      batcher.recordVoucher(channelId, cumulativeAmount, sig);

      const tEnd = Date.now();
      const latencyMs = tEnd - tStart;

      const sampleTickers = ['BTC', 'ETH', 'MON', 'SOL', 'NVDA'];
      const ticker = sampleTickers[Math.floor(Math.random() * sampleTickers.length)];
      const sentimentScore = +(Math.random() * 2 - 1).toFixed(3); // -1.0 to 1.0
      const clientAddress = verification.channel?.agent || '0x011CE11111111111111111111111111111111111';

      const nonce = Date.now();
      const feedbackAuth = {
        payee: DATA_SELLER_ACCOUNT.address,
        payeeAgentId: Number(PAYEE_AGENT_ID),
        channelId,
        cumulativeAmount: String(cumulativeAmount),
        client: clientAddress,
        nonce,
        sig: await DATA_SELLER_ACCOUNT.signMessage({
          message: `ERC8004_FEEDBACK_AUTH:${PAYEE_AGENT_ID}:${channelId}:${cumulativeAmount}:${clientAddress}:${nonce}`,
        }),
      };

      const result = {
        ticker,
        sentiment: sentimentScore > 0.1 ? 'bullish' : sentimentScore < -0.1 ? 'bearish' : 'neutral',
        score: sentimentScore,
        timestamp: new Date().toISOString(),
        isSimulated: true,
      };

      reportUsage({
        seller: 'DataSeller',
        priceUnits: PRICE_PER_CALL,
        latencyMs,
        buyer: clientAddress,
        channelId,
      });

      return c.json(
        {
          status: 'success',
          result,
          feedbackAuth,
          verificationLatencyMs: latencyMs,
          cumulativePaid: String(cumulativeAmount),
        },
        200,
        {
          'X-Served-By': 'DataSeller-8101',
          'X-Voucher-Latency-Ms': String(latencyMs),
        }
      );
    } catch (err: any) {
      return c.json({ error: 'Internal Error', message: err?.message }, 500);
    }
  });

  return { app, batcher };
}
