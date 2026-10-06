'use client';

import React from 'react';
import { Check, X, Shield, Zap, Sparkles } from 'lucide-react';

export function FeaturesComparison() {
  const comparison = [
    {
      feature: 'Payer Spending Envelope',
      spendguard: 'Configurable ($ cap, rolling window)',
      x402: 'None (Per-request authorization only)',
      rawWallet: 'None (Full balance exposed)',
    },
    {
      feature: 'Settlement Model',
      spendguard: 'Off-chain state channels + Batched claim',
      x402: 'Per-call facilitator settlement',
      rawWallet: 'Direct on-chain micro-txs',
    },
    {
      feature: 'Payee Identity Gating',
      spendguard: 'Enforced via ERC-8004 Identity Registry',
      x402: 'Open to any arbitrary payee',
      rawWallet: 'Open to any arbitrary payee',
    },
    {
      feature: 'Payee Reputation Gating',
      spendguard: 'Enforced via ERC-8004 Reputation Registry',
      x402: 'None',
      rawWallet: 'None',
    },
    {
      feature: 'Prompt-Injection Defense',
      spendguard: 'Deterministic contract revert (100% halted)',
      x402: 'Vulnerable if agent prompt is hijacked',
      rawWallet: 'Critical risk: complete wallet drainage',
    },
    {
      feature: 'Human Key Management',
      spendguard: 'Passkey / Face ID via Mera (No seed phrase)',
      x402: 'Requires raw private key management',
      rawWallet: 'Plain EOA seed phrases',
    },
    {
      feature: 'Average Request Latency',
      spendguard: '< 30 ms (Off-chain signature verify)',
      x402: '~200 - 500 ms (Network & facilitator)',
      rawWallet: '1,000+ ms (Block confirmation)',
    },
  ];

  return (
    <section className="py-12 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-monad-400 font-bold">
            Honest Differentiation
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            SpendGuard vs. x402 vs. Raw Wallets
          </h2>
          <p className="text-slate-400 text-sm">
            Why pre-funded state channels on Monad are the right architecture for autonomous agent economies.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border border-monad-900/60 bg-[#0c0d18]/90 shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase bg-slate-900/60">
                <th className="py-3 px-4 font-bold">Capability</th>
                <th className="py-3 px-4 font-bold text-monad-400">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-monad-400" />
                    AgentMesh SpendGuard
                  </div>
                </th>
                <th className="py-3 px-4 font-bold text-slate-300">Standard x402</th>
                <th className="py-3 px-4 font-bold text-slate-400">Unrestricted Agent Wallet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {comparison.map((c, i) => (
                <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-200">
                    {c.feature}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-emerald-300 bg-monad-950/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {c.spendguard}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      {c.x402}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-red-300/80">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                      {c.rawWallet}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
