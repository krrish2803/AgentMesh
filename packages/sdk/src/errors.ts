import { decodeErrorResult } from 'viem';
import type { Abi } from 'viem';
import SpendGuardAbi from './abis/SpendGuard.json';

export interface DecodedContractError {
  errorName: string;
  args?: readonly unknown[];
  humanMessage: string;
}

export function decodeSpendGuardError(error: unknown): DecodedContractError | null {
  const knownErrors = [
    'OverChannelCap',
    'WindowBudgetExceeded',
    'PayeeNotRegistered',
    'PayeeReputationTooLow',
    'AgentRevoked',
    'PolicyExpired',
    'InvalidVoucher',
    'VoucherExceedsDeposit',
    'ChannelNotOpen',
    'ChannelExpired',
    'InsufficientVaultBalance',
    'InvalidCumulativeAmount',
    'ChannelNotExpirableYet',
    'OnlyOwner',
    'OnlyPayee',
    'ZeroAddress',
    'OnlyPendingOwner',
    'InvalidChannelExpiry',
    'InvalidPolicyWindow',
    'InvalidPolicyBudget',
    'InvalidPolicyExpiry',
    'ZeroAmount',
  ];

  let decodedFromHex: DecodedContractError | null = null;

  try {
    // Look for data field in RPC error, simulation error, or contract call error
    const errorObj = error as any;
    let data: any =
      errorObj?.data ||
      errorObj?.error?.data ||
      errorObj?.cause?.data ||
      errorObj?.cause?.cause?.data;

    // Extract hex from message if not found
    if (!data && typeof errorObj?.message === 'string') {
      const match = errorObj.message.match(/0x[a-fA-F0-9]{8,}/);
      if (match?.[0]) {
        data = match[0];
      }
    }

    // Only proceed if data is a string starting with 0x
    if (data && typeof data === 'string' && data.startsWith('0x')) {
      const decoded = decodeErrorResult({
        abi: SpendGuardAbi as Abi,
        data: data as `0x${string}`,
      });

      let humanMessage = `SpendGuard error: ${decoded.errorName}`;
      switch (decoded.errorName) {
        case 'OverChannelCap':
          humanMessage = 'Deposit exceeds per-channel cap set in agent policy.';
          break;
        case 'WindowBudgetExceeded':
          humanMessage = 'Rolling window budget exceeded for this agent envelope.';
          break;
        case 'PayeeNotRegistered':
          humanMessage = 'Target payee is not registered in the ERC-8004 Identity Registry.';
          break;
        case 'PayeeReputationTooLow':
          humanMessage = 'Payee reputation score is lower than minimum policy threshold.';
          break;
        case 'AgentRevoked':
          humanMessage = 'Agent key has been revoked by the owner.';
          break;
        case 'PolicyExpired':
          humanMessage = 'Agent spending envelope policy has expired.';
          break;
        case 'InvalidVoucher':
          humanMessage = 'Voucher signature verification failed or signer does not match channel agent.';
          break;
        case 'VoucherExceedsDeposit':
          humanMessage = 'Cumulative voucher amount exceeds the locked channel deposit.';
          break;
        case 'ChannelNotOpen':
          humanMessage = 'Payment channel is either closed or does not exist.';
          break;
        case 'ChannelExpired':
          humanMessage = 'Channel has expired and cannot accept claims.';
          break;
        case 'InsufficientVaultBalance':
          humanMessage = 'SpendGuard vault does not have enough unlocked USDC.';
          break;
        case 'InvalidCumulativeAmount':
          humanMessage = 'Invalid cumulative amount.';
          break;
        case 'ChannelNotExpirableYet':
          humanMessage = 'Channel is not expirable yet.';
          break;
        case 'OnlyOwner':
          humanMessage = 'Caller is not the owner.';
          break;
        case 'OnlyPayee':
          humanMessage = 'Caller is not the payee.';
          break;
        case 'ZeroAddress':
          humanMessage = 'Address cannot be zero.';
          break;
        case 'OnlyPendingOwner':
          humanMessage = 'Caller is not the pending owner.';
          break;
        case 'InvalidChannelExpiry':
          humanMessage = 'Invalid channel expiry.';
          break;
        case 'InvalidPolicyWindow':
          humanMessage = 'Invalid policy window.';
          break;
        case 'InvalidPolicyBudget':
          humanMessage = 'Invalid policy budget.';
          break;
        case 'InvalidPolicyExpiry':
          humanMessage = 'Invalid policy expiry.';
          break;
        case 'ZeroAmount':
          humanMessage = 'Amount cannot be zero.';
          break;
      }

      decodedFromHex = {
        errorName: decoded.errorName,
        args: decoded.args,
        humanMessage,
      };
    }
  } catch (err) {
    decodedFromHex = null;
  }

  // Always scan for string-based error names if hex decoding failed or didn't find match
  const errStr = String((error as any)?.message || (error as any)?.reason || error || '');
  for (const name of knownErrors) {
    if (errStr.includes(name)) {
      return {
        errorName: name,
        humanMessage: `Policy rejection: ${name}`,
      };
    }
  }

  return decodedFromHex;
}
