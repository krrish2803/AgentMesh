import { AGENT_ACCOUNTS } from './config.js';
import { DeterministicBuyer } from './buyerTierA.js';
import { PlannerBuyer } from './buyerTierB.js';
import { ToolCallingBuyer } from './buyerTierC.js';
import { RogueRunner } from './rogueRunner.js';

async function main() {
  console.log('====================================================');
  console.log('   AgentMesh SpendGuard: Autonomous Agent Swarm     ');
  console.log('====================================================');

  const buyerA = new DeterministicBuyer(AGENT_ACCOUNTS[0].account);
  const buyerB = new PlannerBuyer(AGENT_ACCOUNTS[1].account);
  const buyerC = new ToolCallingBuyer(AGENT_ACCOUNTS[2].account);
  const rogueRunner = new RogueRunner();

  console.log('\n[1/3] Running Autonomous Buyer Swarm...');
  // Run buyers concurrently
  await Promise.all([
    buyerA.runLoop(3, 1000).catch((e) => console.log('Buyer A finished:', e.message)),
    buyerB.runLoop(2, 1500).catch((e) => console.log('Buyer B finished:', e.message)),
  ]);

  console.log('\n[2/3] Running Prompt-Injection Defense Test on Tier C...');
  await buyerC.testPromptInjectionAttack();

  console.log('\n[3/3] Running Rogue Revert Scenarios Demo...');
  for (let i = 1; i <= 6; i++) {
    const res = await rogueRunner.runScenario(i);
    console.log(`Scenario ${i}: [${res.revertedSuccessfully ? 'REVERTED ✓' : 'FAILED ✗'}] Error: ${res.decodedError || 'None'} -> ${res.details}`);
  }

  console.log('\nAgentMesh swarm demonstration completed.');
}

main().catch(console.error);
