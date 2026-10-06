'use client';

import React, { useState } from 'react';
import { Shield, Fingerprint, RefreshCw, CheckCircle2 } from 'lucide-react';

export function Navbar({
  is2D,
  setIs2D,
  onReset,
}: {
  is2D: boolean;
  setIs2D: (v: boolean) => void;
  onReset: () => void;
}) {
  const [passkeyActive, setPasskeyActive] = useState(true);

  return (
    <header className="border-b border-monad-900/80 bg-[#0c0d17]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-monad-700 to-monad-500 flex items-center justify-center shadow-lg shadow-monad-600/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-monad-400 bg-clip-text text-transparent">
                AgentMesh
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-monad-900 text-monad-300 font-mono font-medium border border-monad-700/50">
                SpendGuard
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Monad Metropolis • Track 04
            </p>
          </div>
        </div>

        {/* Center Network Tag */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">Monad Testnet (10143)</span>
          <span className="text-slate-500">|</span>
          <span className="text-monad-400">ERC-8004 Verified</span>
        </div>

        {/* Right Actions: Passkey & 2D/3D Mode */}
        <div className="flex items-center gap-3">
          {/* 2D / 3D Toggle */}
          <button
            onClick={() => setIs2D(!is2D)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 hover:border-monad-500 bg-slate-900 text-slate-300 transition-colors"
          >
            {is2D ? 'Switch to 3D View' : 'Switch to 2D Mode'}
          </button>

          {/* Passkey Face ID Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-monad-950/70 border border-monad-700/60 text-xs">
            <Fingerprint className="w-4 h-4 text-monad-400" />
            <span className="font-medium text-slate-200">Face ID Enforced</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          {/* Trigger Refresh */}
          <button
            onClick={onReset}
            title="Reset telemetry counters"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
