import {
  type Address,
  type Hex,
  verifyTypedData,
  hashTypedData,
  type Account,
} from 'viem';
import { monadTestnet } from './chain.js';

export const VOUCHER_EIP712_TYPES = {
  Voucher: [
    { name: 'channelId', type: 'bytes32' },
    { name: 'cumulativeAmount', type: 'uint256' },
  ],
} as const;

export interface VoucherData {
  channelId: Hex;
  cumulativeAmount: bigint;
}

export function getVoucherDomain(verifyingContract: Address, chainId: number = monadTestnet.id) {
  return {
    name: 'SpendGuard',
    version: '1',
    chainId: BigInt(chainId),
    verifyingContract,
  } as const;
}

export function hashVoucher(
  voucher: VoucherData,
  verifyingContract: Address,
  chainId: number = monadTestnet.id
): Hex {
  return hashTypedData({
    domain: getVoucherDomain(verifyingContract, chainId),
    types: VOUCHER_EIP712_TYPES,
    primaryType: 'Voucher',
    message: {
      channelId: voucher.channelId,
      cumulativeAmount: voucher.cumulativeAmount,
    },
  });
}

export async function signVoucher(
  account: { signTypedData: (params: any) => Promise<Hex> },
  voucher: VoucherData,
  verifyingContract: Address,
  chainId: number = monadTestnet.id
): Promise<Hex> {
  return account.signTypedData({
    domain: getVoucherDomain(verifyingContract, chainId),
    types: VOUCHER_EIP712_TYPES,
    primaryType: 'Voucher',
    message: {
      channelId: voucher.channelId,
      cumulativeAmount: voucher.cumulativeAmount,
    },
  });
}

export async function verifyVoucherSignature(params: {
  address: Address;
  signature: Hex;
  voucher: VoucherData;
  verifyingContract: Address;
  chainId?: number;
}): Promise<boolean> {
  const { address, signature, voucher, verifyingContract, chainId = monadTestnet.id } = params;
  return verifyTypedData({
    address,
    domain: getVoucherDomain(verifyingContract, chainId),
    types: VOUCHER_EIP712_TYPES,
    primaryType: 'Voucher',
    message: {
      channelId: voucher.channelId,
      cumulativeAmount: voucher.cumulativeAmount,
    },
    signature,
  });
}
