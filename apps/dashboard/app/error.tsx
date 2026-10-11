'use client';

import React from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#0f111e] border border-monad-700/60 rounded-2xl p-6 shadow-2xl shadow-black/40 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-monad-950 border border-monad-700/60 flex items-center justify-center mx-auto text-monad-400 text-xl font-black">
          !
        </div>
        <h1 className="text-lg font-black text-white tracking-tight">Something went wrong</h1>
        <p className="text-xs text-slate-400 font-mono break-all">
          {error?.message || 'Unexpected application error'}
          {error?.digest ? ` (digest: ${error.digest})` : ''}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white text-xs font-bold shadow-lg shadow-monad-700/30 transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
