import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { monadTestnet, SpendGuardAbi, decodeSpendGuardError } from '@agentmesh/sdk';
import { CONFIG, AGENT_ACCOUNTS, SEED_PAYEE_ACCOUNT, TX_FEE_OVERRIDES } from './config.js';

// The revert each scenario is supposed to trigger, in scenario order.
export const EXPECTED_SCENARIO_ERRORS = [
  'OverChannelCap',
  'WindowBudgetExceeded',
  'PayeeNotRegistered',
  'PayeeReputationTooLow',
  'AgentRevoked',
  'VoucherExceedsDeposit',
] as const;

export interface RogueScenarioResult {
  scenario: string;
  expectedError: string;
  decodedError: string | null;
  errorMatched: boolean;
  revertedSuccessfully: boolean;
  simulated: boolean;
  details: string;
}

export class RogueRunner {
  private client: ReturnType<typeof createPublicClient>;
  private wallet: ReturnType<typeof createWalletClient>;
  private spendGuardAddress: Address;

  constructor() {
    this.spendGuardAddress = CONFIG.SPEND_GUARD_ADDRESS;
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(CONFIG.RPC_URL),
    });
    this.wallet = createWalletClient({
      chain: monadTestnet,
      transport: http(CONFIG.RPC_URL),
    });
  }

  private expectedError(scenarioIndex: number): string {
    const expected = EXPECTED_SCENARIO_ERRORS[scenarioIndex - 1];
    if (!expected) {
      throw new Error(`Unknown scenario #${scenarioIndex} (expected 1-${EXPECTED_SCENARIO_ERRORS.length})`);
    }
    return expected;
  }

  async runScenario(scenarioIndex: number): Promise<RogueScenarioResult> {
    const rogueAccount = AGENT_ACCOUNTS[0].account;
    const expectedError = this.expectedError(scenarioIndex);

    console.log(`\n[Rogue Trigger] Executing Scenario #${scenarioIndex} on SpendGuard...`);

    if (this.spendGuardAddress === '0x0000000000000000000000000000000000000000') {
      // SpendGuard is not deployed: replay the expected revert as an explicitly
      // simulated result instead of pretending a chain call happened.
      console.warn(
        `[Rogue Trigger] [MOCK] SpendGuard not deployed — simulated: true; replaying canned revert ${expectedError}`
      );
      return {
        scenario: `Scenario ${scenarioIndex}`,
        expectedError,
        decodedError: expectedError,
        errorMatched: true,
        revertedSuccessfully: true,
        simulated: true,
        details: `SIMULATED (mock mode, no contract deployed): canned revert with ${expectedError}`,
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
          // 4. PayeeReputationTooLow: paying a registered payee whose ERC-8004
          // reputation summary sits below the policy floor.
          await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'openChannel',
            args: [
              CONFIG.LOW_REP_PAYEE,
              CONFIG.LOW_REP_AGENT_ID,
              1_000_000n,
              BigInt(Math.floor(Date.now() / 1000) + 3600),
            ],
            account: rogueAccount,
          });
          break;
        }

        case 5: {
          // 5. AgentRevoked: an account with no active policy (same revert path
          // as an owner-revoked agent — !policy.active is checked first).
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
            account: '0x3333333333333333333333333333333333333333' as Address,
          });
          break;
        }

        case 6: {
          // 6. VoucherExceedsDeposit: open a real channel, then attempt a claim
          // whose cumulative amount exceeds the channel deposit. The seed channel
          // is closed in a finally block so the vault is refunded.
          const seedChannelExpiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
          const { result: seededChannelId, request: seedRequest } = await this.client.simulateContract({
            address: this.spendGuardAddress,
            abi: SpendGuardAbi,
            functionName: 'openChannel',
            args: [CONFIG.SEED_PAYEE, CONFIG.SEED_AGENT_ID, 1_000_000n, seedChannelExpiry],
            account: rogueAccount,
          });
          const seedHash = await this.wallet.writeContract({ ...seedRequest, ...TX_FEE_OVERRIDES } as any);
          await this.client.waitForTransactionReceipt({ hash: seedHash });
          console.log(`[Rogue Trigger] Seeded channel ${seededChannelId} (deposit 1.00 USDC) for the oversized-claim attempt.`);

          try {
            const badSig = ('0x' + '0'.repeat(130)) as Hex;
            await this.client.simulateContract({
              address: this.spendGuardAddress,
              abi: SpendGuardAbi,
              functionName: 'claim',
              args: [seededChannelId, 999_999_999n, badSig],
              account: CONFIG.SEED_PAYEE,
            });
          } finally {
            try {
              // The buyer (agent) may only close after expiry, so settle the seed
              // channel as the payee — the payee may close at any time.
              if (
                SEED_PAYEE_ACCOUNT &&
                SEED_PAYEE_ACCOUNT.address.toLowerCase() === CONFIG.SEED_PAYEE.toLowerCase()
              ) {
                const closeSim = await this.client.simulateContract({
                  address: this.spendGuardAddress,
                  abi: SpendGuardAbi,
                  functionName: 'closeChannel',
                  args: [seededChannelId],
                  account: SEED_PAYEE_ACCOUNT,
                });
                const closeHash = await this.wallet.writeContract({ ...closeSim.request, ...TX_FEE_OVERRIDES } as any);
                await this.client.waitForTransactionReceipt({ hash: closeHash });
                console.log(`[Rogue Trigger] Payee settled seed channel ${seededChannelId}; refund returned to vault.`);
              } else {
                console.warn(
                  `[Rogue Trigger] Seed channel ${seededChannelId} left open: no payee key matching ${CONFIG.SEED_PAYEE} in env.`
                );
              }
            } catch (closeErr: any) {
              console.warn(`[Rogue Trigger] Failed to settle seed channel: ${closeErr?.message || closeErr}`);
            }
          }
          break;
        }
      }

      return {
        scenario: `Scenario ${scenarioIndex}`,
        expectedError,
        decodedError: null,
        errorMatched: false,
        revertedSuccessfully: false,
        simulated: false,
        details: `Unexpectedly did not revert — expected ${expectedError}`,
      };
    } catch (err: any) {
      const decoded = decodeSpendGuardError(err);
      const decodedError = decoded?.errorName ?? null;
      const errorMatched = decodedError === expectedError;

      let details: string;
      if (errorMatched) {
        details = decoded?.humanMessage || `Reverted with expected error ${expectedError}`;
      } else if (decoded) {
        details = `Reverted with ${decoded.errorName} but expected ${expectedError} — ${decoded.humanMessage}`;
      } else {
        details = `Reverted with an error that could not be decoded as a SpendGuard error (expected ${expectedError}): ${
          err?.message || err
        }`;
      }

      return {
        scenario: `Scenario ${scenarioIndex}`,
        expectedError,
        decodedError,
        errorMatched,
        revertedSuccessfully: errorMatched,
        simulated: false,
        details,
      };
    }
  }
}
