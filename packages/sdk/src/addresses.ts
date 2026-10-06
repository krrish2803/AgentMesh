import { type Address } from 'viem';

export const MONAD_TESTNET_ADDRESSES = {
  USDC: '0x534b2f3A21130d7a60830c2Df862319e593943A3' as Address,
  ERC8004_IDENTITY: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as Address,
  ERC8004_REPUTATION: '0x8004B663056A597Dffe9eCcC1965A193B7388713' as Address,
  // SpendGuard address will be populated once deployed to testnet
  SPEND_GUARD: '0x0000000000000000000000000000000000000000' as Address,
} as const;
