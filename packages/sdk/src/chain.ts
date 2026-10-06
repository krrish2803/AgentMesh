import { defineChain } from 'viem';

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
    public: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadScan',
      url: 'https://testnet.monadscan.com',
    },
    vision: {
      name: 'MonadVision',
      url: 'https://testnet.monadvision.com',
    },
  },
  testnet: true,
});
