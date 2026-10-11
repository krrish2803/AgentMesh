'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, ExternalLink } from 'lucide-react';
import { ROGUE_SCENARIOS } from '@/lib/scenarios';

export interface RogueRevertFeedback {
  scenario: string;
  error: string;
  message: string;
  timestamp: string;
  failed?: boolean;
}

export function RoguePanel({
  onTriggerRogue,
  lastFeedback,
}: {
  onTriggerRogue: (scenario: string) => Promise<void>;
  lastFeedback: RogueRevertFeedback | null;
}) {
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);

  const scenarios = ROGUE_SCENARIOS;

  const handleRun = async (id: string) => {
    setLoadingScenario(id);
    await onTriggerRogue(id);
    setLoadingScenario(null);
  };

  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">Rogue Agent Defense Suite</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Track 04 Safety Proofs</span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Demonstrate deterministic on-chain enforcement. Each attack simulates or triggers contract revert on Monad Testnet.
      </p>

      {/* 6 Revert Scenario Buttons Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            onClick={() => handleRun(sc.id)}
            disabled={loadingScenario !== null}
            className="p-3 text-left rounded-xl bg-slate-900/90 border border-slate-800 hover:border-red-500/60 hover:bg-red-950/20 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 group-hover:text-red-300">
                  #{sc.id} {sc.title}
                </span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                  {sc.expected}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                {sc.desc}
              </p>
            </div>
            <div className="mt-2 text-[10px] font-semibold text-red-400/90 flex items-center gap-1">
              <span>{loadingScenario === sc.id ? 'Reverting...' : 'Fire Revert →'}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Prompt Injection card removed: Tier C proves this live in the agents
          app (real LLM + real on-chain revert). The server no longer fakes it. */}

      {/* Last Reverted Live Banner */}
      {lastFeedback && (
        <div
          className={`mt-3.5 p-3 rounded-xl flex items-start justify-between gap-3 animate-fadeIn border ${
            lastFeedback.failed
              ? 'bg-amber-950/60 border-amber-700/80'
              : 'bg-red-950/60 border-red-700/80'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                lastFeedback.failed ? 'text-amber-400' : 'text-red-400'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold ${
                    lastFeedback.failed ? 'text-amber-300' : 'text-red-300'
                  }`}
                >
                  {lastFeedback.failed ? 'UNVERIFIED' : 'REVERTED'}: {lastFeedback.error}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {lastFeedback.timestamp}
                </span>
              </div>
              <p
                className={`text-[11px] mt-0.5 ${
                  lastFeedback.failed ? 'text-amber-200/90' : 'text-red-200/90'
                }`}
              >
                {lastFeedback.message}
              </p>
            </div>
          </div>

          {!lastFeedback.failed && (
            <a
              href="https://testnet.monadscan.com"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1 flex-shrink-0 mt-1"
            >
              Explorer <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
