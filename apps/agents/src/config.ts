import dotenv from 'dotenv';
import { type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MONAD_TESTNET_ADDRESSES } from '@agentmesh/sdk';

dotenv.config();

export const CONFIG = {
  RPC_URL: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  SPEND_GUARD_ADDRESS: (process.env.SPEND_GUARD_ADDRESS || MONAD_TESTNET_ADDRESSES.SPEND_GUARD) as Address,
  DATA_SELLER_URL: process.env.DATA_SELLER_URL || 'http://localhost:8101',
  SUMMARIZER_SELLER_URL: process.env.SUMMARIZER_SELLER_URL || 'http://localhost:8102',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:8000',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'mock-key',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

// Default testnet hot keys for the 3 agent tiers
export const AGENT_KEYS: { tier: 'A' | 'B' | 'C'; key: Hex }[] = [
  { tier: 'A', key: '0x395df680ab16857189d6dd5ab7b0e3775f3bdec750b305087f466477a8355d51' },
  { tier: 'B', key: '0xea6c44ac03da85d990f1f70d3007436ea927867651f9a13dec45f42e2315b0b8' },
  { tier: 'C', key: '0xae441c0ea58a74e50d51ef7dcae7c7e997a3ebf50125bb7e29cb011708173456' },
];

export const AGENT_ACCOUNTS = AGENT_KEYS.map((k) => ({
  tier: k.tier,
  account: privateKeyToAccount(k.key),
  privateKey: k.key,
}));
