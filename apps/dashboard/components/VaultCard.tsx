'use client';

import React, { useState } from 'react';
import { Plus, Lock, Key, Loader2, AlertTriangle } from 'lucide-react';
import type { ActionResult } from '@/lib/useSpendGuardConsole';

export function VaultCard({
  balance = null,
  ownerBalance = null,
  ownerAddress = null,
  perChannelCap = 10,
  windowBudget = 5,
  minPayeeRep = 50,
  control = false,
  status = 'connecting',
  onFund,
}: {
  balance?: number | null;
  ownerBalance?: number | null;
  ownerAddress?: string | null;
  perChannelCap?: number;
  windowBudget?: number;
  minPayeeRep?: number;
  control?: boolean;
  status?: 'live' | 'offline' | 'connecting';
  onFund?: (amount: number) => Promise<ActionResult>;
}) {
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFund = async () => {
    if (!onFund || funding) return;
    setFunding(true);
    setError(null);
    const result = await onFund(1);
    setFunding(false);
    if (!result.ok) setError(result.error || 'funding failed');
  };

  const unavailable = status === 'offline' && balance === null;

  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-monad-950 border border-monad-700/60 flex items-center justify-center text-monad-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">SpendGuard Vault</h3>
            <p className="text-[11px] text-slate-400">USDC Envelope Pool</p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
            control
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
              : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
          }`}
        >
          {control ? 'Enforced' : 'Read-only'}
        </span>
      </div>

      {/* Balance Big Display */}
      <div className="my-4">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total USDC Locked</div>
        <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-2 mt-1">
          <span>{balance === null ? '—' : `$${balance.toFixed(2)}`}</span>
          <span className="text-xs font-semibold text-monad-400">USDC</span>
        </div>
        {ownerBalance !== null && (
          <div className="text-[11px] text-slate-500 mt-1">
            Owner wallet: <span className="font-mono text-slate-400">${ownerBalance.toFixed(4)} USDC</span>
          </div>
        )}
      </div>

      {/* Envelope Rules summary */}
      <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Per-Channel Cap:</span>
          <span className="font-mono font-medium text-slate-200">${perChannelCap.toFixed(2)} USDC</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Window Budget:</span>
          <span className="font-mono font-medium text-slate-200">${windowBudget.toFixed(2)} / hour</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Min Payee Reputation:</span>
          <span className="font-mono font-medium text-emerald-400">{minPayeeRep} Score (ERC-8004)</span>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-1.5 text-[11px] font-mono text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Owner & Fund Action */}
      <div className="mt-4 pt-1 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate min-w-0">
          <Key className="w-3.5 h-3.5 text-monad-400 flex-shrink-0" />
          <span className="font-mono truncate">
            {ownerAddress ? `${ownerAddress.slice(0, 8)}…${ownerAddress.slice(-4)}` : 'owner: —'}
          </span>
        </div>

        <button
          onClick={handleFund}
          disabled={funding || !control || unavailable}
          title={control ? 'Transfer $1 USDC from the owner wallet into the vault' : 'Owner key not configured on server'}
          className="px-3 py-1.5 rounded-lg bg-monad-600 hover:bg-monad-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-monad-700/30 flex-shrink-0"
        >
          {funding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {funding ? 'Funding…' : 'Fund $1'}
        </button>
      </div>
    </div>
  );
}
