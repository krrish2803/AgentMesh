import {
  type Address,
  createPublicClient,
  http,
  parseAbiItem,
} from 'viem';
import { monadTestnet, SpendGuardAbi } from '@agentmesh/sdk';
import { CONFIG } from './config.js';
import { eventHub } from './ws.js';
import { telemetry } from './state.js';

export class ChainListener {
  private client: ReturnType<typeof createPublicClient>;
  private spendGuardAddress: Address;
  private isListening = false;
  private timer: NodeJS.Timeout | null = null;
  private lastBlockChecked: bigint = 0n;

  constructor() {
    this.spendGuardAddress = CONFIG.SPEND_GUARD_ADDRESS;
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(CONFIG.RPC_URL),
    });
  }

  async start() {
    if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') {
      console.log('[Listener] SpendGuard not deployed yet, skipping on-chain watcher.');
      return;
    }

    try {
      this.lastBlockChecked = await this.client.getBlockNumber();
      console.log(`[Listener] Starting chain poller at block ${this.lastBlockChecked}`);

      this.timer = setInterval(async () => {
        try {
          const currentBlock = await this.client.getBlockNumber();
          if (currentBlock > this.lastBlockChecked) {
            // Check logs
            const logs = await this.client.getLogs({
              address: this.spendGuardAddress,
              fromBlock: this.lastBlockChecked + 1n,
              toBlock: currentBlock,
            });

            for (const log of logs) {
              telemetry.recordTx();
              eventHub.broadcast('chain.log', {
                blockNumber: Number(log.blockNumber),
                txHash: log.transactionHash,
                topics: log.topics,
              });
            }

            this.lastBlockChecked = currentBlock;
          }
        } catch (err: any) {
          // Keep polling quietly
        }
      }, 3000);
    } catch (e: any) {
      console.warn('[Listener] Could not start poller:', e.message);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export const chainListener = new ChainListener();
