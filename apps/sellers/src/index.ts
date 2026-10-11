import { serve } from '@hono/node-server';
import { CONFIG } from './config.js';
import { createDataSellerApp } from './dataSeller.js';
import { createSummarizerSellerApp } from './summarizerSeller.js';

console.log('--- Starting AgentMesh Seller Microservices ---');

// Start DataSeller on port 8101
const { app: dataApp, batcher: dataBatcher } = createDataSellerApp();
serve(
  {
    fetch: dataApp.fetch,
    port: CONFIG.DATA_SELLER_PORT,
  },
  (info) => {
    console.log(`[DataSeller] Running on http://localhost:${info.port} (simulated sentiment @ $0.0001)`);
  }
);

// Start SummarizerSeller on port 8102
const { app: summarizerApp, batcher: summarizerBatcher } = createSummarizerSellerApp();
serve(
  {
    fetch: summarizerApp.fetch,
    port: CONFIG.SUMMARIZER_SELLER_PORT,
  },
  (info) => {
    console.log(`[SummarizerSeller] Running on http://localhost:${info.port} (AI summarizer @ $0.001)`);
  }
);

async function shutdown(signal: string) {
  console.log(`[Seller] Received ${signal}, settling channels and shutting down...`);
  try {
    await Promise.all([dataBatcher?.settleAndClose(), summarizerBatcher?.settleAndClose()]);
  } catch (err: any) {
    console.error(`[Seller] Error during settlement:`, err?.message || err);
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
