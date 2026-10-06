import { MongoClient, Db } from 'mongodb';
import { CONFIG } from './config.js';

export interface AgentRecord {
  address: string;
  role: string;
  tier: 'A' | 'B' | 'C';
  erc8004Id: number;
  budgetLimit: number;
  budgetSpent: number;
  active: boolean;
}

export interface MetricSnapshot {
  totalCalls: number;
  totalVolumeUSDC: number;
  onChainTxCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  rejectedCount: number;
}

export class TelemetryStore {
  private db: Db | null = null;
  private agents = new Map<string, AgentRecord>();
  private latencies: number[] = [];
  private totalVolumeUSDC = 0;
  private onChainTxCount = 0;
  private rejectedCount = 0;

  async init() {
    if (CONFIG.MONGODB_URI) {
      try {
        const client = new MongoClient(CONFIG.MONGODB_URI);
        await client.connect();
        this.db = client.db('agentmesh');
        console.log('[Mongo] Connected to MongoDB Atlas');
      } catch (err: any) {
        console.warn('[Mongo] Connection failed, using in-memory telemetry:', err.message);
      }
    } else {
      console.log('[Store] Using in-memory telemetry store');
    }

    // Initialize default agents
    this.agents.set('0x395df680ab16857189d6dd5ab7b0e3775f3bdec750b305087f466477a8355d51', {
      address: '0x011CE11111111111111111111111111111111111',
      role: 'Sentiment Buyer (Deterministic)',
      tier: 'A',
      erc8004Id: 201,
      budgetLimit: 50.0,
      budgetSpent: 0.12,
      active: true,
    });
    this.agents.set('0xea6c44ac03da85d990f1f70d3007436ea927867651f9a13dec45f42e2315b0b8', {
      address: '0x022CE22222222222222222222222222222222222',
      role: 'Macro Research Planner (5% LLM)',
      tier: 'B',
      erc8004Id: 202,
      budgetLimit: 50.0,
      budgetSpent: 0.45,
      active: true,
    });
    this.agents.set('0xae441c0ea58a74e50d51ef7dcae7c7e997a3ebf50125bb7e29cb011708173456', {
      address: '0x033CE33333333333333333333333333333333333',
      role: 'Autonomous Tool Executor (Prompt-Injection Target)',
      tier: 'C',
      erc8004Id: 203,
      budgetLimit: 50.0,
      budgetSpent: 0.88,
      active: true,
    });
  }

  recordCall(latencyMs: number, priceUSDC: number) {
    this.latencies.push(latencyMs);
    this.totalVolumeUSDC += priceUSDC;
  }

  recordTx() {
    this.onChainTxCount += 1;
  }

  recordRejection() {
    this.rejectedCount += 1;
  }

  getMetrics(): MetricSnapshot {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const p50 = count > 0 ? sorted[Math.floor(count * 0.5)] : 42;
    const p95 = count > 0 ? sorted[Math.floor(count * 0.95)] : 120;

    return {
      totalCalls: count,
      totalVolumeUSDC: +this.totalVolumeUSDC.toFixed(4),
      onChainTxCount: this.onChainTxCount,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      rejectedCount: this.rejectedCount,
    };
  }

  getAgents(): AgentRecord[] {
    return Array.from(this.agents.values());
  }

  setAgentActive(address: string, active: boolean) {
    for (const [k, v] of this.agents.entries()) {
      if (v.address.toLowerCase() === address.toLowerCase()) {
        v.active = active;
        break;
      }
    }
  }
}

export const telemetry = new TelemetryStore();
