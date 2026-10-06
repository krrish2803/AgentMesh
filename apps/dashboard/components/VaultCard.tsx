'use client';

import React, { useState } from 'react';
import { ShieldCheck, Plus, ArrowUpRight, Lock, Key } from 'lucide-react';

export function VaultCard({
  balance = 1000,
  onFund,
}: {
  balance?: number;
  onFund?: (amount: number) => void;
}) {
  const [funding, setFunding] = useState(false);

  const handleFund = () => {
    setFunding(true);
    if (onFund) onFund(50);
    setTimeout(() => setFunding(false), 800);
  };

  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-monad-950 border border-monad-700/60 flex items-center justify-center text-monad-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">SpendGuard Vault</h3>
            <p className="text-[11px] text-slate-400">Passkey Envelope Pool</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
          Enforced
        </span>
      </div>

      {/* Balance Big Display */}
      <div className="my-4">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total USDC Locked</div>
        <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-2 mt-1">
          <span>${balance.toFixed(2)}</span>
          <span className="text-xs font-semibold text-monad-400">USDC</span>
        </div>
      </div>

      {/* Envelope Rules summary */}
      <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Per-Channel Cap:</span>
          <span className="font-mono font-medium text-slate-200">$10.00 USDC</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Window Budget:</span>
          <span className="font-mono font-medium text-slate-200">$50.00 / hour</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Min Payee Reputation:</span>
          <span className="font-mono font-medium text-emerald-400">50 Score (ERC-8004)</span>
        </div>
      </div>

      {/* Passkey Owner & Fund Action */}
      <div className="mt-4 pt-1 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
          <Key className="w-3.5 h-3.5 text-monad-400 flex-shrink-0" />
          <span className="font-mono truncate">Mera: 0x8a92...e31b</span>
        </div>

        <button
          onClick={handleFund}
          disabled={funding}
          className="px-3 py-1.5 rounded-lg bg-monad-600 hover:bg-monad-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-monad-700/30"
        >
          <Plus className="w-3.5 h-3.5" />
          {funding ? 'Funding...' : 'Fund $50'}
        </button>
      </div>
    </div>
  );
}
