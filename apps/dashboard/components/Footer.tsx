'use client';

import { Shield, ExternalLink, Code2, Terminal } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-monad-900/40 bg-[#07080d] py-12 text-xs text-slate-400">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-monad-600 flex items-center justify-center text-white">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">AgentMesh SpendGuard</div>
            <p className="text-[11px] text-slate-500">
              Built for Monad Metropolis Hackathon (Track 04)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-slate-400">
          <a
            href="https://testnet.monadscan.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white flex items-center gap-1 transition-colors"
          >
            MonadScan <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://testnet.monadvision.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white flex items-center gap-1 transition-colors"
          >
            MonadVision <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://faucet.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white flex items-center gap-1 transition-colors"
          >
            Monad Faucet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8 pt-6 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
        <p>© 2026 AgentMesh. Open source under MIT License.</p>
        <p className="font-mono">Chain ID: 10143 • Verified on Monad Testnet</p>
      </div>
    </footer>
  );
}
