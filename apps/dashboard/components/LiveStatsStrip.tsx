'use client';

import React from 'react';
import { Radio, ReceiptText, Boxes, Gauge } from 'lucide-react';
import type { MetricsState, MetricsStatus } from '@/lib/useSpendGuardConsole';

export function LiveStatsStrip({
  metrics,
  status = 'connecting',
}: {
  metrics: MetricsState;
  status?: MetricsStatus;
}) {
  const calls = metrics.totalCalls;
  const chainTx = metrics.onChainTxCount;
  const ratio = calls > 0 && chainTx > 0 ? (calls / chainTx).toFixed(1) : '—';
  const live = status === 'live';
  const connecting = status === 'connecting';

  const tiles = [
    {
      label: 'Paid Calls',
      sublabel: 'off-chain vouchers',
      value: calls.toLocaleString(),
      icon: Radio,
      accent: 'text-emerald-400',
      bg: 'from-emerald-950/50 border-emerald-800/50',
    },
    {
      label: 'On-Chain Transactions',
      sublabel: 'channel lifecycle',
      value: chainTx.toLocaleString(),
      icon: ReceiptText,
      accent: 'text-monad-300',
      bg: 'from-monad-950/50 border-monad-700/50',
    },
    {
      label: 'Off-Chain Batching',
      sublabel: 'calls per chain tx',
      value: ratio === '—' ? '—' : `${ratio}x`,
      icon: Boxes,
      accent: 'text-amber-400',
      bg: 'from-amber-950/40 border-amber-700/50',
    },
    {
      label: 'p95 Latency',
      sublabel: 'verifiable voucher',
      value: metrics.p95LatencyMs > 0 ? `${metrics.p95LatencyMs}ms` : '—',
      icon: Gauge,
      accent: 'text-sky-400',
      bg: 'from-sky-950/40 border-sky-700/50',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
            live
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70'
              : connecting
                ? 'bg-slate-800/70 text-slate-300 border-slate-700/70'
                : 'bg-amber-950/70 text-amber-300 border-amber-800/70'
          }`}
          title={
            live
              ? 'Streaming real data from the AgentMesh server'
              : connecting
                ? 'Contacting the AgentMesh server…'
                : 'Server unreachable — no live data'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              live ? 'bg-emerald-400 animate-pulse' : connecting ? 'bg-slate-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          {live ? 'LIVE DATA' : connecting ? 'CONNECTING…' : 'SERVER OFFLINE'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`flex items-center gap-3 rounded-2xl border bg-gradient-to-b to-[#0f111e] p-4 shadow-lg shadow-black/30 ${t.bg}`}
          >
            <t.icon className={`w-5 h-5 flex-shrink-0 ${t.accent}`} />
            <div className="min-w-0">
              <div className={`text-xl font-black font-mono leading-tight ${t.accent}`}>
                {t.value}
              </div>
              <div className="text-[11px] font-semibold text-slate-300 truncate">{t.label}</div>
              <div className="text-[10px] font-mono text-slate-500 truncate">{t.sublabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
