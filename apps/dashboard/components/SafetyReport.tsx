'use client';

import React from 'react';
import { ClipboardCheck, ExternalLink } from 'lucide-react';

export interface SafetyReportRow {
  scenarioId: string;
  title: string;
  error: string;
  result: 'reverted';
  explorerUrl: string | null;
  txHash?: string | null;
  ts: number;
}

export function SafetyReport({ rows }: { rows: SafetyReportRow[] }) {
  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-white tracking-tight">Safety Report</h3>
        <span className="text-[10px] font-mono text-slate-400 ml-auto">
          {rows.length}/6 scenarios exercised
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 font-mono">
          No attacks probed yet — fire the Rogue Agent Defense Suite to build the report.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="py-1.5 pr-3 font-semibold">#</th>
                <th className="py-1.5 pr-3 font-semibold">Attack</th>
                <th className="py-1.5 pr-3 font-semibold">Result</th>
                <th className="py-1.5 font-semibold text-right">On-Chain Proof</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.scenarioId}
                  className="border-b border-slate-800/60 last:border-0"
                >
                  <td className="py-2 pr-3 text-slate-500">#{row.scenarioId}</td>
                  <td className="py-2 pr-3 text-slate-200">{row.title}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/70 text-red-300 border border-red-800/60">
                      REVERTED · {row.error}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {row.explorerUrl ? (
                      <a
                        href={row.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={
                          row.txHash
                            ? `View the reverted transaction ${row.txHash} on Monadscan`
                            : 'The attack is rejected by this contract via a preflight simulation. View SpendGuard on Monadscan.'
                        }
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        {row.txHash ? `Failed tx ${row.txHash.slice(0, 6)}…` : 'Simulated by SpendGuard'}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}