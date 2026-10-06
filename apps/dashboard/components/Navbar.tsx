'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Fingerprint,
  RefreshCw,
  CheckCircle2,
  LayoutDashboard,
  User,
  LogOut,
  ChevronDown,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from './AuthModal';

export function Navbar({
  is2D,
  setIs2D,
  onReset,
}: {
  is2D?: boolean;
  setIs2D?: (v: boolean) => void;
  onReset?: () => void;
}) {
  const { user, logout, openAuthModal } = useAuth();
  const [userDropdown, setUserDropdown] = useState(false);

  return (
    <>
      <header className="border-b border-monad-900/80 bg-[#0c0d17]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-monad-700 to-monad-500 flex items-center justify-center shadow-lg shadow-monad-600/30 group-hover:scale-105 transition-transform">
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
          </Link>

          {/* Center Network Tag */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Monad Testnet (10143)</span>
            <span className="text-slate-500">|</span>
            <span className="text-monad-400">ERC-8004 Gated</span>
          </div>

          {/* Right Actions: 2D/3D Mode, Console & Auth Buttons */}
          <div className="flex items-center gap-3">
            {/* 2D / 3D Toggle */}
            {setIs2D && (
              <button
                onClick={() => setIs2D(!is2D)}
                className="hidden sm:block px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 hover:border-monad-500 bg-slate-900 text-slate-300 transition-colors"
              >
                {is2D ? '3D View' : '2D View'}
              </button>
            )}

            {/* Link to Dedicated Dashboard */}
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-monad-950 border border-monad-700/80 hover:bg-monad-900 text-monad-200 flex items-center gap-1.5 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-monad-400" />
              <span>Console</span>
            </Link>

            {/* AUTH STATE: Logged In vs Logged Out */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdown(!userDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-600/60 text-xs hover:border-emerald-500 transition-all text-slate-200"
                >
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-emerald-300 font-medium">
                    {user.address.slice(0, 6)}...{user.address.slice(-4)}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* User Dropdown */}
                {userDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#0f111e] border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 text-xs space-y-1">
                    <div className="p-2.5 border-b border-slate-800/80">
                      <div className="font-bold text-white truncate">{user.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                        {user.address}
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Face ID Bound
                      </div>
                    </div>

                    <Link
                      href="/dashboard"
                      onClick={() => setUserDropdown(false)}
                      className="w-full p-2 text-left hover:bg-slate-800/60 rounded-xl text-slate-300 hover:text-white flex items-center gap-2 transition-colors block"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-monad-400" />
                      <span>Open Console</span>
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setUserDropdown(false);
                      }}
                      className="w-full p-2 text-left hover:bg-red-950/40 rounded-xl text-red-400 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuthModal('signin')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => openAuthModal('signup')}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-bold text-xs shadow-md shadow-monad-700/30 transition-all flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            )}

            {/* Trigger Refresh */}
            {onReset && (
              <button
                onClick={onReset}
                title="Reset telemetry counters"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Authentication Modal */}
      <AuthModal />
    </>
  );
}
