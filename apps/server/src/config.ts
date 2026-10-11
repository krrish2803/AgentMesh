import dotenv from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';
import { MONAD_TESTNET_ADDRESSES } from '@agentmesh/sdk';

dotenv.config();

function sellerAddress(privKey: `0x${string}` | undefined): `0x${string}` {
  if (!privKey) return '0x0000000000000000000000000000000000000000';
  return privateKeyToAccount(privKey).address;
}

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '8005', 10),
  RPC_URL: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  SPEND_GUARD_ADDRESS: (process.env.SPEND_GUARD_ADDRESS ||
    MONAD_TESTNET_ADDRESSES.SPEND_GUARD) as `0x${string}`,
  USDC_ADDRESS: (process.env.USDC_ADDRESS ||
    MONAD_TESTNET_ADDRESSES.USDC) as `0x${string}`,
  REPUTATION_REGISTRY_ADDRESS: (process.env.REPUTATION_REGISTRY_ADDRESS ||
    MONAD_TESTNET_ADDRESSES.ERC8004_REPUTATION) as `0x${string}`,
  MONGODB_URI: process.env.MONGODB_URI || '',
  DASHBOARD_ORIGIN: process.env.DASHBOARD_ORIGIN || 'http://localhost:3000',
  // Registered sellers (derived from the same keys the sellers app uses).
  DATA_SELLER: sellerAddress(process.env.DATA_SELLER_PRIVATE_KEY as `0x${string}` | undefined),
  SUMMARIZER_SELLER: sellerAddress(
    process.env.SUMMARIZER_SELLER_PRIVATE_KEY as `0x${string}` | undefined
  ),
  DATA_SELLER_AGENT_ID: BigInt(process.env.DATA_SELLER_AGENT_ID || '2078'),
  SUMMARIZER_SELLER_AGENT_ID: BigInt(process.env.SUMMARIZER_SELLER_AGENT_ID || '2079'),
  // Registered payee whose ERC-8004 reputation sits below the policy floor.
  LOW_REP_PAYEE: (process.env.LOW_REP_PAYEE ||
    '0x2222222222222222222222222222222222222222') as `0x${string}`,
  LOW_REP_AGENT_ID: BigInt(process.env.LOW_REP_AGENT_ID || '2080'),
  // SpendGuard on-chain owner (deployer) — signs real fund()/revokeAgent()/setPolicy().
  OWNER_PRIVATE_KEY: (process.env.DEPLOYER_PRIVATE_KEY ||
    process.env.OWNER_PRIVATE_KEY) as `0x${string}` | undefined,
  // The live buyer swarm agents (Tier A/B/C) whose on-chain policy the dashboard reflects.
  AGENT_KEYS: [
    {
      tier: 'A' as const,
      role: 'Sentiment Buyer (Deterministic Tier A)',
      key: process.env.AGENT_A_PRIVATE_KEY as `0x${string}` | undefined,
    },
    {
      tier: 'B' as const,
      role: 'Macro Research Planner (5% LLM Tier B)',
      key: process.env.AGENT_B_PRIVATE_KEY as `0x${string}` | undefined,
    },
    {
      tier: 'C' as const,
      role: 'Autonomous Tool Executor (Tier C Prompt-Injection Target)',
      key: process.env.AGENT_C_PRIVATE_KEY as `0x${string}` | undefined,
    },
  ],
};
