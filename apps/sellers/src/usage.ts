const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8005';

export function reportUsage(params: {
  seller: string;
  priceUnits: bigint;
  latencyMs: number;
  buyer?: string;
  channelId?: string;
}): void {
  fetch(`${SERVER_URL}/api/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seller: params.seller,
      priceUSDC: Number(params.priceUnits) / 1e6,
      latencyMs: params.latencyMs,
      buyer: params.buyer,
      channelId: params.channelId,
    }),
  }).catch(() => {
    /* telemetry is best-effort; never fail the paid response */
  });
}
