import dotenv from 'dotenv';
import { type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem/accounts';
import { MONAD_TESTNET_ADDRESSES } from '@agentmesh/sdk';

dotenv.config();

function generateEphemeralKey(): Hex {
  return generatePrivateKey();
}

const hasDataKey = !!process.env.DATA_SELLER_PRIVATE_KEY;
const hasSummKey = !!process.env.SUMMARIZER_SELLER_PRIVATE_KEY;

export const CONFIG = {
  RPC_URL: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  SPEND_GUARD_ADDRESS: (process.env.SPEND_GUARD_ADDRESS || MONAD_TESTNET_ADDRESSES.SPEND_GUARD) as Address,
  USDC_ADDRESS: (process.env.USDC_ADDRESS || MONAD_TESTNET_ADDRESSES.USDC) as Address,
  DATA_SELLER_KEY: (process.env.DATA_SELLER_PRIVATE_KEY || generateEphemeralKey()) as Hex,
  SUMMARIZER_SELLER_KEY: (process.env.SUMMARIZER_SELLER_PRIVATE_KEY || generateEphemeralKey()) as Hex,
  DATA_SELLER_PORT: parseInt(process.env.DATA_SELLER_PORT || '8101', 10),
  SUMMARIZER_SELLER_PORT: parseInt(process.env.SUMMARIZER_SELLER_PORT || '8102', 10),
  DATA_SELLER_AGENT_ID: BigInt(process.env.DATA_SELLER_AGENT_ID || '101'),
  SUMMARIZER_SELLER_AGENT_ID: BigInt(process.env.SUMMARIZER_SELLER_AGENT_ID || '102'),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'mock-key',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

if (!hasDataKey || !hasSummKey) {
  console.warn('[Config] Seller private keys not provided in env; generated ephemeral identity at startup.');
}

export const DATA_SELLER_ACCOUNT = privateKeyToAccount(CONFIG.DATA_SELLER_KEY);
export const SUMMARIZER_SELLER_ACCOUNT = privateKeyToAccount(CONFIG.SUMMARIZER_SELLER_KEY);
