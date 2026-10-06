'use client';

import React from 'react';
import { Shield, Fingerprint, ArrowRight, Zap, CheckCircle2, Lock, Cpu } from 'lucide-react';

export function Hero({ onExploreDemo }: { onExploreDemo: () => void }) {
  return (
    <section className="relative pt-12 pb-16 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-monad-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-10 left-1/4 w-[300px] h-[200px] bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 text-center relative z-10 space-y-6">
        {/* Track Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-monad-950/80 border border-monad-700/60 text-xs font-mono text-monad-300 shadow-lg shadow-monad-900/30">
          <Shield className="w-3.5 h-3.5 text-monad-400" />
          <span>Monad Metropolis • Track 04: Trust, Identity & AI Infrastructure</span>
        </div>

        {/* Clear USP Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.12]">
          A Passkey-Secured Spending Envelope for{' '}
          <span className="bg-gradient-to-r from-monad-400 via-purple-300 to-sky-400 bg-clip-text text-transparent">
            Autonomous AI Agents
          </span>
        </h1>

        {/* Clear Subtitle & Core Motto */}
        <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
          A human sets a budget with <span className="text-white font-semibold">Face ID</span>. Agents pay each other per call through <span className="text-white font-semibold">pre-funded payment channels</span> on Monad. Payees are gated by <span className="text-white font-semibold">ERC-8004 identity & reputation</span>, and the contract deterministically refuses anything outside the envelope.
        </p>

        {/* Design Principle Pill */}
        <div className="inline-block px-4 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 font-mono">
          💡 <span className="text-slate-200">Design Principle:</span> The LLM decides what to buy. Deterministic code signs. The contract enforces.
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={onExploreDemo}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-bold text-sm shadow-xl shadow-monad-700/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            Launch Interactive Simulation
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="https://testnet.monadscan.com"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-700/80 flex items-center gap-2 transition-colors"
          >
            <Lock className="w-4 h-4 text-monad-400" />
            Monad Testnet Contracts (10143)
          </a>
        </div>

        {/* Stat Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-slate-800/80">
          <div className="p-3 text-left">
            <div className="text-xs text-slate-400 font-medium">Voucher Latency</div>
            <div className="text-2xl font-black text-white mt-0.5">&lt; 30 ms</div>
            <div className="text-[11px] text-emerald-400 font-mono mt-0.5">Off-chain EIP-712</div>
          </div>
          <div className="p-3 text-left">
            <div className="text-xs text-slate-400 font-medium">On-Chain Efficiency</div>
            <div className="text-2xl font-black text-sky-400 mt-0.5">15.3x</div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">Batched claims</div>
          </div>
          <div className="p-3 text-left">
            <div className="text-xs text-slate-400 font-medium">Owner Onboarding</div>
            <div className="text-2xl font-black text-monad-400 mt-0.5">Face ID</div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">Zero seed phrases</div>
          </div>
          <div className="p-3 text-left">
            <div className="text-xs text-slate-400 font-medium">Safety Guarantee</div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">Deterministic</div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">Zero budget leakage</div>
          </div>
        </div>
      </div>
    </section>
  );
}
