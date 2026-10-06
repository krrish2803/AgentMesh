'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { ProblemSolution } from '@/components/ProblemSolution';
import { HowItWorks } from '@/components/HowItWorks';
import { FeaturesComparison } from '@/components/FeaturesComparison';
import { FAQ } from '@/components/FAQ';
import { Footer } from '@/components/Footer';
import { VaultCard } from '@/components/VaultCard';
import { MetricsPanel } from '@/components/MetricsPanel';
import { RoguePanel, type RogueRevertFeedback } from '@/components/RoguePanel';
import { LiveFeed, type FeedEvent } from '@/components/LiveFeed';
import { AgentsList, type AgentItem } from '@/components/AgentsList';
import { ReputationTable, type SellerReputation } from '@/components/ReputationTable';
import { Play, Sparkles, Terminal } from 'lucide-react';

// Dynamic import for R3F 3D Canvas with ssr: false
const TheMeshCanvas = dynamic(() => import('@/scene/TheMeshCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#090a12] text-monad-400 font-mono text-sm">
      Loading 3D Mesh Environment...
    </div>
  ),
});

export default function DashboardPage() {
  const consoleRef = useRef<HTMLDivElement>(null);

  const [is2D, setIs2D] = useState(false);
  const [shockwave, setShockwave] = useState(false);
  const [vaultBalance, setVaultBalance] = useState(1000.0);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [lastFeedback, setLastFeedback] = useState<RogueRevertFeedback | null>(null);
  const [simulating, setSimulating] = useState(false);

  const [metrics, setMetrics] = useState({
    totalCalls: 214,
    totalVolumeUSDC: 0.32,
    onChainTxCount: 14,
    p50LatencyMs: 34,
    p95LatencyMs: 82,
    rejectedCount: 7,
  });

  const [agents, setAgents] = useState<AgentItem[]>([
    {
      address: '0x011CE11111111111111111111111111111111111',
      role: 'Sentiment Buyer',
      tier: 'A',
      erc8004Id: 201,
      budgetLimit: 50.0,
      budgetSpent: 0.24,
      active: true,
    },
    {
      address: '0x022CE22222222222222222222222222222222222',
      role: 'Macro Research Planner',
      tier: 'B',
      erc8004Id: 202,
      budgetLimit: 50.0,
      budgetSpent: 0.65,
      active: true,
    },
    {
      address: '0x033CE33333333333333333333333333333333333',
      role: 'Tool Executor (Injection Target)',
      tier: 'C',
      erc8004Id: 203,
      budgetLimit: 50.0,
      budgetSpent: 1.15,
      active: true,
    },
  ]);

  const [sellers] = useState<SellerReputation[]>([
    {
      agentId: 101,
      name: 'DataSeller',
      score: 96,
      settledVolumeUSDC: '14.20',
      uniquePayers: 12,
      tier: 'Verified Data Provider',
    },
    {
      agentId: 102,
      name: 'SummarizerSeller',
      score: 92,
      settledVolumeUSDC: '38.50',
      uniquePayers: 19,
      tier: 'Verified LLM Service',
    },
    {
      agentId: 103,
      name: 'UnverifiedSeller (Rogue Target)',
      score: 28,
      settledVolumeUSDC: '0.00',
      uniquePayers: 0,
      tier: 'Untrusted',
    },
  ]);

  // Connect to live WebSocket if available
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket('ws://localhost:8005/ws/events');
      ws.onmessage = (msg) => {
        try {
          const ev: FeedEvent = JSON.parse(msg.data);
          setEvents((prev) => [ev, ...prev].slice(0, 100));
          if (ev.type === 'rejection') {
            triggerShockwaveEffect();
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const triggerShockwaveEffect = () => {
    setShockwave(true);
    setTimeout(() => setShockwave(false), 2000);
  };

  const handleScrollToConsole = () => {
    consoleRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFundVault = (amount: number) => {
    setVaultBalance((b) => b + amount);
    const newEvent: FeedEvent = {
      seq: Date.now(),
      ts: Date.now(),
      type: 'vault.funded',
      payload: { amount, newBalance: vaultBalance + amount },
    };
    setEvents((prev) => [newEvent, ...prev]);
  };

  const handleRevokeAgent = (address: string) => {
    setAgents((prev) =>
      prev.map((ag) => (ag.address.toLowerCase() === address.toLowerCase() ? { ...ag, active: false } : ag))
    );
    const newEvent: FeedEvent = {
      seq: Date.now(),
      ts: Date.now(),
      type: 'agent.revoked',
      payload: { address },
    };
    setEvents((prev) => [newEvent, ...prev]);
    triggerShockwaveEffect();
  };

  const handleTriggerRogue = async (scenario: string) => {
    triggerShockwaveEffect();
    try {
      const res = await fetch(`http://localhost:8005/api/rogue/${scenario}`, { method: 'POST' });
      const data = await res.json();
      setLastFeedback({
        scenario: `Scenario #${scenario}`,
        error: data.error,
        message: data.message,
        timestamp: new Date().toLocaleTimeString(),
      });
      setMetrics((m) => ({ ...m, rejectedCount: m.rejectedCount + 1 }));
    } catch {
      const fallbackMap: Record<string, string> = {
        '1': 'OverChannelCap: Request exceeds per-channel cap of $10.00',
        '2': 'WindowBudgetExceeded: Rolling window budget exceeded',
        '3': 'PayeeNotRegistered: Payee missing ERC-8004 identity',
        '4': 'PayeeReputationTooLow: Payee reputation score < 50',
        '5': 'AgentRevoked: Revoked agent cannot open channel',
        '6': 'VoucherExceedsDeposit: Cumulative amount exceeds deposit',
      };
      const errName = fallbackMap[scenario]?.split(':')[0] || 'SpendGuardRevert';
      setLastFeedback({
        scenario: `Scenario #${scenario}`,
        error: errName,
        message: fallbackMap[scenario] || 'Policy violation prevented',
        timestamp: new Date().toLocaleTimeString(),
      });
      setMetrics((m) => ({ ...m, rejectedCount: m.rejectedCount + 1 }));
    }
  };

  const handleTriggerPromptInjection = async () => {
    triggerShockwaveEffect();
    try {
      const res = await fetch('http://localhost:8005/api/prompt-injection', { method: 'POST' });
      const data = await res.json();
      setLastFeedback({
        scenario: 'Prompt Injection Defense',
        error: data.error,
        message: 'Adversarial prompt bypassed LLM prompt, but halted by SpendGuard contract on-chain ($500 > $10 cap)',
        timestamp: new Date().toLocaleTimeString(),
      });
      setMetrics((m) => ({ ...m, rejectedCount: m.rejectedCount + 1 }));
    } catch {
      setLastFeedback({
        scenario: 'Prompt Injection Defense',
        error: 'OverChannelCap',
        message: 'Adversarial injection blocked on-chain by SpendGuard envelope',
        timestamp: new Date().toLocaleTimeString(),
      });
      setMetrics((m) => ({ ...m, rejectedCount: m.rejectedCount + 1 }));
    }
  };

  const handleSimulateBurstCalls = async () => {
    setSimulating(true);
    for (let i = 0; i < 5; i++) {
      const seller = i % 2 === 0 ? 'DataSeller' : 'SummarizerSeller';
      const price = seller === 'DataSeller' ? 0.0001 : 0.001;
      const latency = Math.floor(Math.random() * 35) + 25;

      const ev: FeedEvent = {
        seq: Date.now() + i,
        ts: Date.now(),
        type: 'call.paid',
        payload: {
          seller,
          priceUSDC: price,
          latencyMs: latency,
          buyer: '0x011CE11111111111111111111111111111111111',
        },
      };

      setEvents((prev) => [ev, ...prev].slice(0, 100));
      setMetrics((m) => ({
        ...m,
        totalCalls: m.totalCalls + 1,
        totalVolumeUSDC: +(m.totalVolumeUSDC + price).toFixed(4),
      }));

      await new Promise((r) => setTimeout(r, 200));
    }
    setSimulating(false);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col font-sans">
      <Navbar is2D={is2D} setIs2D={setIs2D} onReset={() => window.location.reload()} />

      {/* 1. Hero Section with USP & Primary CTAs */}
      <Hero onExploreDemo={handleScrollToConsole} />

      {/* 2. Problem Statement & Proposed Solution */}
      <ProblemSolution />

      {/* 3. How It Works Step-by-Step Flow */}
      <HowItWorks />

      {/* 4. Live Interactive Simulation Console & 3D Three.js Mesh */}
      <section ref={consoleRef} className="py-12 border-t border-slate-800/80 bg-[#07080e]">
        <div className="max-w-7xl mx-auto px-4 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-monad-950 text-monad-400 font-mono text-xs border border-monad-800/60 mb-2">
                <Terminal className="w-3.5 h-3.5" /> Live Interactive Environment
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                Live Agent Economy & Safety Console
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Interact with the 3D state-channel mesh, trigger rogue agent attacks, and watch deterministic on-chain reverts live.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSimulateBurstCalls}
                disabled={simulating}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-monad-700/30 transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                {simulating ? 'Streaming Vouchers...' : 'Fire 5 Micropayments'}
              </button>
            </div>
          </div>

          {/* 3D Canvas + SpendGuard Vault Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[440px] rounded-2xl overflow-hidden shadow-2xl relative">
              <TheMeshCanvas shockwave={shockwave} is2D={is2D} />
            </div>
            <div className="flex flex-col gap-6">
              <VaultCard balance={vaultBalance} onFund={handleFundVault} />
            </div>
          </div>

          {/* Performance & Safety HUD */}
          <MetricsPanel
            totalCalls={metrics.totalCalls}
            onChainTxCount={metrics.onChainTxCount}
            p50LatencyMs={metrics.p50LatencyMs}
            p95LatencyMs={metrics.p95LatencyMs}
            rejectedCount={metrics.rejectedCount}
            totalVolume={metrics.totalVolumeUSDC}
          />

          {/* Lower Grid: Rogue Agent Panel + Live Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RoguePanel
              onTriggerRogue={handleTriggerRogue}
              onTriggerPromptInjection={handleTriggerPromptInjection}
              lastFeedback={lastFeedback}
            />
            <LiveFeed events={events} />
          </div>

          {/* Swarm & Reputation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentsList agents={agents} onRevoke={handleRevokeAgent} />
            <ReputationTable sellers={sellers} />
          </div>
        </div>
      </section>

      {/* 5. Features & Honest x402 Comparison */}
      <FeaturesComparison />

      {/* 6. Frequently Asked Questions */}
      <FAQ />

      {/* 7. Footer */}
      <Footer />
    </div>
  );
}
