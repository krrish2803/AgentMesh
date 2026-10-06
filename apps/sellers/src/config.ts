import dotenv from 'dotenv';
import { type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MONAD_TESTNET_ADDRESSES } from '@agentmesh/sdk';

dotenv.config();

export const CONFIG = {
  RPC_URL: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  SPEND_GUARD_ADDRESS: (process.env.SPEND_GUARD_ADDRESS || MONAD_TESTNET_ADDRESSES.SPEND_GUARD) as Address,
  USDC_ADDRESS: (process.env.USDC_ADDRESS || MONAD_TESTNET_ADDRESSES.USDC) as Address,
  DATA_SELLER_KEY: (process.env.DATA_SELLER_PRIVATE_KEY || '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7e22d318b122c') as Hex,
  SUMMARIZER_SELLER_KEY: (process.env.SUMMARIZER_SELLER_PRIVATE_KEY || '0x6cbed15c793ce57650b9877cf2186d80d8ee52c255dc84d771a40e5a07e1679a') as Hex,
  DATA_SELLER_PORT: parseInt(process.env.DATA_SELLER_PORT || '8101', 10),
  SUMMARIZER_SELLER_PORT: parseInt(process.env.SUMMARIZER_SELLER_PORT || '8102', 10),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'mock-key',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

export const DATA_SELLER_ACCOUNT = privateKeyToAccount(CONFIG.DATA_SELLER_KEY);
export const SUMMARIZER_SELLER_ACCOUNT = privateKeyToAccount(CONFIG.SUMMARIZER_SELLER_KEY);
