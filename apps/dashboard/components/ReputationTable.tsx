'use client';

import React from 'react';
import { Award, ShieldCheck, ShieldAlert, Star } from 'lucide-react';

export interface SellerReputation {
  agentId: number;
  name: string;
  score: number;
  settledVolumeUSDC: string;
  uniquePayers: number;
  tier: string;
}

export function ReputationTable({ sellers }: { sellers: SellerReputation[] }) {
  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">ERC-8004 Reputation Registry</h3>
        </div>
        <span className="text-[11px] font-mono text-monad-400">On-Chain Gated</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
              <th className="pb-2 font-semibold">Agent ID</th>
              <th className="pb-2 font-semibold">Seller</th>
              <th className="pb-2 font-semibold">Reputation Score</th>
              <th className="pb-2 font-semibold">Volume Settled</th>
              <th className="pb-2 font-semibold">Unique Payers</th>
              <th className="pb-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sellers.map((s) => {
              const isLow = s.score < 50;

              return (
                <tr key={s.agentId} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-2.5 text-monad-400 font-bold">#{s.agentId}</td>
                  <td className="py-2.5 font-sans font-semibold text-white">{s.name}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                        isLow
                          ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                          : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                      }`}
                    >
                      <Star className="w-3 h-3" /> {s.score} / 100
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-300">${s.settledVolumeUSDC}</td>
                  <td className="py-2.5 text-slate-300">{s.uniquePayers}</td>
                  <td className="py-2.5">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5" /> Gated (Below 50)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified & Eligible
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
