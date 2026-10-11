import {
  type Address,
  createPublicClient,
  decodeEventLog,
  formatUnits,
  http,
} from 'viem';
import { monadTestnet, SpendGuardAbi } from '@agentmesh/sdk';
import { CONFIG } from './config.js';
import { eventHub } from './ws.js';
import { telemetry } from './state.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_BLOCK_RANGE = 100n;
const ERROR_LOG_INTERVAL_MS = 60_000;
const EXPLORER_BASE = 'https://testnet.monadscan.com';

function txUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

function usdc(units: bigint): string {
  return formatUnits(units, 6);
}

export class ChainListener {
  private client: ReturnType<typeof createPublicClient>;
  private spendGuardAddress: Address;
  private timer: NodeJS.Timeout | null = null;
  private lastBlockChecked: bigint = 0n;
  private isPolling = false;
  private lastErrorMessage: string | null = null;
  private lastErrorLogAt = 0;

  constructor() {
    this.spendGuardAddress = CONFIG.SPEND_GUARD_ADDRESS;
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(CONFIG.RPC_URL),
    });
  }

  async start() {
    if ((this.spendGuardAddress as string).toLowerCase() === ZERO_ADDRESS) {
      console.log('[Listener] SpendGuard not deployed yet, skipping on-chain watcher.');
      return;
    }

    try {
      this.lastBlockChecked = await this.client.getBlockNumber();
      console.log(`[Listener] Starting chain poller at block ${this.lastBlockChecked}`);

      this.timer = setInterval(() => {
        void this.poll();
      }, 3000);

      void this.backfillRecentChannels(this.lastBlockChecked);
    } catch (e: any) {
      console.warn('[Listener] Could not start poller:', e.message);
    }
  }

  // Best-effort: seed the open-channel registry with channels that were opened
  // before this process started, so scenario 6 works right after a restart.
  private async backfillRecentChannels(latest: bigint) {
    const chunks = 60n;
    const chunkSize = MAX_BLOCK_RANGE;
    let toBlock = latest;
    let registered = 0;

    for (let attempt = 0; attempt < 3 && registered === 0; attempt++) {
      toBlock = latest;
      for (let i = 0n; i < chunks && toBlock >= 0n; i++) {
        const fromBlock = toBlock >= chunkSize ? toBlock - chunkSize + 1n : 0n;
        try {
          const logs = await this.client.getLogs({
            address: this.spendGuardAddress,
            fromBlock,
            toBlock,
          });
          for (const log of logs) {
            try {
              const parsed: any = decodeEventLog({
                abi: SpendGuardAbi,
                data: log.data,
                topics: log.topics,
              });
              if (parsed.eventName === 'ChannelOpened') {
                const { channelId, payee, deposit, expiry } = parsed.args;
                telemetry.registerChannel({
                  channelId,
                  payee,
                  deposit,
                  expiry,
                  blockNumber: Number(log.blockNumber),
                });
                registered += 1;
              }
            } catch {}
          }
        } catch (err: any) {
          this.logPollError(err);
        }
        if (fromBlock === 0n) break;
        toBlock = fromBlock - 1n;
      }
    }

    if (registered > 0) {
      console.log(`[Listener] Backfilled ${registered} channel(s) into the open-channel registry`);
    }
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const currentBlock = await this.client.getBlockNumber();
      while (this.lastBlockChecked < currentBlock) {
        const fromBlock = this.lastBlockChecked + 1n;
        const maxToBlock = fromBlock + MAX_BLOCK_RANGE - 1n;
        const toBlock = maxToBlock > currentBlock ? currentBlock : maxToBlock;

        const logs = await this.client.getLogs({
          address: this.spendGuardAddress,
          fromBlock,
          toBlock,
        });

        const seenTxHashes = new Set<string>();
        for (const log of logs) {
          const txHash = log.transactionHash;
          if (!seenTxHashes.has(txHash)) {
            seenTxHashes.add(txHash);
            telemetry.recordTx();
          }
          this.broadcastDecoded(log.transactionHash, Number(log.blockNumber), log);
        }

        this.lastBlockChecked = toBlock;
      }
      this.lastErrorMessage = null;
    } catch (err: any) {
      this.logPollError(err);
    } finally {
      this.isPolling = false;
    }
  }

  private broadcastDecoded(txHash: string, blockNumber: number, log: any) {
    let decoded: any;
    try {
      decoded = decodeEventLog({
        abi: SpendGuardAbi,
        data: log.data,
        topics: log.topics,
      });
    } catch {
      eventHub.broadcast('chain.log', {
        blockNumber,
        txHash,
        explorerUrl: txUrl(txHash),
        topics: log.topics,
        topic0: log.topics?.[0],
      });
      return;
    }

    const base = { txHash, explorerUrl: txUrl(txHash), blockNumber };

    switch (decoded.eventName) {
      case 'ChannelOpened': {
        const { channelId, agent, payee, payeeAgentId, deposit, expiry } = decoded.args as any;
        telemetry.registerChannel({
          channelId,
          payee,
          deposit,
          expiry,
          blockNumber,
        });
        eventHub.broadcast('channel.opened', {
          ...base,
          channelId,
          agent,
          payee,
          payeeAgentId: Number(payeeAgentId),
          deposit: deposit.toString(),
          depositUSDC: usdc(deposit),
          expiry: Number(expiry),
        });
        break;
      }
      case 'Claimed': {
        const { channelId, payee, cumulativeAmount, delta } = decoded.args as any;
        eventHub.broadcast('claim.confirmed', {
          ...base,
          channelId,
          payee,
          cumulativeAmount: cumulativeAmount.toString(),
          cumulativeUSDC: usdc(cumulativeAmount),
          delta: delta.toString(),
          deltaUSDC: usdc(delta),
        });
        break;
      }
      case 'ChannelClosed': {
        const { channelId, claimed, refunded } = decoded.args as any;
        telemetry.removeChannel(channelId);
        eventHub.broadcast('channel.closed', {
          ...base,
          channelId,
          claimed: claimed.toString(),
          claimedUSDC: usdc(claimed),
          refunded: refunded.toString(),
          refundedUSDC: usdc(refunded),
        });
        break;
      }
      case 'VaultFunded': {
        const { amount, newBalance } = decoded.args as any;
        eventHub.broadcast('vault.funded', {
          ...base,
          amount: amount.toString(),
          amountUSDC: usdc(amount),
          newBalance: newBalance.toString(),
          newBalanceUSDC: usdc(newBalance),
        });
        break;
      }
      case 'VaultWithdrawn': {
        const { owner, amount, newBalance } = decoded.args as any;
        eventHub.broadcast('vault.withdrawn', {
          ...base,
          owner,
          amount: amount.toString(),
          amountUSDC: usdc(amount),
          newBalance: newBalance.toString(),
          newBalanceUSDC: usdc(newBalance),
        });
        break;
      }
      case 'AgentRevokedEvent': {
        const { agent } = decoded.args as any;
        eventHub.broadcast('agent.revoked', { ...base, address: agent });
        break;
      }
      case 'PolicySet': {
        const { agent } = decoded.args as any;
        eventHub.broadcast('agent.policy', { ...base, address: agent });
        break;
      }
      default: {
        eventHub.broadcast('chain.log', {
          ...base,
          eventName: decoded.eventName,
          topics: log.topics,
        });
      }
    }
  }

  private logPollError(err: any) {
    const message = err?.message || String(err);
    const now = Date.now();
    if (message !== this.lastErrorMessage || now - this.lastErrorLogAt >= ERROR_LOG_INTERVAL_MS) {
      console.warn(`[Listener] Poll error: ${message}`);
      this.lastErrorMessage = message;
      this.lastErrorLogAt = now;
    }
  }

  async getVaultBalance(): Promise<string | null> {
    if ((this.spendGuardAddress as string).toLowerCase() === ZERO_ADDRESS) {
      return '1000.00';
    }
    try {
      const balance = (await this.client.readContract({
        address: this.spendGuardAddress,
        abi: SpendGuardAbi,
        functionName: 'vaultBalance',
      })) as bigint;
      const [whole, frac = ''] = formatUnits(balance, 6).split('.');
      return `${whole}.${frac.padEnd(2, '0')}`;
    } catch (err: any) {
      console.warn(`[Listener] vaultBalance read failed: ${err?.message || err}`);
      return null;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export const chainListener = new ChainListener();
