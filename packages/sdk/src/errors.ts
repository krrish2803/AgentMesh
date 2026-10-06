import { decodeErrorResult } from 'viem';
import SpendGuardAbi from './abis/SpendGuard.json';

export interface DecodedContractError {
  errorName: string;
  args?: readonly unknown[];
  humanMessage: string;
}

export function decodeSpendGuardError(error: any): DecodedContractError | null {
  try {
    // Look for data field in RPC error, simulation error, or contract call error
    const data =
      error?.data ||
      error?.error?.data ||
      error?.cause?.data ||
      error?.cause?.cause?.data ||
      (typeof error?.message === 'string' && error.message.match(/0x[a-fA-F0-9]{8,}/)?.[0]);

    if (data && typeof data === 'string' && data.startsWith('0x')) {
      const decoded = decodeErrorResult({
        abi: SpendGuardAbi as any,
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
      }

      return {
        errorName: decoded.errorName,
        args: decoded.args,
        humanMessage,
      };
    }
  } catch (err) {
    // If decoding failed, check if the error message string contains error names
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
    ];

    const errStr = String(error?.message || error);
    for (const name of knownErrors) {
      if (errStr.includes(name)) {
        return {
          errorName: name,
          humanMessage: `Policy rejection: ${name}`,
        };
      }
    }
  }

  return null;
}
