'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How is SpendGuard different from standard x402?',
      a: 'Standard x402 attaches an individually settled payment authorization to each request with no payer-side spending policy and no identity gating. SpendGuard introduces policy-enforced pre-funded channels, batched settlement, and payees gated by ERC-8004 identity and reputation. The seller API returns HTTP 402 for familiarity, but the architecture scales through state channels.',
    },
    {
      q: 'What happens if an agent is prompt-injected or hallucinates?',
      a: 'The LLM only decides what to buy; it never signs directly. Deterministic code creates the transactions, and the SpendGuard smart contract enforces the policy envelope. Even if an adversarial prompt convinces the LLM to drain the vault or send funds to an attacker, the contract reverts on-chain because the amount exceeds the channel cap or the recipient fails ERC-8004 identity checks.',
    },
    {
      q: 'Why build this on Monad?',
      a: 'Monad provides sub-second finality and ultra-low transaction costs. While state channels handle off-chain micro-vouchers (< 30ms latency), Monad enables fast, cheap on-chain channel openings, batched claims, and instant remainder refunds. Fast finality makes dynamic channel lifecycle management practical.',
    },
    {
      q: 'How does ERC-8004 reputation work, and how is wash-trading mitigated?',
      a: 'SpendGuard integrates directly with the ERC-8004 Identity and Reputation registries deployed on Monad Testnet. To mitigate wash-trading, SpendGuard tracks unique distinct payers and allows owners to set strict minimum threshold scores. Untrusted sellers with low or artificial scores are automatically blocked.',
    },
    {
      q: 'What happens when a human revokes an agent mid-flight?',
      a: 'When an owner hits Revoke via Face ID, the contract marks the agent policy inactive. Any in-flight claims or new channel openings signed by that agent fail immediately with the AgentRevoked custom error. Open channels can still be safely closed to refund remaining deposits back to the owner vault.',
    },
  ];

  return (
    <section className="py-12 border-t border-slate-800/80">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-monad-400 font-bold">
            Frequently Asked Questions
          </span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400 text-sm">
            Everything you need to know about SpendGuard, Monad settlement, and agent security.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-monad-400 flex-shrink-0" />
                    {f.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-monad-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-800/40">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
