'use client';

import React from 'react';
import { Bot, UserX, Shield, CheckCircle } from 'lucide-react';

export interface AgentItem {
  address: string;
  role: string;
  tier: 'A' | 'B' | 'C';
  erc8004Id: number;
  budgetLimit: number;
  budgetSpent: number;
  active: boolean;
}

export function AgentsList({
  agents,
  onRevoke,
}: {
  agents: AgentItem[];
  onRevoke: (address: string) => void;
}) {
  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">Active Buyer Swarm</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Hourly Envelopes</span>
      </div>

      <div className="space-y-3">
        {agents.map((ag) => {
          const pct = Math.min(100, (ag.budgetSpent / ag.budgetLimit) * 100);

          return (
            <div
              key={ag.address}
              className={`p-3.5 rounded-xl border transition-all ${
                ag.active
                  ? 'bg-slate-900/70 border-slate-800'
                  : 'bg-red-950/20 border-red-900/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      ag.active ? 'bg-emerald-400' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-white">{ag.role}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                    Tier {ag.tier}
                  </span>
                </div>

                {ag.active ? (
                  <button
                    onClick={() => onRevoke(ag.address)}
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <UserX className="w-3 h-3" /> Revoke
                  </button>
                ) : (
                  <span className="text-[10px] text-red-400 font-mono font-medium">Revoked</span>
                )}
              </div>

              {/* Budget Progress Meter */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Spend: ${ag.budgetSpent.toFixed(2)}</span>
                  <span>Limit: ${ag.budgetLimit.toFixed(2)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-monad-500'
                    }`}
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>
              </div>

              <div className="mt-2 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                <span>Key: {ag.address.slice(0, 10)}...</span>
                <span>ERC-8004 ID #{ag.erc8004Id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
