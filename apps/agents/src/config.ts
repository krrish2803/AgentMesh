import dotenv from 'dotenv';
import { type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { MONAD_TESTNET_ADDRESSES } from '@agentmesh/sdk';

dotenv.config();

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const CONFIG = {
  RPC_URL: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  SPEND_GUARD_ADDRESS: (process.env.SPEND_GUARD_ADDRESS || MONAD_TESTNET_ADDRESSES.SPEND_GUARD) as Address,
  DATA_SELLER_URL: process.env.DATA_SELLER_URL || 'http://localhost:8101',
  SUMMARIZER_SELLER_URL: process.env.SUMMARIZER_SELLER_URL || 'http://localhost:8102',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'mock-key',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  // Registered ERC-8004 payee whose reputation (30) sits below the policy floor (50).
  // Used by rogue scenario 4 (PayeeReputationTooLow). Defaults match mock mode.
  LOW_REP_PAYEE: (process.env.LOW_REP_PAYEE || '0x2222222222222222222222222222222222222222') as Address,
  LOW_REP_AGENT_ID: BigInt(process.env.LOW_REP_AGENT_ID || '102'),
  // Registered high-reputation payee used by rogue scenario 6 to seed a real
  // channel before attempting an oversized claim.
  SEED_PAYEE: (process.env.SEED_PAYEE || '0x1111111111111111111111111111111111111111') as Address,
  SEED_AGENT_ID: BigInt(process.env.SEED_AGENT_ID || '101'),
};

// SpendGuard is only enforced on-chain once it is deployed; a zero address means
// every contract interaction in this app is simulated locally (mock mode).
export const MOCK_MODE: boolean = (CONFIG.SPEND_GUARD_ADDRESS as string).toLowerCase() === ZERO_ADDRESS;

// Monad base fee sits at ~100 gwei. viem's auto-estimated 1559 fees (~180 gwei)
// make it reserve gasLimit*maxFeePerGas up front, which exhausts the funded test
// agents. Cap the fee just above base so reservations stay small.
export const TX_FEE_OVERRIDES = {
  maxFeePerGas: 130_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
} as const;

function resolveAgentKey(envVar: string, tier: 'A' | 'B' | 'C'): Hex {
  const raw = process.env[envVar];
  if (raw && /^0x[0-9a-fA-F]{64}$/.test(raw)) return raw as Hex;

  if (raw) {
    console.warn(
      `[config] ${envVar} is not a 0x-prefixed 32-byte hex private key — ignoring it and generating an ephemeral key for tier ${tier}.`
    );
  } else {
    console.warn(
      `[config] ${envVar} is not set — generating an ephemeral random key for tier ${tier}. ` +
        `It is thrown away on exit; set ${envVar} to use a stable testnet key.`
    );
  }
  return generatePrivateKey();
}

// Agent hot keys come from the environment; never hardcode private keys in the repo.
export const AGENT_KEYS: { tier: 'A' | 'B' | 'C'; key: Hex }[] = [
  { tier: 'A', key: resolveAgentKey('AGENT_A_PRIVATE_KEY', 'A') },
  { tier: 'B', key: resolveAgentKey('AGENT_B_PRIVATE_KEY', 'B') },
  { tier: 'C', key: resolveAgentKey('AGENT_C_PRIVATE_KEY', 'C') },
];

export const AGENT_ACCOUNTS = AGENT_KEYS.map((k) => ({
  tier: k.tier,
  account: privateKeyToAccount(k.key),
  privateKey: k.key,
}));

// Optional payee key for the SEED_PAYEE address, so the rogue runner can settle
// the scenario-6 seed channel as the payee (payees may close before expiry).
const seedPayeeKey = process.env.SEED_PAYEE_PRIVATE_KEY || process.env.DATA_SELLER_PRIVATE_KEY;
export const SEED_PAYEE_ACCOUNT =
  seedPayeeKey && /^0x[0-9a-fA-F]{64}$/.test(seedPayeeKey)
    ? privateKeyToAccount(seedPayeeKey as Hex)
    : null;
