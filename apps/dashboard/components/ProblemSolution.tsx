'use client';

import React from 'react';
import { AlertOctagon, CheckCircle2, ShieldX, ShieldCheck, DollarSign, RefreshCw, Terminal, Layers } from 'lucide-react';

export function ProblemSolution() {
  return (
    <section className="py-12 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono uppercase tracking-widest text-monad-400 font-bold">
            The Agent Economy Paradox
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            AI Agents Need Money. Nobody Wants To Give Them An Open Wallet.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Existing architectures either force you to trust probabilistic LLMs with uncontrolled private keys, or settle every sub-cent call on-chain. SpendGuard fixes both.
          </p>
        </div>

        {/* 2-Column Comparison: The Problem vs SpendGuard Solution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: The Flawed Status Quo */}
          <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 space-y-5">
            <div className="flex items-center gap-2.5 text-red-400">
              <ShieldX className="w-5 h-5" />
              <h3 className="font-bold text-base text-red-300">The Problem: Existing Architectures</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-red-950 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-red-900/60 text-red-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <h4 className="font-bold text-slate-200">Dangerous Capital Exposure</h4>
                  <p className="text-slate-400 mt-0.5">
                    Giving an autonomous agent an unconstrained private key risks total wallet depletion if the agent hallucinates, enters an infinite loop, or falls victim to prompt injection.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-red-950 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-red-900/60 text-red-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <h4 className="font-bold text-slate-200">The Approval Bottleneck</h4>
                  <p className="text-slate-400 mt-0.5">
                    Requiring humans to manually approve every sub-cent call destroys true agent autonomy and completely breaks real-time machine-to-machine coordination.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-red-950 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-red-900/60 text-red-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <h4 className="font-bold text-slate-200">Naive On-Chain Micropayments</h4>
                  <p className="text-slate-400 mt-0.5">
                    Settling every $0.0001 query individually on-chain is architectural malpractice. It wastes gas, induces latency, and floods the network with trivial state updates.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: The SpendGuard Solution */}
          <div className="p-6 rounded-2xl bg-monad-950/30 border border-monad-800/60 space-y-5">
            <div className="flex items-center gap-2.5 text-monad-400">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base text-white">The Solution: SpendGuard on Monad</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-monad-900 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 border border-emerald-800">
                  ✓
                </span>
                <div>
                  <h4 className="font-bold text-slate-100">Passkey-Guarded Envelopes</h4>
                  <p className="text-slate-300 mt-0.5">
                    A human locks funds using Face ID. The contract enforces tight caps: max spend per channel, hourly rolling window budgets, and instant one-tap revocation.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-monad-900 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 border border-emerald-800">
                  ✓
                </span>
                <div>
                  <h4 className="font-bold text-slate-100">Off-Chain State Channels</h4>
                  <p className="text-slate-300 mt-0.5">
                    Agents pay per call using signed EIP-712 vouchers. Sellers serve in under 30ms and batch settlement on Monad, while unused channel balances refund instantly.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-monad-900 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 border border-emerald-800">
                  ✓
                </span>
                <div>
                  <h4 className="font-bold text-slate-100">ERC-8004 Identity & Reputation Gating</h4>
                  <p className="text-slate-300 mt-0.5">
                    Payees must be registered in the ERC-8004 registry and meet minimum reputation thresholds. Untrusted or malicious targets are deterministically blocked by the contract.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
