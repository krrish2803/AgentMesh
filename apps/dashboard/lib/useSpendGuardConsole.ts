'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedEvent } from '@/components/LiveFeed';
import type { RogueRevertFeedback } from '@/components/RoguePanel';
import type { SafetyReportRow } from '@/components/SafetyReport';
import type { AgentItem } from '@/components/AgentsList';
import type { SellerReputation } from '@/components/ReputationTable';
import { ROGUE_TITLES } from '@/lib/scenarios';
import { WS_EVENTS_URL, apiUrl } from '@/lib/config';

export type MetricsStatus = 'live' | 'offline' | 'connecting';
export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface MetricsState {
  totalCalls: number;
  totalVolumeUSDC: number;
  onChainTxCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  rejectedCount: number;
}

export interface VaultState {
  vaultBalanceUSDC: number | null;
  ownerUSDCBalance: number | null;
  usdc: string | null;
  owner: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const EMPTY_METRICS: MetricsState = {
  totalCalls: 0,
  totalVolumeUSDC: 0,
  onChainTxCount: 0,
  p50LatencyMs: 0,
  p95LatencyMs: 0,
  rejectedCount: 0,
};

const EMPTY_VAULT: VaultState = {
  vaultBalanceUSDC: null,
  ownerUSDCBalance: null,
  usdc: null,
  owner: null,
};

const METRIC_KEYS: (keyof MetricsState)[] = [
  'totalCalls',
  'totalVolumeUSDC',
  'onChainTxCount',
  'p50LatencyMs',
  'p95LatencyMs',
  'rejectedCount',
];

function sanitizeMetrics(input: unknown): Partial<MetricsState> | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const out: Partial<MetricsState> = {};
  let found = 0;
  for (const key of METRIC_KEYS) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
      found += 1;
    }
  }
  return found > 0 ? out : null;
}

function errorText(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === 'string' && msg) return msg;
  }
  return `server responded ${status}`;
}

export function useSpendGuardConsole() {
  const [is2D, setIs2D] = useState(false);
  const [shockwave, setShockwave] = useState(false);
  const [vault, setVault] = useState<VaultState>(EMPTY_VAULT);
  const [control, setControl] = useState(false);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [lastFeedback, setLastFeedback] = useState<RogueRevertFeedback | null>(null);
  const [safetyReport, setSafetyReport] = useState<SafetyReportRow[]>([]);
  const [metrics, setMetrics] = useState<MetricsState>(EMPTY_METRICS);
  const [metricsStatus, setMetricsStatus] = useState<MetricsStatus>('connecting');
  const [vaultStatus, setVaultStatus] = useState<MetricsStatus>('connecting');
  const [agentsStatus, setAgentsStatus] = useState<MetricsStatus>('connecting');
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [sellers, setSellers] = useState<SellerReputation[]>([]);

  const shockwaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateWsStatus = useCallback((status: WsStatus) => {
    setWsStatus(status);
  }, []);

  const upsertReportRow = useCallback(
    (scenarioId: string, error: string, explorerUrl: string | null, txHash: string | null = null) => {
      if (!scenarioId || !error) return;
      setSafetyReport((prev) => {
        const row: SafetyReportRow = {
          scenarioId,
          title: ROGUE_TITLES[scenarioId] ?? `Scenario ${scenarioId}`,
          error,
          result: 'reverted',
          explorerUrl,
          txHash,
          ts: Date.now(),
        };
        const next = prev.filter((r) => r.scenarioId !== scenarioId);
        next.push(row);
        return next.sort((a, b) => Number(a.scenarioId) - Number(b.scenarioId));
      });
    },
    []
  );

  const triggerShockwaveEffect = useCallback(() => {
    setShockwave(true);
    if (shockwaveTimerRef.current) clearTimeout(shockwaveTimerRef.current);
    shockwaveTimerRef.current = setTimeout(() => {
      shockwaveTimerRef.current = null;
      setShockwave(false);
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (shockwaveTimerRef.current) {
        clearTimeout(shockwaveTimerRef.current);
        shockwaveTimerRef.current = null;
      }
    };
  }, []);

  // ---- Real data loaders -------------------------------------------------

  const refreshVault = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/vault'), { cache: 'no-store' });
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;
      setVault({
        vaultBalanceUSDC:
          typeof data.vaultBalanceUSDC === 'number' ? data.vaultBalanceUSDC : null,
        ownerUSDCBalance:
          typeof data.ownerUSDCBalance === 'number' ? data.ownerUSDCBalance : null,
        usdc: typeof data.usdc === 'string' ? data.usdc : null,
        owner: typeof data.owner === 'string' ? data.owner : null,
      });
      setControl(Boolean(data.control));
      setVaultStatus('live');
    } catch {
      setVaultStatus('offline');
    }
  }, []);

  const refreshAgents = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/agents'), { cache: 'no-store' });
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;
      const list = Array.isArray(data.agents) ? (data.agents as AgentItem[]) : [];
      setAgents(list);
      setControl(Boolean(data.control));
      setAgentsStatus('live');
    } catch {
      setAgentsStatus('offline');
    }
  }, []);

  const refreshSellers = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/reputation'), { cache: 'no-store' });
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const raw = (await res.json()) as unknown;
      if (!Array.isArray(raw)) throw new Error('malformed reputation payload');
      const rows = raw.filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        return (
          typeof r.agentId === 'number' &&
          typeof r.name === 'string' &&
          typeof r.score === 'number' &&
          typeof r.settledVolumeUSDC === 'string' &&
          typeof r.uniquePayers === 'number' &&
          typeof r.tier === 'string'
        );
      }) as SellerReputation[];
      setSellers(rows);
    } catch {
      // keep last known rows when the server is unreachable
    }
  }, []);

  // Live event stream with exponential-backoff reconnect
  useEffect(() => {
    let socket: WebSocket | null = null;
    let disposed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = () => {
      if (disposed) return;
      const delay = Math.min(15000, 1000 * 2 ** attempt);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed) return;
      updateWsStatus('connecting');
      try {
        socket = new WebSocket(WS_EVENTS_URL);
      } catch (err) {
        console.warn('[ws] unable to open event stream:', err);
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        attempt = 0;
        updateWsStatus('connected');
      };

      socket.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as FeedEvent;
          if (!ev || typeof ev.type !== 'string') return;
          setEvents((prev) => [ev, ...prev].slice(0, 100));
          if (ev.type === 'rejection') {
            triggerShockwaveEffect();
            upsertReportRow(
              String(ev.payload?.scenarioId ?? ''),
              String(ev.payload?.error ?? ''),
              ev.payload?.explorerUrl ?? null,
              ev.payload?.txHash ?? null
            );
          } else if (ev.type === 'vault.funded' || ev.type === 'vault.withdrawn') {
            void refreshVault();
          } else if (ev.type === 'agent.revoked' || ev.type === 'agent.policy') {
            void refreshAgents();
          }
        } catch (err) {
          console.warn('[ws] failed to parse incoming event:', err);
        }
      };

      socket.onerror = () => {
        console.warn('[ws] connection error, reconnecting with backoff');
      };

      socket.onclose = () => {
        socket = null;
        if (disposed) return;
        updateWsStatus('disconnected');
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        socket = null;
      }
      updateWsStatus('disconnected');
    };
  }, [triggerShockwaveEffect, updateWsStatus, upsertReportRow, refreshVault, refreshAgents]);

  // Poll real server metrics; flag values as offline when unreachable
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/metrics'), { cache: 'no-store' });
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        const snapshot = sanitizeMetrics(await res.json());
        if (!snapshot) throw new Error('malformed metrics payload');
        if (cancelled) return;
        setMetrics((prev) => ({ ...prev, ...snapshot }));
        setMetricsStatus('live');
      } catch (err) {
        if (cancelled) return;
        setMetricsStatus('offline');
        console.warn('[metrics] server unreachable:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Poll real vault + agents state
  useEffect(() => {
    void refreshVault();
    void refreshAgents();
    const interval = setInterval(() => {
      void refreshVault();
      void refreshAgents();
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshVault, refreshAgents]);

  // Poll the live /api/reputation endpoint (real ERC-8004 registry + SpendGuard counters)
  useEffect(() => {
    void refreshSellers();
    const interval = setInterval(refreshSellers, 10000);
    return () => clearInterval(interval);
  }, [refreshSellers]);

  // ---- Real actions ------------------------------------------------------

  const fundVault = useCallback(
    async (amount: number): Promise<ActionResult> => {
      try {
        const res = await fetch(apiUrl('/api/vault/fund'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ amountUSDC: amount }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || (data as { status?: string } | null)?.status !== 'funded') {
          return { ok: false, error: errorText(data, res.status) };
        }
        await refreshVault();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'network error' };
      }
    },
    [refreshVault]
  );

  const setAgentActive = useCallback(
    async (address: string, active: boolean): Promise<ActionResult> => {
      const action = active ? 'reinstate' : 'revoke';
      try {
        const res = await fetch(apiUrl(`/api/agents/${address}/${action}`), {
          method: 'POST',
        });
        const data = await res.json().catch(() => null);
        const expected = active ? 'reinstated' : 'revoked';
        if (!res.ok || (data as { status?: string } | null)?.status !== expected) {
          return { ok: false, error: errorText(data, res.status) };
        }
        await refreshAgents();
        if (active) return { ok: true };
        triggerShockwaveEffect();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'network error' };
      }
    },
    [refreshAgents, triggerShockwaveEffect]
  );

  const revokeAgent = useCallback(
    (address: string) => setAgentActive(address, false),
    [setAgentActive]
  );

  const reinstateAgent = useCallback(
    (address: string) => setAgentActive(address, true),
    [setAgentActive]
  );

  const handleTriggerRogue = useCallback(
    async (scenario: string) => {
      triggerShockwaveEffect();
      try {
        const res = await fetch(apiUrl(`/api/rogue/${scenario}`), { method: 'POST' });
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        const data = await res.json();
        if (!data || typeof data.error !== 'string' || !data.error) {
          throw new Error('malformed server response');
        }
        setLastFeedback({
          scenario: `Scenario #${scenario}`,
          error: data.error,
          message:
            typeof data.message === 'string' && data.message
              ? data.message
              : 'Policy violation reverted on-chain',
          timestamp: new Date().toLocaleTimeString(),
        });
        if (data.status === 'reverted') {
          upsertReportRow(
            scenario,
            String(data.error),
            data.explorerUrl ?? data.event?.payload?.explorerUrl ?? null,
            data.txHash ?? data.event?.payload?.txHash ?? null
          );
        }
      } catch (err) {
        setLastFeedback({
          scenario: `Scenario #${scenario}`,
          error: 'ServerUnavailable',
          message: `Server unavailable — cannot verify this revert on-chain (${
            err instanceof Error ? err.message : 'network error'
          }). Start the AgentMesh server to run live scenarios.`,
          timestamp: new Date().toLocaleTimeString(),
          failed: true,
        });
      }
    },
    [triggerShockwaveEffect, upsertReportRow]
  );

  // Prompt-injection defense is proven by the Tier C agent in the agents app
  // (real LLM + real on-chain voucher revert); paid "burst" calls are produced
  // live by the sellers app via /api/usage.

  return {
    is2D,
    setIs2D,
    shockwave,
    vault,
    vaultStatus,
    control,
    events,
    lastFeedback,
    safetyReport,
    metrics,
    metricsStatus,
    agentsStatus,
    wsStatus,
    agents,
    sellers,
    fundVault,
    revokeAgent,
    reinstateAgent,
    handleTriggerRogue,
  };
}
