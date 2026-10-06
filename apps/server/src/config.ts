import dotenv from 'dotenv';
import { type Address } from 'viem';
import { MONAD_TESTNET_ADDRESSES } from '@agentmesh/sdk';

dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '8000', 10),
  RPC_URL: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  SPEND_GUARD_ADDRESS: (process.env.SPEND_GUARD_ADDRESS || MONAD_TESTNET_ADDRESSES.SPEND_GUARD) as Address,
  USDC_ADDRESS: (process.env.USDC_ADDRESS || MONAD_TESTNET_ADDRESSES.USDC) as Address,
  DATA_SELLER_URL: process.env.DATA_SELLER_URL || 'http://localhost:8101',
  SUMMARIZER_SELLER_URL: process.env.SUMMARIZER_SELLER_URL || 'http://localhost:8102',
  MONGODB_URI: process.env.MONGODB_URI || '',
  DASHBOARD_ORIGIN: process.env.DASHBOARD_ORIGIN || 'http://localhost:3000',
};
