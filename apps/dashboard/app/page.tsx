'use client';

import React, { useRef } from 'react';
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
import { RoguePanel } from '@/components/RoguePanel';
import { SafetyReport } from '@/components/SafetyReport';
import { LiveStatsStrip } from '@/components/LiveStatsStrip';
import { LiveFeed } from '@/components/LiveFeed';
import { AgentsList } from '@/components/AgentsList';
import { ReputationTable } from '@/components/ReputationTable';
import { Terminal } from 'lucide-react';
import { useSpendGuardConsole } from '@/lib/useSpendGuardConsole';

// Dynamic import for R3F 3D Canvas with ssr: false
const TheMeshCanvas = dynamic(() => import('@/scene/TheMeshCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#090a12] text-monad-400 font-mono text-sm">
      Loading 3D Mesh Environment...
    </div>
  ),
});

export default function LandingPage() {
  const consoleRef = useRef<HTMLDivElement>(null);

  const {
    is2D,
    setIs2D,
    shockwave,
    vault,
    vaultStatus,
    control,
    events,
    lastFeedback,
    safetyReport,
    metrics,
    metricsStatus,
    agentsStatus,
    agents,
    sellers,
    fundVault,
    revokeAgent,
    reinstateAgent,
    handleTriggerRogue,
  } = useSpendGuardConsole();

  const handleScrollToConsole = () => {
    consoleRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          </div>

          {/* Live number strip: paid calls vs on-chain txs proves the channel economics */}
          <LiveStatsStrip metrics={metrics} status={metricsStatus} />

          {/* 3D Canvas + SpendGuard Vault Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[440px] rounded-2xl overflow-hidden shadow-2xl relative">
              <TheMeshCanvas shockwave={shockwave} is2D={is2D} vaultBalance={vault.vaultBalanceUSDC ?? 0} />
            </div>
            <div className="flex flex-col gap-6">
              <VaultCard
                balance={vault.vaultBalanceUSDC}
                ownerBalance={vault.ownerUSDCBalance}
                ownerAddress={vault.owner}
                perChannelCap={agents[0]?.maxPerChannel ?? 10}
                windowBudget={agents[0]?.budgetLimit ?? 5}
                minPayeeRep={agents[0]?.minPayeeRep ?? 50}
                control={control}
                status={vaultStatus}
                onFund={fundVault}
              />
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
            metricsStatus={metricsStatus}
          />

          {/* Lower Grid: Rogue Agent Panel + Safety Report + Live Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-6">
              <RoguePanel
                onTriggerRogue={handleTriggerRogue}
                lastFeedback={lastFeedback}
              />
              <SafetyReport rows={safetyReport} />
            </div>
            <LiveFeed events={events} />
          </div>

          {/* Swarm & Reputation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentsList
              agents={agents}
              control={control}
              status={agentsStatus}
              onRevoke={revokeAgent}
              onReinstate={reinstateAgent}
            />
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
