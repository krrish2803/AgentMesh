import { createServer } from 'http';
import {
  createPublicClient,
  decodeEventLog,
  http,
} from 'viem';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  monadTestnet,
  SpendGuardAbi,
  ReputationRegistryAbi,
  decodeSpendGuardError,
} from '@agentmesh/sdk';
import { CONFIG } from './config.js';
import { eventHub } from './ws.js';
import { telemetry } from './state.js';
import { chainListener } from './listener.js';
import {
  controlConfigured,
  readAgents,
  readVault,
  fundVault,
  setAgentActive,
  withRetry,
} from './control.js';

console.log('--- Starting AgentMesh Telemetry & Coordination Server ---');

const app = new Hono();

app.use('*', cors({ origin: CONFIG.DASHBOARD_ORIGIN, credentials: true }));

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EXPLORER_BASE = 'https://testnet.monadscan.com';
const CONTRACT_EXPLORER_URL = `${EXPLORER_BASE}/address/${CONFIG.SPEND_GUARD_ADDRESS}`;

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(CONFIG.RPC_URL),
});

const SEED_AGENT = '0x011cE11111111111111111111111111111111111';
const DEFAULT_PAYEE = '0x1111111111111111111111111111111111111111';
const UNREGISTERED_PAYEE = '0x9999999999999999999999999999999999999999';
const POLICY_LESS_AGENT = '0x000000000000000000000000000000000000dEaD';
const ZERO_SIG = ('0x' + '0'.repeat(130)) as `0x${string}`;

// 1. Health check
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// 2. Dashboard bootstrap snapshot (/api/state)
app.get('/api/state', async (c) => {
  return c.json({
    network: 'Monad Testnet (10143)',
    spendGuard: CONFIG.SPEND_GUARD_ADDRESS,
    usdc: CONFIG.USDC_ADDRESS,
    vaultBalance: await chainListener.getVaultBalance(),
    currentRun: telemetry.getCurrentRun(),
    agents: telemetry.getAgents(),
    metrics: telemetry.getMetrics(),
    recentEvents: eventHub.getRecentEvents(30),
  });
});

// 3. Create buyer agent key (/api/agents) - POST
app.post('/api/agents', async (c) => {
  const body = await c.req.json().catch(() => ({}) as any);
  const role = body.role || 'Autonomous Buyer';
  const tier = body.tier || 'A';
  const { agent } = telemetry.createAgent(role, tier);
  const event = eventHub.broadcast('agent.created', {
    address: agent.address,
    role: agent.role,
    tier: agent.tier,
    erc8004Id: agent.erc8004Id,
    budgetLimit: agent.budgetLimit,
    timestamp: Date.now(),
  });
  return c.json(
    {
      success: true,
      agent,
      event,
    },
    201
  );
});

// 4. List the live buyer swarm with real on-chain policy/spend (/api/agents) - GET
app.get('/api/agents', async (c) => {
  try {
    return c.json({ agents: await readAgents(), control: controlConfigured() });
  } catch (err: any) {
    return c.json(
      { agents: [], control: controlConfigured(), error: String(err?.message || err) },
      502
    );
  }
});

// 4b. Owner vault balance + owner wallet balance (/api/vault) - GET
app.get('/api/vault', async (c) => {
  try {
    return c.json({ ...(await readVault()), control: controlConfigured() });
  } catch (err: any) {
    return c.json({ error: String(err?.message || err) }, 502);
  }
});

// 4c. Owner funds the vault with real USDC (/api/vault/fund) - POST
app.post('/api/vault/fund', async (c) => {
  const body = await c.req.json().catch(() => ({}) as any);
  const amountUSDC =
    typeof body.amountUSDC === 'number' && body.amountUSDC > 0 ? body.amountUSDC : 1;
  try {
    const result = await fundVault(amountUSDC);
    return c.json({ status: 'funded', ...result });
  } catch (err: any) {
    return c.json(
      { status: 'failed', error: String(err?.details || err?.shortMessage || err?.message || err) },
      400
    );
  }
});

// 4d. Owner revokes / reinstates an agent on-chain - POST
app.post('/api/agents/:address/revoke', async (c) => {
  const address = c.req.param('address') as `0x${string}`;
  try {
    const result = await setAgentActive(address, false);
    return c.json({ status: 'revoked', address, ...result });
  } catch (err: any) {
    return c.json(
      { status: 'failed', error: String(err?.details || err?.shortMessage || err?.message || err) },
      400
    );
  }
});

app.post('/api/agents/:address/reinstate', async (c) => {
  const address = c.req.param('address') as `0x${string}`;
  try {
    const result = await setAgentActive(address, true);
    return c.json({ status: 'reinstated', address, ...result });
  } catch (err: any) {
    return c.json(
      { status: 'failed', error: String(err?.details || err?.shortMessage || err?.message || err) },
      400
    );
  }
});

// 5. Control a scenario (/api/runs/start and /api/runs/stop)
app.post('/api/runs/start', async (c) => {
  const body = await c.req.json().catch(() => ({}) as any);
  const scenario = body.scenario || 'normal';
  const run = telemetry.startRun(scenario);
  const event = eventHub.broadcast('run.started', {
    runId: run.runId,
    scenario: run.scenario,
    startedAt: run.startedAt,
  });
  return c.json({ status: 'started', run, event });
});

app.post('/api/runs/stop', async (c) => {
  const run = telemetry.stopRun();
  if (!run) {
    return c.json(
      {
        status: 'no-active-run',
        run: telemetry.getCurrentRun(),
        error: 'No running run to stop',
      },
      409
    );
  }
  const event = eventHub.broadcast('run.stopped', {
    runId: run.runId,
    scenario: run.scenario,
    stoppedAt: run.stoppedAt,
  });
  return c.json({ status: 'stopped', run, event });
});

// 6. Metrics (/api/metrics)
app.get('/api/metrics', (c) => {
  return c.json(telemetry.getMetrics());
});

const SELLER_DIRECTORY = [
  { agentId: CONFIG.DATA_SELLER_AGENT_ID, name: 'DataSeller', address: CONFIG.DATA_SELLER },
  { agentId: CONFIG.SUMMARIZER_SELLER_AGENT_ID, name: 'SummarizerSeller', address: CONFIG.SUMMARIZER_SELLER },
  { agentId: CONFIG.LOW_REP_AGENT_ID, name: 'UnverifiedSeller (Rogue Target)', address: CONFIG.LOW_REP_PAYEE },
];

function reputationTier(score: number, feedbackCount: number, name: string): string {
  if (feedbackCount <= 0) return 'Untrusted (No Feedback Yet)';
  if (score >= 90) return name.startsWith('Data') ? 'Verified Data Provider' : 'Verified LLM Service';
  if (score >= 60) return 'Established';
  return 'Low Reputation';
}

async function readPayeeReputation(
  agentId: bigint
): Promise<{ count: bigint; score: bigint; decimals: number }> {
  const clients = (await withRetry(() =>
    publicClient.readContract({
      address: CONFIG.REPUTATION_REGISTRY_ADDRESS,
      abi: ReputationRegistryAbi,
      functionName: 'getClients',
      args: [agentId],
    })
  )) as unknown as readonly `0x${string}`[];
  if (clients.length === 0) return { count: 0n, score: 0n, decimals: 0 };

  const [count, score, decimals] = (await withRetry(() =>
    publicClient.readContract({
      address: CONFIG.REPUTATION_REGISTRY_ADDRESS,
      abi: ReputationRegistryAbi,
      functionName: 'getSummary',
      args: [agentId, clients, '', ''],
    })
  )) as unknown as readonly [bigint, bigint, number];

  return { count, score, decimals };
}

async function readPayeeStats(payee: `0x${string}`): Promise<{ volume: bigint; payers: bigint }> {
  const [volume, payers] = (await Promise.all([
    withRetry(() =>
      publicClient.readContract({
        address: CONFIG.SPEND_GUARD_ADDRESS,
        abi: SpendGuardAbi,
        functionName: 'settledVolume',
        args: [payee],
      })
    ),
    withRetry(() =>
      publicClient.readContract({
        address: CONFIG.SPEND_GUARD_ADDRESS,
        abi: SpendGuardAbi,
        functionName: 'uniquePayers',
        args: [payee],
      })
    ),
  ])) as unknown as readonly [bigint, bigint];
  return { volume, payers };
}

async function readSellerReputations() {
  const rows: any[] = [];
  for (const entry of SELLER_DIRECTORY) {
    if (!entry.address || entry.address === ZERO_ADDRESS) {
      rows.push({
        agentId: Number(entry.agentId),
        name: entry.name,
        address: ZERO_ADDRESS,
        score: 0,
        settledVolumeUSDC: '0.00',
        uniquePayers: 0,
        feedbackCount: 0,
        tier: 'Not Configured (add seller key to .env)',
      });
      continue;
    }

    const [rep, stats] = await Promise.all([
      readPayeeReputation(entry.agentId),
      readPayeeStats(entry.address),
    ]);
    const score = rep.decimals > 0 ? Number(rep.score) / 10 ** rep.decimals : Number(rep.score);
    rows.push({
      agentId: Number(entry.agentId),
      name: entry.name,
      address: entry.address,
      score: Math.round(score * 100) / 100,
      settledVolumeUSDC: (Number(stats.volume) / 1_000_000).toFixed(2),
      uniquePayers: Number(stats.payers),
      feedbackCount: Number(rep.count),
      tier: reputationTier(score, Number(rep.count), entry.name),
    });
  }
  return rows;
}

app.get('/api/reputation', async (c) => {
  try {
    return c.json(await readSellerReputations());
  } catch (err) {
    console.error('[reputation] read failed:', err);
    return c.json({ error: 'reputation registry read failed' }, 503);
  }
});

// 8. LLM Transcript (/api/transcripts/:agentId)
app.get('/api/transcripts/:agentId', (c) => {
  const agentId = c.req.param('agentId');
  const messages = telemetry.getTranscript(agentId);
  return c.json({ agentId, messages });
});

interface AgentPolicy {
  maxPerChannel: bigint;
  budgetPerWindow: bigint;
  windowSecs: bigint;
  expiry: bigint;
  minPayeeRep: bigint;
  requireRegisteredPayee: boolean;
  active: boolean;
}

interface ResolvedChannel {
  channelId: `0x${string}`;
  payee: `0x${string}`;
  deposit: bigint;
  expiry: bigint;
}

interface RogueResult {
  reverted: boolean;
  errorName: string;
  message: string;
}

async function readAgentPolicy(agent: `0x${string}`): Promise<AgentPolicy | null> {
  try {
    const raw: any = await publicClient.readContract({
      address: CONFIG.SPEND_GUARD_ADDRESS,
      abi: SpendGuardAbi,
      functionName: 'policies',
      args: [agent],
    });
    return {
      maxPerChannel: raw[0],
      budgetPerWindow: raw[1],
      windowSecs: raw[2],
      expiry: raw[3],
      minPayeeRep: raw[4],
      requireRegisteredPayee: raw[5],
      active: raw[6],
    };
  } catch {
    return null;
  }
}

async function readVaultUnits(): Promise<bigint> {
  try {
    return (await publicClient.readContract({
      address: CONFIG.SPEND_GUARD_ADDRESS,
      abi: SpendGuardAbi,
      functionName: 'vaultBalance',
    })) as bigint;
  } catch {
    return 0n;
  }
}

async function verifyChannelOpen(channelId: `0x${string}`): Promise<ResolvedChannel | null> {
  try {
    const state: any = await publicClient.readContract({
      address: CONFIG.SPEND_GUARD_ADDRESS,
      abi: SpendGuardAbi,
      functionName: 'channels',
      args: [channelId],
    });
    const payee = state.payee ?? state[1];
    const deposit = state.deposit ?? state[3];
    const expiry = state.expiry ?? state[5];
    const closed = state.closed ?? state[6];
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (!closed && expiry > now) return { channelId, payee, deposit, expiry };
  } catch {}
  return null;
}

async function findLatestOpenChannel(): Promise<ResolvedChannel | null> {
  // Preferred source: channels observed live by the chain listener this session.
  // Monad's eth_getLogs is rate-limited/unreliable, so the in-memory registry is
  // what makes scenario 6 deterministic during a live demo.
  for (const tracked of telemetry.getOpenChannels()) {
    const verified = await verifyChannelOpen(tracked.channelId);
    if (verified) return verified;
  }

  // Fallback: best-effort log scan for channels opened before this server started.
  try {
    const latest = await publicClient.getBlockNumber();
    let toBlock = latest;
    const chunkSize = 100n;
    const candidates: ResolvedChannel[] = [];
    for (let i = 0; i < 40 && toBlock >= 0n && candidates.length < 5; i++) {
      const fromBlock = toBlock >= chunkSize ? toBlock - chunkSize + 1n : 0n;
      const logs = await publicClient.getLogs({
        address: CONFIG.SPEND_GUARD_ADDRESS,
        fromBlock,
        toBlock,
      });
      for (let j = logs.length - 1; j >= 0 && candidates.length < 5; j--) {
        try {
          const parsed: any = decodeEventLog({
            abi: SpendGuardAbi,
            data: logs[j].data,
            topics: logs[j].topics,
          });
          if (parsed.eventName === 'ChannelOpened') {
            const [channelId, , payee, , deposit, expiry] = parsed.args;
            candidates.push({ channelId, payee, deposit, expiry });
          }
        } catch {}
      }
      if (fromBlock === 0n) break;
      toBlock = fromBlock - 1n;
    }
    for (const candidate of candidates) {
      const verified = await verifyChannelOpen(candidate.channelId);
      if (verified) return verified;
    }
  } catch {}
  return null;
}

function conservativeDeposit(policy: AgentPolicy | null, vault: bigint): bigint {
  if (!policy) return 1_000_000n;
  const candidates = [policy.maxPerChannel, policy.budgetPerWindow, vault].filter((v) => v > 0n);
  if (candidates.length === 0) return 1n;
  return candidates.reduce((a, b) => (a < b ? a : b));
}

async function simulateRogueScenario(scenario: string): Promise<RogueResult> {
  const policy = await readAgentPolicy(SEED_AGENT);
  const vault = await readVaultUnits();
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const openChannel = (
    account: `0x${string}`,
    payee: `0x${string}`,
    payeeAgentId: bigint,
    deposit: bigint
  ) =>
    publicClient.simulateContract({
      address: CONFIG.SPEND_GUARD_ADDRESS,
      abi: SpendGuardAbi,
      functionName: 'openChannel',
      args: [payee, payeeAgentId, deposit, expiry],
      account,
    });

  const capBreachDeposit =
    policy && policy.maxPerChannel > 0n ? policy.maxPerChannel + 1n : 500_000_000n;

  let simulation: Promise<any> | undefined;

  switch (scenario) {
    case '1': {
      simulation = openChannel(SEED_AGENT, DEFAULT_PAYEE, 101n, capBreachDeposit);
      break;
    }
    case '2': {
      let deposit = 10_000_000n;
      if (policy) {
        deposit =
          policy.budgetPerWindow + 1n <= policy.maxPerChannel
            ? policy.budgetPerWindow + 1n
            : policy.maxPerChannel;
      }
      if (deposit === 0n) deposit = 1n;
      simulation = openChannel(SEED_AGENT, DEFAULT_PAYEE, 101n, deposit);
      break;
    }
    case '3': {
      simulation = openChannel(
        SEED_AGENT,
        UNREGISTERED_PAYEE,
        999999n,
        conservativeDeposit(policy, vault)
      );
      break;
    }
    case '4': {
      simulation = openChannel(
        SEED_AGENT,
        CONFIG.LOW_REP_PAYEE,
        CONFIG.LOW_REP_AGENT_ID,
        conservativeDeposit(policy, vault)
      );
      break;
    }
    case '5': {
      simulation = openChannel(POLICY_LESS_AGENT, DEFAULT_PAYEE, 101n, 1_000_000n);
      break;
    }
    case '6': {
      const channel = await findLatestOpenChannel();
      if (!channel) {
        return {
          reverted: true,
          errorName: 'NoOpenChannel',
          message:
            'No open payment channel exists on-chain right now — run the agent swarm first, then retry scenario 6 (it needs a live channel to over-claim against).',
        };
      }
      simulation = publicClient.simulateContract({
        address: CONFIG.SPEND_GUARD_ADDRESS,
        abi: SpendGuardAbi,
        functionName: 'claim',
        args: [channel.channelId, channel.deposit + 1n, ZERO_SIG],
        account: channel.payee,
      });
      break;
    }
    default: {
      simulation = openChannel(SEED_AGENT, UNREGISTERED_PAYEE, 999999n, capBreachDeposit);
    }
  }

  try {
    await simulation;
    return {
      reverted: false,
      errorName: 'NoRevert',
      message: 'SpendGuard simulation completed without reverting for this scenario',
    };
  } catch (err: any) {
    const decoded = decodeSpendGuardError(err) as any;
    if (decoded) {
      return { reverted: true, errorName: decoded.errorName, message: decoded.humanMessage };
    }
    const raw = String(err?.details || err?.shortMessage || err?.message || err);
    if (/revert/i.test(raw)) {
      return { reverted: true, errorName: 'ContractRevert', message: raw.slice(0, 300) };
    }
    throw err;
  }
}

// 10. Trigger Rogue Revert Scenario live (/api/rogue/:scenario)
app.post('/api/rogue/:scenario', async (c) => {
  const scenario = c.req.param('scenario');
  const scenariosMap: Record<string, { error: string; message: string; shockwaveLevel: number }> = {
    '1': {
      error: 'OverChannelCap',
      message: 'Deposit $500.00 exceeds agent cap of $10.00',
      shockwaveLevel: 1,
    },
    '2': {
      error: 'WindowBudgetExceeded',
      message: 'Agent exceeded hourly envelope budget of $5.00',
      shockwaveLevel: 1.5,
    },
    '3': {
      error: 'PayeeNotRegistered',
      message: 'Target recipient is not an ERC-8004 registered agent',
      shockwaveLevel: 2,
    },
    '4': {
      error: 'PayeeReputationTooLow',
      message: 'Payee reputation score 30 is below agent policy minimum 50',
      shockwaveLevel: 1.2,
    },
    '5': {
      error: 'AgentRevoked',
      message: 'Agent key was revoked by human owner via Face ID',
      shockwaveLevel: 2.5,
    },
    '6': {
      error: 'VoucherExceedsDeposit',
      message: 'Cumulative voucher amount exceeds locked channel deposit',
      shockwaveLevel: 1.8,
    },
  };
  const selected = scenariosMap[scenario] || {
    error: 'PolicyViolation',
    message: 'Transaction violated SpendGuard envelope',
    shockwaveLevel: 1,
  };

  try {
    const result = await simulateRogueScenario(scenario);
    if (!result.reverted) {
      return c.json({
        status: 'not-reverted',
        scenario,
        error: result.errorName,
        message: result.message,
        simulated: false,
        explorerUrl: CONTRACT_EXPLORER_URL,
        event: null,
      });
    }

    telemetry.recordRejection();
    const event = eventHub.broadcast('rejection', {
      scenarioId: scenario,
      error: result.errorName,
      humanMessage: result.message,
      shockwaveLevel: selected.shockwaveLevel,
      timestamp: Date.now(),
      explorerUrl: CONTRACT_EXPLORER_URL,
    });

    return c.json({
      status: 'reverted',
      scenario,
      error: result.errorName,
      message: result.message,
      simulated: false,
      explorerUrl: CONTRACT_EXPLORER_URL,
      event,
    });
  } catch (err: any) {
    return c.json({
      status: 'simulation-failed',
      scenario,
      error: 'SimulationFailed',
      message: `SpendGuard simulation could not be executed: ${String(
        err?.details || err?.shortMessage || err?.message || err
      ).slice(0, 300)}`,
      simulated: false,
      explorerUrl: CONTRACT_EXPLORER_URL,
      event: null,
    });
  }
});

// 11. Prompt-injection defense is proven live by the Tier C agent in
// apps/agents (buyerTierC.testPromptInjectionAttack) — the server never faked it.
// 11b. Real usage ingestion from sellers (fires after each verified paid call)
app.post('/api/usage', async (c) => {
  const body = await c.req.json().catch(() => ({}) as any);
  const seller = body.seller || 'DataSeller';
  const price = typeof body.priceUSDC === 'number' ? body.priceUSDC : 0;
  const latency = typeof body.latencyMs === 'number' ? body.latencyMs : 0;
  telemetry.recordCall(latency, price);
  const event = eventHub.broadcast('call.paid', {
    seller,
    priceUSDC: price,
    latencyMs: latency,
    buyer: body.buyer || null,
    channelId: body.channelId || null,
    timestamp: Date.now(),
  });
  return c.json({ status: 'ok', metrics: telemetry.getMetrics() });
});

// 12. Simulated-call endpoint removed — paid calls are ingested live via
// /api/usage from the sellers app after each on-chain verified voucher.
// 13. Recent events feed (/api/events)
app.get('/api/events', (c) => {
  return c.json({ events: eventHub.getRecentEvents(100) });
});

// Create standard HTTP server and attach WebSocket server
const server = createServer(async (req, res) => {
  req.on('error', (err) => {
    console.error('[HTTP] Request stream error:', err.message);
  });
  res.on('error', (err) => {
    console.error('[HTTP] Response stream error:', err.message);
  });

  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) clientGone = true;
  });

  try {
    const response = await app.fetch(
      new Request(`http://localhost:${CONFIG.PORT}${req.url}`, {
        method: req.method,
        headers: req.headers as any,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? (req as any) : undefined,
        duplex: 'half',
      } as any)
    );

    if (clientGone || res.destroyed || res.writableEnded) return;

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          if (clientGone || res.destroyed || res.writableEnded) break;
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.write(value)) {
            await new Promise<void>((resolve) => {
              const finish = () => {
                res.off('drain', onDrain);
                res.off('close', onClose);
                resolve();
              };
              const onDrain = finish;
              const onClose = finish;
              res.once('drain', onDrain);
              res.once('close', onClose);
              if (clientGone || res.destroyed || res.writableEnded) finish();
            });
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
    }

    if (!res.writableEnded && !res.destroyed) res.end();
  } catch (err: any) {
    console.error('[HTTP] Request handler failed:', err?.message || err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
    }
    if (!res.writableEnded && !res.destroyed) {
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
});

eventHub.init(server);

async function startServer() {
  await telemetry.init();
  await chainListener.start();
  server.listen(CONFIG.PORT, () => {
    console.log(`[Server] AgentMesh REST API running on http://localhost:${CONFIG.PORT}`);
    console.log(`[Server] Live WebSocket stream on ws://localhost:${CONFIG.PORT}/ws/events`);
  });
}

startServer().catch(console.error);
