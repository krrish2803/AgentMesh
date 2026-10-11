export interface RogueScenario {
  id: string;
  title: string;
  desc: string;
  expected: string;
}

export const ROGUE_SCENARIOS: RogueScenario[] = [
  {
    id: '1',
    title: 'Over-Cap Deposit',
    desc: 'Attempt $500 channel (> $10 policy limit)',
    expected: 'OverChannelCap',
  },
  {
    id: '2',
    title: 'Window Exhaustion',
    desc: 'Exhaust $5/hour budget limit',
    expected: 'WindowBudgetExceeded',
  },
  {
    id: '3',
    title: 'Unregistered Payee',
    desc: 'Pay seller missing ERC-8004 identity',
    expected: 'PayeeNotRegistered',
  },
  {
    id: '4',
    title: 'Low Reputation Payee',
    desc: 'Pay seller with reputation score 30 (< 50 min)',
    expected: 'PayeeReputationTooLow',
  },
  {
    id: '5',
    title: 'Revoked Agent Action',
    desc: 'Revoke agent mid-flight via Face ID',
    expected: 'AgentRevoked',
  },
  {
    id: '6',
    title: 'Inflated / Replay Voucher',
    desc: 'Submit voucher amount > channel deposit',
    expected: 'VoucherExceedsDeposit',
  },
];

export const ROGUE_TITLES: Record<string, string> = Object.fromEntries(
  ROGUE_SCENARIOS.map((s) => [s.id, s.title])
);