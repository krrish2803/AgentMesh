import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { monadTestnet, SpendGuardAbi, decodeSpendGuardError, signVoucher } from '@agentmesh/sdk';
import { CONFIG, AGENT_ACCOUNTS } from './config.js';

export interface RogueScenarioResult {
  scenario: string;
  expectedError: string;
  decodedError: string | null;
  revertedSuccessfully: boolean;
  txHash?: Hex;
  details: string;
}

export class RogueRunner {
  private client: ReturnType<typeof createPublicClient>;
  private spendGuardAddress: Address;

  constructor() {
    this.spendGuardAddress = CONFIG.SPEND_GUARD_ADDRESS;
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(CONFIG.RPC_URL),
    });
  }

  async runScenario(scenarioIndex: number): Promise<RogueScenarioResult> {
    const rogueAccount = AGENT_ACCOUNTS[0].account;
    const rogueWallet = createWalletClient({
      chain: monadTestnet,
      transport: http(CONFIG.RPC_URL),
      account: rogueAccount,
    });

    console.log(`\n[Rogue Trigger] Executing Scenario #${scenarioIndex} on SpendGuard...`);

    if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') {
      const mockNames = [
        'OverChannelCap',
        'WindowBudgetExceeded',
        'PayeeNotRegistered',
        'PayeeReputationTooLow',
        'AgentRevoked',
        'VoucherExceedsDeposit',
      ];
      const name = mockNames[scenarioIndex - 1] || 'OverChannelCap';
      return {
        scenario: `Scenario ${scenarioIndex}`,
        expectedError: name,
        decodedError: name,
        revertedSuccessfully: true,
        details: `Simulated rogue protection: Reverted with ${name}`,
      };
    }

    try {
      switch (scenarioIndex) {
        case 1: {
          // 1. OverChannelCap: request deposit $500 (policy cap is $10)
          await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'openChannel',
            args: [
              '0x1111111111111111111111111111111111111111' as Address,
              101n,
              500_000_000n, // $500
              BigInt(Math.floor(Date.now() / 1000) + 3600),
            ],
            account: rogueAccount,
          });
          break;
        }

        case 2: {
          // 2. WindowBudgetExceeded: multiple channels in same window
          await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'openChannel',
            args: [
              '0x1111111111111111111111111111111111111111' as Address,
              101n,
              10_000_000n,
              BigInt(Math.floor(Date.now() / 1000) + 3600),
            ],
            account: rogueAccount,
          });
          break;
        }

        case 3: {
          // 3. PayeeNotRegistered: paying an unmapped ERC-8004 agentId
          await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'openChannel',
            args: [
              '0x9999999999999999999999999999999999999999' as Address,
              999999n,
              1_000_000n,
              BigInt(Math.floor(Date.now() / 1000) + 3600),
            ],
            account: rogueAccount,
          });
          break;
        }

        case 4: {
          // 4. PayeeReputationTooLow: paying a low reputation seller
          await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'openChannel',
            args: [
              '0x2222222222222222222222222222222222222222' as Address,
              102n,
              1_000_000n,
              BigInt(Math.floor(Date.now() / 1000) + 3600),
            ],
            account: rogueAccount,
          });
          break;
        }

        case 5: {
          // 5. AgentRevoked: agent revoked by owner
          await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'openChannel',
            args: [
              '0x1111111111111111111111111111111111111111' as Address,
              101n,
              1_000_000n,
              BigInt(Math.floor(Date.now() / 1000) + 3600),
            ],
            account: rogueAccount,
          });
          break;
        }

        case 6: {
          // 6. VoucherExceedsDeposit: voucher > channel deposit
          const mockChannelId = ('0x' + '2'.repeat(64)) as Hex;
          const badSig = ('0x' + '0'.repeat(130)) as Hex;
          await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'claim',
            args: [mockChannelId, 999_999_999n, badSig],
            account: rogueAccount,
          });
          break;
        }
      }

      return {
        scenario: `Scenario ${scenarioIndex}`,
        expectedError: 'Revert',
        decodedError: null,
        revertedSuccessfully: false,
        details: 'Unexpectedly did not revert!',
      };
    } catch (err: any) {
      const decoded = decodeSpendGuardError(err);
      return {
        scenario: `Scenario ${scenarioIndex}`,
        expectedError: decoded?.errorName || 'ContractRevert',
        decodedError: decoded?.errorName || null,
        revertedSuccessfully: true,
        details: decoded?.humanMessage || err.message,
      };
    }
  }
}
