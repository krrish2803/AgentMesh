'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { VaultCard } from '@/components/VaultCard';
import { MetricsPanel } from '@/components/MetricsPanel';
import { RoguePanel } from '@/components/RoguePanel';
import { SafetyReport } from '@/components/SafetyReport';
import { LiveStatsStrip } from '@/components/LiveStatsStrip';
import { LiveFeed } from '@/components/LiveFeed';
import { AgentsList } from '@/components/AgentsList';
import { ReputationTable } from '@/components/ReputationTable';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { useSpendGuardConsole } from '@/lib/useSpendGuardConsole';

const TheMeshCanvas = dynamic(() => import('@/scene/TheMeshCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#090a12] text-monad-400 font-mono text-sm">
      Loading 3D Mesh Environment...
    </div>
  ),
});

export default function DedicatedDashboardPage() {
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

  const ownerLabel = vault.owner
    ? `${vault.owner.slice(0, 8)}…${vault.owner.slice(-4)}`
    : '—';

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col font-sans">
      <Navbar is2D={is2D} setIs2D={setIs2D} onReset={() => window.location.reload()} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Top Control Bar */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Return to Home Landing Page"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">SpendGuard Live Console</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-monad-900 text-monad-300 border border-monad-700">
                  Track 04
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connected Owner: <span className="font-mono text-slate-200">{ownerLabel}</span>
                {control ? ' • Server signing enabled' : ' • Read-only (owner key not configured)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://faucet.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
            >
              MON Faucet <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Live number strip: paid calls vs on-chain txs proves the channel economics */}
        <LiveStatsStrip metrics={metrics} status={metricsStatus} />

        {/* 3D The Mesh Canvas + SpendGuard Vault Card */}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-monad-900/40 py-4 text-center text-xs text-slate-500 font-mono">
        AgentMesh SpendGuard • Monad Metropolis Track 04 • Passkey Envelope & Payment Channels
      </footer>
    </div>
  );
}
