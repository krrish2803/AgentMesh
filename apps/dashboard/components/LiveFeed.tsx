'use client';

import React, { useState } from 'react';
import { Radio, CheckCircle, ShieldAlert, Zap, FileText } from 'lucide-react';

export interface FeedEvent {
  seq: number;
  ts: number;
  type: string;
  payload: any;
}

export function LiveFeed({ events }: { events: FeedEvent[] }) {
  const [filter, setFilter] = useState<'all' | 'call.paid' | 'rejection' | 'chain'>('all');

  const filtered = events.filter((ev) => {
    if (filter === 'all') return true;
    if (filter === 'call.paid') return ev.type === 'call.paid';
    if (filter === 'rejection') return ev.type === 'rejection';
    if (filter === 'chain') return ev.type.includes('channel') || ev.type.includes('claim');
    return true;
  });

  return (
    <div className="bg-[#0f111e]/90 border border-monad-900/80 rounded-2xl p-5 shadow-xl shadow-black/40 flex flex-col h-[480px]">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h3 className="text-sm font-bold text-white tracking-tight">Live Event Stream</h3>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[10px]">
          {(['all', 'call.paid', 'rejection', 'chain'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded capitalize font-medium transition-colors ${
                filter === f
                  ? 'bg-monad-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'call.paid' ? 'Calls' : f === 'chain' ? 'On-Chain' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            Waiting for economy events...
          </div>
        ) : (
          filtered.map((ev) => {
            const isRejection = ev.type === 'rejection';
            const isCall = ev.type === 'call.paid';
            const timeStr = new Date(ev.ts).toLocaleTimeString();

            return (
              <div
                key={ev.seq}
                className={`p-2.5 rounded-xl border transition-all ${
                  isRejection
                    ? 'bg-red-950/40 border-red-800/80 text-red-200'
                    : isCall
                    ? 'bg-slate-900/60 border-slate-800 text-slate-200'
                    : 'bg-monad-950/40 border-monad-800/60 text-monad-200'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="flex items-center gap-1 font-semibold">
                    {isRejection && <ShieldAlert className="w-3 h-3 text-red-400" />}
                    {isCall && <Zap className="w-3 h-3 text-amber-400" />}
                    {!isRejection && !isCall && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                    <span className="uppercase">{ev.type}</span>
                  </span>
                  <span>{timeStr}</span>
                </div>

                {isCall && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      Voucher Paid: {ev.payload.seller} (${ev.payload.priceUSDC})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold">
                      {ev.payload.latencyMs}ms
                    </span>
                  </div>
                )}

                {isRejection && (
                  <div className="text-xs">
                    <div className="font-bold text-red-400">
                      BLOCKED: {ev.payload.error}
                    </div>
                    <div className="text-[11px] text-red-300/80 mt-0.5">
                      {ev.payload.humanMessage}
                    </div>
                  </div>
                )}

                {!isCall && !isRejection && (
                  <div className="text-[11px] text-slate-300 truncate">
                    {JSON.stringify(ev.payload)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
