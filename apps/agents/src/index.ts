import { AGENT_ACCOUNTS, MOCK_MODE } from './config.js';
import { DeterministicBuyer } from './buyerTierA.js';
import { PlannerBuyer } from './buyerTierB.js';
import { ToolCallingBuyer } from './buyerTierC.js';
import { RogueRunner } from './rogueRunner.js';

async function main() {
  console.log('====================================================');
  console.log('   AgentMesh SpendGuard: Autonomous Agent Swarm     ');
  console.log('====================================================');
  if (MOCK_MODE) {
    console.log('   MODE: mock — SpendGuard not deployed, contract   ');
    console.log('   results below are SIMULATED, not on-chain.       ');
  }
  console.log('====================================================');

  const buyerA = new DeterministicBuyer(AGENT_ACCOUNTS[0].account);
  const buyerB = new PlannerBuyer(AGENT_ACCOUNTS[1].account);
  const buyerC = new ToolCallingBuyer(AGENT_ACCOUNTS[2].account);
  const rogueRunner = new RogueRunner();

  let failures = 0;

  try {
    console.log('\n[1/3] Running Autonomous Buyer Swarm...');
    // Run buyers concurrently
    const [failsA, failsB] = await Promise.all([
      buyerA.runLoop(3, 1000).catch((e) => {
        console.error('Buyer A run failed:', e?.message || e);
        return 1;
      }),
      buyerB.runLoop(2, 1500).catch((e) => {
        console.error('Buyer B run failed:', e?.message || e);
        return 1;
      }),
    ]);
    failures += failsA + failsB;

    console.log('\n[2/3] Running Prompt-Injection Defense Test on Tier C...');
    try {
      await buyerC.testPromptInjectionAttack();
    } catch (e: any) {
      failures++;
      console.error('Tier C prompt-injection test failed:', e?.message || e);
    }

    console.log('\n[3/3] Running Rogue Revert Scenarios Demo...');
    for (let i = 1; i <= 6; i++) {
      try {
        const res = await rogueRunner.runScenario(i);
        const simulatedTag = res.simulated ? ' [simulated]' : '';
        console.log(
          `Scenario ${i}: [${res.revertedSuccessfully ? 'REVERTED ✓' : 'FAILED ✗'}] expected: ${res.expectedError} -> got: ${
            res.decodedError || 'None'
          }${simulatedTag} -> ${res.details}`
        );
        if (!res.revertedSuccessfully) failures++;
      } catch (e: any) {
        failures++;
        console.error(`Scenario ${i} failed:`, e?.message || e);
      }
    }
  } finally {
    // Release any channel deposits still locked by this run.
    console.log('\n[cleanup] Closing still-open payment channels...');
    try {
      const [closedA, closedB, closedC] = await Promise.all([
        buyerA.closeAllChannels(),
        buyerB.closeAllChannels(),
        buyerC.closeAllChannels(),
      ]);
      console.log(`[cleanup] Closed ${closedA + closedB + closedC} channel(s).`);
    } catch (e: any) {
      failures++;
      console.error('[cleanup] Failed to close channels:', e?.message || e);
    }
  }

  if (failures > 0) {
    console.error(`\nAgentMesh swarm demonstration finished with ${failures} unrecoverable failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nAgentMesh swarm demonstration completed.');
  }
}

main().catch((e) => {
  console.error('Fatal error in agent swarm run:', e);
  process.exitCode = 1;
});
