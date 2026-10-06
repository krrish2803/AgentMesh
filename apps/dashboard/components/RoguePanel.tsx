'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Bug, ExternalLink, Check, Sparkles } from 'lucide-react';

export interface RogueRevertFeedback {
  scenario: string;
  error: string;
  message: string;
  timestamp: string;
}

export function RoguePanel({
  onTriggerRogue,
  onTriggerPromptInjection,
  lastFeedback,
}: {
  onTriggerRogue: (scenario: string) => Promise<void>;
  onTriggerPromptInjection: () => Promise<void>;
  lastFeedback: RogueRevertFeedback | null;
}) {
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);

  const scenarios = [
    {
      id: '1',
      title: 'Over-Cap Deposit',
      desc: 'Attempt $500 channel (> $10 policy limit)',
      expected: 'OverChannelCap',
    },
    {
      id: '2',
      title: 'Window Exhaustion',
      desc: 'Exhaust $50/hour budget limit',
      expected: 'WindowBudgetExceeded',
    },
    {
      id: '3',
      title: 'Unregistered Payee',
      desc: 'Pay seller missing ERC-8004 identity',
      expected: 'PayeeNotRegistered',
    },
    {
      id: '4',
      title: 'Low Reputation Payee',
      desc: 'Pay seller with reputation score 28 (< 50 min)',
      expected: 'PayeeReputationTooLow',
    },
    {
      id: '5',
      title: 'Revoked Agent Action',
      desc: 'Revoke agent mid-flight via Face ID',
      expected: 'AgentRevoked',
    },
    {
      id: '6',
      title: 'Inflated / Replay Voucher',
      desc: 'Submit voucher amount > channel deposit',
      expected: 'VoucherExceedsDeposit',
    },
  ];

  const handleRun = async (id: string) => {
    setLoadingScenario(id);
    await onTriggerRogue(id);
    setLoadingScenario(null);
  };

  const handlePromptInjection = async () => {
    setLoadingScenario('prompt-injection');
    await onTriggerPromptInjection();
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

      {/* Prompt Injection Live Test Card */}
      <div className="mt-3.5 p-3.5 bg-gradient-to-r from-red-950/40 via-purple-950/30 to-slate-900/80 border border-red-800/40 rounded-xl flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-bold text-white">Prompt-Injection Attack Defense</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-900/60 text-red-300 font-mono">
              Tier C Target
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Adversarial prompt attempts to command Tier C LLM to drain $500. Contract stops it cold.
          </p>
        </div>

        <button
          onClick={handlePromptInjection}
          disabled={loadingScenario !== null}
          className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex-shrink-0 transition-colors shadow-lg shadow-red-900/40"
        >
          {loadingScenario === 'prompt-injection' ? 'Testing...' : 'Inject Prompt & Prove'}
        </button>
      </div>

      {/* Last Reverted Live Banner */}
      {lastFeedback && (
        <div className="mt-3.5 p-3 bg-red-950/60 border border-red-700/80 rounded-xl flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-300">
                  REVERTED: {lastFeedback.error}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {lastFeedback.timestamp}
                </span>
              </div>
              <p className="text-[11px] text-red-200/90 mt-0.5">
                {lastFeedback.message}
              </p>
            </div>
          </div>

          <a
            href="https://testnet.monadscan.com"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1 flex-shrink-0 mt-1"
          >
            Explorer <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
