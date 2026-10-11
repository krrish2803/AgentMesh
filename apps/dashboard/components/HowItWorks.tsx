'use client';

import React from 'react';
import { Fingerprint, Search, Shield, Zap, Database, CheckCircle2 } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: Fingerprint,
      title: 'Human Sets Envelope via Face ID',
      desc: 'Owner creates an account via Mera Passkey (no seed phrases). They deposit USDC into the SpendGuard vault and configure strict spending rules: per-channel cap, rolling hourly budget, and minimum payee reputation.',
      color: 'text-monad-400',
      border: 'border-monad-800',
    },
    {
      num: '02',
      icon: Search,
      title: 'Agent Discovers ERC-8004 Payees',
      desc: 'Buyer agents inspect the on-chain ERC-8004 Identity and Reputation registries. The LLM planner selects high-performing sellers and rejects untrusted addresses with insufficient reputation scores.',
      color: 'text-sky-400',
      border: 'border-sky-800',
    },
    {
      num: '03',
      icon: Shield,
      title: 'Open Locked State Channel',
      desc: 'The buyer hot key calls openChannel() on SpendGuard. The contract verifies policy caps, checks the rolling window spend, validates payee reputation, and locks the deposit from the vault.',
      color: 'text-purple-400',
      border: 'border-purple-800',
    },
    {
      num: '04',
      icon: Zap,
      title: 'Off-Chain Voucher Payments (HTTP 402)',
      desc: 'For each API call, the buyer generates an off-chain EIP-712 voucher with an incremental cumulative amount. The seller verifies the signature and monotonic balance in < 30ms, then serves the request immediately.',
      color: 'text-amber-400',
      border: 'border-amber-800',
    },
    {
      num: '05',
      icon: Database,
      title: 'Batched Claims & Instant Refunds',
      desc: 'Sellers batch-claim accumulated earnings on Monad in single transactions covering hundreds of queries. When the channel closes or expires, unspent funds refund immediately back to the vault.',
      color: 'text-emerald-400',
      border: 'border-emerald-800',
    },
  ];

  return (
    <section className="py-12 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-monad-400 font-bold">
            Execution Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How SpendGuard Works
          </h2>
          <p className="text-slate-400 text-sm">
            End-to-end lifecycle: from WebAuthn passkey policy to off-chain state channel settlement on Monad.
          </p>
        </div>

        {/* 5-Step Process Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {steps.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.num}
                className={`p-5 rounded-2xl bg-slate-900/60 border ${st.border}/50 hover:border-monad-500/80 transition-all flex flex-col justify-between group`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-slate-300">
                      {st.num}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                      <Icon className={`w-4 h-4 ${st.color}`} />
                    </div>
                  </div>
                  <h3 className="text-xs font-bold text-white mb-2 leading-snug">
                    {st.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {st.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Monad Verified
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
