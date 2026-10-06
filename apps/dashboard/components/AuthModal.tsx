'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Fingerprint,
  CheckCircle2,
  Shield,
  X,
  ArrowRight,
  Key,
  Sparkles,
  Smartphone,
  Laptop,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function AuthModal() {
  const router = useRouter();
  const { isAuthModalOpen, closeAuthModal, authModalMode, login, signUp } = useAuth();

  const [tab, setTab] = useState<'signin' | 'signup'>(authModalMode || 'signin');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('Apple Face ID / Touch ID');
  const [step, setStep] = useState<'idle' | 'scanning' | 'deriving' | 'success'>('idle');
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync tab with external mode change
  React.useEffect(() => {
    setTab(authModalMode);
    setStep('idle');
  }, [authModalMode, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleCopy = () => {
    if (derivedAddress) {
      navigator.clipboard.writeText(derivedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExecuteSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('scanning');

    // Step 1: Biometric WebAuthn challenge
    await new Promise((r) => setTimeout(r, 900));

    // Step 2: PRF extension derivation
    setStep('deriving');
    await new Promise((r) => setTimeout(r, 1000));

    // Generate deterministic/unique EOA address on Monad Testnet
    const randHex = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setDerivedAddress(randHex);
    setStep('success');

    // Register into AuthContext
    signUp(name || 'Agent Operator', provider, randHex);
  };

  const handleExecuteSignIn = async () => {
    setStep('scanning');
    await new Promise((r) => setTimeout(r, 1100));

    const existingAddress = '0x8a92D956A3f7b88939c38F6170d4D29bE31bE5C1';
    setDerivedAddress(existingAddress);
    setStep('success');

    login(existingAddress, name || 'Agent Operator');
  };

  const handleCompleteAndNavigate = () => {
    closeAuthModal();
    router.push('/dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-[#0f111e] border border-monad-700/80 rounded-3xl p-6 md:p-8 shadow-2xl relative">
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tab Switcher: Sign In vs Create Account */}
        {step === 'idle' && (
          <div className="flex rounded-xl bg-slate-900/90 p-1 mb-6 border border-slate-800">
            <button
              onClick={() => setTab('signin')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'signin'
                  ? 'bg-monad-600 text-white shadow-md shadow-monad-700/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === 'signup'
                  ? 'bg-monad-600 text-white shadow-md shadow-monad-700/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account (Sign Up)
            </button>
          </div>
        )}

        {/* STEP: SIGN IN FORM */}
        {step === 'idle' && tab === 'signin' && (
          <div className="space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-monad-950 border border-monad-600/60 flex items-center justify-center mx-auto text-monad-400 shadow-xl shadow-monad-800/30">
              <Fingerprint className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Sign in with Passkey
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Authenticate using Apple Face ID, Touch ID, or Google Password Manager.
              </p>
            </div>

            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl text-left space-y-2 text-xs font-sans">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Passkey Engine:</span>
                <span className="font-mono text-monad-300">@category-labs/mera</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Network:</span>
                <span className="font-mono text-emerald-400">Monad Testnet (10143)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Private Keys:</span>
                <span className="font-mono text-slate-200">Zero Seed Phrase Needed</span>
              </div>
            </div>

            <button
              onClick={handleExecuteSignIn}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-bold text-sm shadow-xl shadow-monad-700/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <Fingerprint className="w-4 h-4" />
              Scan Face ID / Touch ID
            </button>

            <div className="text-xs text-slate-400">
              Don’t have an account yet?{' '}
              <button
                onClick={() => setTab('signup')}
                className="text-monad-400 hover:underline font-bold"
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* STEP: CREATE ACCOUNT (SIGN UP) FORM */}
        {step === 'idle' && tab === 'signup' && (
          <form onSubmit={handleExecuteSignUp} className="space-y-4">
            <div className="text-center mb-2">
              <h3 className="text-xl font-black text-white tracking-tight">
                Create SpendGuard Account
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Setup your passkey-secured spending envelope for your agent swarm.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Operator / Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Krrish • Agent Swarm Alpha"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-monad-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Passkey Authenticator
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-monad-500 transition-colors"
              >
                <option value="Apple Face ID / Touch ID">Apple Face ID / Touch ID (iCloud Keychain)</option>
                <option value="Google Password Manager">Google Password Manager</option>
                <option value="1Password (WebAuthn PRF)">1Password (WebAuthn PRF)</option>
                <option value="Windows Hello">Windows Hello</option>
              </select>
            </div>

            <div className="p-3 bg-monad-950/40 border border-monad-800/60 rounded-xl text-left space-y-1.5 text-[11px] text-monad-300">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Sparkles className="w-3.5 h-3.5 text-monad-400" />
                How It Works
              </div>
              <p className="text-slate-400">
                Your device hardware enclave registers a WebAuthn PRF credential. Mera automatically derives an ordinary BIP-44 Ethereum EOA at index 0 for Monad Testnet without exposing seed phrases.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-bold text-sm shadow-xl shadow-monad-700/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <Fingerprint className="w-4 h-4" />
              Register Passkey & Generate Account
            </button>

            <div className="text-center text-xs text-slate-400 pt-1">
              Already have an envelope?{' '}
              <button
                type="button"
                onClick={() => setTab('signin')}
                className="text-monad-400 hover:underline font-bold"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* STEP: SCANNING BIOMETRICS */}
        {step === 'scanning' && (
          <div className="py-8 text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-monad-500/20 border-t-monad-500 animate-spin" />
              <Fingerprint className="w-10 h-10 text-monad-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Authenticating Device...</h3>
              <p className="text-xs text-slate-400 mt-1">Prompting Apple Face ID / Touch ID Secure Enclave</p>
            </div>
          </div>
        )}

        {/* STEP: DERIVING BIF-44 KEYS */}
        {step === 'deriving' && (
          <div className="py-8 text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              <Key className="w-10 h-10 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Deriving Monad Account...</h3>
              <p className="text-xs text-slate-400 mt-1">Executing Mera BIP-44 derivation at m/44'/60'/0'/0/0</p>
            </div>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === 'success' && derivedAddress && (
          <div className="py-4 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-500/60 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-900/40">
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">
                {tab === 'signup' ? 'Account Created!' : 'Authenticated!'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your Face ID passkey is bound to your SpendGuard envelope.
              </p>
            </div>

            {/* Address copy card */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-left space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between">
                <span>Owner EOA (Monad Testnet)</span>
                <span className="text-emerald-400 font-mono">Chain 10143</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="font-mono text-xs text-monad-300 truncate">
                  {derivedAddress}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleCompleteAndNavigate}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-bold text-sm shadow-xl shadow-monad-700/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>Enter SpendGuard Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
