'use client';

import React, { useState } from 'react';
import { Bot, UserX, RotateCcw, Loader2 } from 'lucide-react';
import type { ActionResult } from '@/lib/useSpendGuardConsole';

export interface AgentItem {
  address: string;
  role: string;
  tier: 'A' | 'B' | 'C';
  erc8004Id: number;
  budgetLimit: number;
  budgetSpent: number;
  active: boolean;
  maxPerChannel?: number;
  windowSecs?: number;
  minPayeeRep?: number;
}

export function AgentsList({
  agents,
  control = false,
  status = 'connecting',
  onRevoke,
  onReinstate,
}: {
  agents: AgentItem[];
  control?: boolean;
  status?: 'live' | 'offline' | 'connecting';
  onRevoke: (address: string) => Promise<ActionResult>;
  onReinstate: (address: string) => Promise<ActionResult>;
}) {
  const [pending, setPending] = useState<Record<string, 'revoke' | 'reinstate'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = async (address: string, action: 'revoke' | 'reinstate') => {
    setPending((p) => ({ ...p, [address]: action }));
    setErrors((e) => {
      const next = { ...e };
      delete next[address];
      return next;
    });
    const result =
      action === 'revoke' ? await onRevoke(address) : await onReinstate(address);
    setPending((p) => {
      const next = { ...p };
      delete next[address];
      return next;
    });
    if (!result.ok) {
      setErrors((e) => ({ ...e, [address]: result.error || 'transaction failed' }));
    }
  };

  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">Active Buyer Swarm</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {control ? 'Hourly Envelopes' : 'Owner key not configured'}
        </span>
      </div>

      {agents.length === 0 ? (
        <div className="py-10 text-center text-xs font-mono text-slate-500">
          {status === 'offline'
            ? 'Server offline — no agent state available.'
            : 'Loading agents…'}
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((ag) => {
            const pct =
              ag.budgetLimit > 0
                ? Math.min(100, (ag.budgetSpent / ag.budgetLimit) * 100)
                : 0;
            const busy = pending[ag.address];

            return (
              <div
                key={ag.address}
                className={`p-3.5 rounded-xl border transition-all ${
                  ag.active
                    ? 'bg-slate-900/70 border-slate-800'
                    : 'bg-red-950/20 border-red-900/50 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        ag.active ? 'bg-emerald-400' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-white truncate">{ag.role}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono flex-shrink-0">
                      Tier {ag.tier}
                    </span>
                  </div>

                  {busy ? (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium flex-shrink-0">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {busy === 'revoke' ? 'Revoking…' : 'Reinstating…'}
                    </span>
                  ) : ag.active ? (
                    <button
                      onClick={() => run(ag.address, 'revoke')}
                      disabled={!control}
                      title={control ? 'Revoke on-chain' : 'Owner key not configured on server'}
                      className="text-[10px] text-red-400 hover:text-red-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors flex-shrink-0"
                    >
                      <UserX className="w-3 h-3" /> Revoke
                    </button>
                  ) : (
                    <button
                      onClick={() => run(ag.address, 'reinstate')}
                      disabled={!control}
                      title={control ? 'Reinstate on-chain' : 'Owner key not configured on server'}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors flex-shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" /> Reinstate
                    </button>
                  )}
                </div>

                {errors[ag.address] && (
                  <div className="mb-2 text-[10px] font-mono text-red-400 break-words">
                    {errors[ag.address]}
                  </div>
                )}

                {/* Budget Progress Meter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Spend: ${ag.budgetSpent.toFixed(2)}</span>
                    <span>Window: ${ag.budgetLimit.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-monad-500'
                      }`}
                      style={{ width: `${Math.max(ag.budgetSpent > 0 ? 5 : 0, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-slate-500 font-mono flex items-center justify-between gap-2">
                  <span className="truncate">Key: {ag.address.slice(0, 10)}…</span>
                  <span className="flex-shrink-0">
                    {ag.erc8004Id > 0 ? `ERC-8004 ID #${ag.erc8004Id}` : 'ERC-8004: —'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
