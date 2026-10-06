# AgentMesh SpendGuard: 7-Day Build Plan (Monad Metropolis, Track 04)

**Window:** Tue 6 Oct to Mon 12 Oct (IST), with the morning of 13 Oct as emergency buffer only. The deadline is 13 Oct and the exact cutoff time is not stated on the page, so submit by the evening of 12 Oct.

## 1. One-line pitch

> A passkey-secured spending envelope for AI agents: a human sets a budget with Face ID, agents pay each other per call through pre-funded payment channels, and the contract refuses anything outside the envelope. Payees are gated by ERC-8004 identity and reputation.

**Why this slice and not the original.** The original idea settled every micro-payment on-chain every block. That is the wrong architecture and judges will say so. This version uses payment channels with signed vouchers and batched settlement, which is how micropayments actually scale. Monad's job is cheap, fast claims and fast finality, not carrying every $0.0001.

**Honest differentiation from x402 (put this on one slide):**
- x402 = each request carries a signed payment authorization that a facilitator settles individually. There is no payer-side spending policy and no reputation gating.
- SpendGuard = policy-enforced pre-funded channels, batched settlement, and payees gated by ERC-8004 identity and reputation.
- The seller API can still answer with HTTP 402, so it feels familiar. Say "x402-style", not "x402".

## 2. What exists on Monad that you reuse (verified in research)

| Need | What to use |
|---|---|
| Network | Monad Testnet, chain ID `10143`, RPC `https://testnet-rpc.monad.xyz` (public RPCs are rate limited, see Risks) |
| Agent identity | ERC-8004 Identity Registry is already deployed on Monad Testnet at `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Agent reputation | ERC-8004 Reputation Registry on Monad Testnet at `0x8004B663056A597Dffe9eCcC1965A193B7388713` (confirm against the official repo) |
| Passkey wallet | Mera (`@category-labs/mera`): passkey, then PRF output, then an ordinary BIP-44 EOA. It is not a smart account. |
| Stablecoin | Monad testnet USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3`; 1 USDC per request from the Circle faucet |
| Gas | MON from `faucet.monad.xyz` |
| Explorer | testnet.monadscan.com or testnet.monadvision.com |
| Free infra | Hackathon perks: Quicknode 3 months, Dwellir 3 months, Tenderly Pro. Use a dedicated RPC. |

Do **not** write your own identity registry. Register your agents in the existing one.

## 3. Architecture

```
                      +---------------------------+
   Human (Face ID) -> |  Dashboard (Next.js)      |
                      |  Mera passkey -> owner EOA |
                      +------------+--------------+
                                   | setPolicy / fund / revoke
                                   v
 +--------------------------------------------------------------+
 |  SpendGuard.sol (Monad Testnet)                              |
 |  - owner vault (USDC)        - per-agent Policy              |
 |  - openChannel (policy-checked, deposit locked)              |
 |  - claim(voucher) by payee   - closeChannel / refund         |
 |  - payee gate: ERC-8004 Identity + min reputation            |
 +--------+--------------------------------------+--------------+
          ^ openChannel, signs vouchers          | claim batched
          |                                      v
 +--------+---------+   HTTP 402 + voucher  +----+-------------+
 | Buyer agents x N | --------------------> | Seller agents x 2-3|
 | LLM planner,     | <-------------------- | data / LLM / eval  |
 | derived keys     |      paid response    | verify sig, serve, |
 +------------------+                       | batch claims       |
                                            +--------------------+
          ERC-8004 Identity + Reputation registries (existing)
```

### 3.1 Contract: `SpendGuard.sol` (the core, about 200 lines)

**State and roles**
- `owner` is the passkey-derived EOA (Mera index 0). It deposits USDC into the vault and sets policies.
- Each agent has its own hot key. It can only call `openChannel` and sign vouchers, within its policy.

**Policy (per agent)**
- `maxPerChannel`
- `budgetPerWindow` and `windowSecs` (e.g. $5.00 per hour)
- `expiry`
- `minPayeeRep`
- Payee allowlist (optional) plus the rule "payee must be a registered ERC-8004 agent"

**Functions**
- `fund(amount)` and `withdraw(amount)` (owner)
- `setPolicy(agent, policy)` and `revokeAgent(agent)` (owner)
- `openChannel(payee, payeeAgentId, deposit, channelExpiry)` (agent). It checks policy, rolling-window spend, payee registration and reputation, then locks the deposit from the vault.
- `claim(channelId, cumulativeAmount, sig)` (payee). It verifies an EIP-712 voucher signed by the agent and pays only the delta over what was already claimed.
- `closeChannel(channelId)`. After expiry, or when both sides agree, it refunds the unclaimed remainder to the vault.

**Why channels solve the overspend problem.** The deposit is locked up front, so a voucher can never exceed the envelope. Enforcement happens at `openChannel`, not at claim time.

**Events** for the dashboard: `PolicySet`, `ChannelOpened`, `Claimed`, `ChannelClosed`, `AgentRevoked`, `Rejected(reason)`.

**Reverts to demonstrate**
1. Amount above `maxPerChannel`
2. Window budget exhausted
3. Payee not registered in ERC-8004
4. Payee reputation below the minimum
5. Revoked or expired agent
6. Voucher replay or a voucher exceeding the deposit

**Monad note.** Monad charges the `gasLimit` you declare, not the gas used. Set tight explicit gas limits on every transaction.

### 3.2 Reputation (keep it small and honest)
- After a channel closes, the buyer agent writes feedback to the ERC-8004 Reputation Registry (rating plus settled amount). **Day 1 spike: verify the exact `giveFeedback` signature and any `feedbackAuth` requirement from the ABI in `github.com/erc-8004/erc-8004-contracts`.**
- Fallback if the registry is awkward: keep `settledVolume` and `uniquePayers` counters in SpendGuard and use those for gating. Still write to ERC-8004 if it works.
- **Known weakness (say it before judges do):** reputation from transaction history can be wash-traded. Mitigations in scope are counting unique distinct payers and letting the owner set minimum thresholds. Stake slashing and disputes are future work.

### 3.3 Buyer agents
- TypeScript. Each agent has a small LLM planner (OpenAI-compatible API) that decides which seller to buy from given price and reputation.
- "One passkey, many keys" design: buyer agent keys are derived from the same passkey at BIP-44 indices 1..N and live in browser memory (Web Workers) while the dashboard tab is open. This lines up with the Monad Foundation "One Passkey, Many Keys" bounty.
- **Day 1 spike decides this.** If getting derived keys into workers is awkward, fall back to a Node runner with randomly generated agent keys that the owner authorizes by address.
- Loop: discover sellers (read registry plus agent cards), pick one, `openChannel`, send requests with incrementing vouchers, close the channel.

### 3.4 Seller agents (2 to 3 services)
- **DataSeller:** serves a small dataset (e.g. headline sentiment scores) at $0.0001 per call.
- **SummarizerSeller:** wraps a real LLM call (Kimi or Qwen via OpenAI-compatible endpoint, which also qualifies you for those credit bounties; confirm the bounty rules) at about $0.001 per call.
- **Optional third:** a code or math evaluator.
- Flow per request:
  1. Client calls the endpoint with no voucher, and gets `402` with `{payeeAgentId, price, minChannelDeposit}`.
  2. Client opens a channel (once), then retries with a voucher header.
  3. Seller verifies the signature, the channel state (cached on-chain read), and that the cumulative amount increased by at least the price.
  4. Seller serves immediately, then batches `claim()` every N calls or every few seconds.
- Each seller registers itself in the ERC-8004 Identity Registry with an agent card (name, endpoint, price).

### 3.5 Dashboard (Next.js + viem + Mera)
Panels, in build order:
1. **Owner panel:** create passkey (no seed phrase), show address, fund the vault, edit policy, revoke agent.
2. **Live feed:** every `ChannelOpened`, `Claimed` and `Rejected` event with timestamps.
3. **Budget meters:** spent vs cap per agent, per window.
4. **Metrics:** voucher-to-served latency (off-chain), claim-to-confirmed latency (on-chain), settled calls count, total value.
5. **Reputation table** for sellers.
6. **"Rogue agent" button** that fires the revert scenarios live.

**Do not build a parallel-execution heat map.** Parallelism happens inside the node and cannot be seen from outside. Show throughput and latency numbers instead. Also avoid funneling everything through one hot storage slot: keep channel state keyed per channel so claims do not all write the same slot.

## 4. Repo layout (single monorepo, TypeScript everywhere)

```
agentmesh/
  contracts/        # Foundry: SpendGuard.sol, tests, deploy script
  packages/sdk/     # viem helpers: voucher signing, channel client, registry calls
  apps/sellers/     # Hono/Express services (data, summarizer)
  apps/agents/      # buyer agent runner + LLM planner
  apps/dashboard/   # Next.js + Mera
  README.md         # architecture diagram, setup, demo steps, x402 comparison
```

## 5. Day-by-day schedule

### Day 1, Tue 6 Oct: spikes and decisions (do not skip)
- Register on `hackathon.monad.xyz`, pick Track 04, confirm you can still enter. Note the exact deadline time and judging criteria.
- Join the Monad dev Discord. Ask the Mera and Category Labs mentors about derived keys and PRF providers.
- Foundry init, fund wallets from the MON faucet and the Circle USDC faucet.
- Get a dedicated RPC (Quicknode free build plan from the hackathon perks).
- **Spike A:** register one agent in the ERC-8004 Identity Registry on testnet.
- **Spike B:** call the Reputation Registry (`giveFeedback`) and read it back.
- **Spike C:** Mera passkey create, then derive index 0 and 1, then send a tx on Monad Testnet from Chrome.
- **Gate:** if Mera works, it is the wallet. If PRF is unavailable on your browser and provider, switch provider (iCloud Keychain, 1Password, or Google Password Manager). If still blocked by evening, fall back to Privy or a plain wallet and drop the Mera bounties.
- **Gate:** if the Reputation Registry is a time sink, use the local counters fallback.

### Day 2, Wed 7 Oct: contract
- Write `SpendGuard.sol` and the EIP-712 voucher.
- Foundry tests for every revert listed in 3.1 plus happy paths and refund math.
- Deploy to testnet and verify on the explorer.

### Day 3, Thu 8 Oct: sellers and SDK
- SDK: voucher signing and verification, channel client, registry reads.
- Two seller services with the 402 flow and batched claims.
- Register sellers as ERC-8004 agents.
- End-to-end test with a script (no UI, no LLM yet).

### Day 4, Fri 9 Oct: buyer agents
- Agent runner with LLM planner choosing sellers by price and reputation.
- Run 3 to 5 agents concurrently.
- Write reputation feedback after channel close.
- Measure real latencies and fix RPC and nonce-management issues now.

### Day 5, Sat 10 Oct: dashboard and passkey flow
- Mera owner flow: create passkey, fund, set policy, revoke.
- Live feed, budget meters, metrics.
- Wire the rogue-agent button to the revert scenarios.

### Day 6, Sun 11 Oct: hardening and demo
- Load test (e.g. 10 agents, a few hundred calls) and record the real numbers.
- Polish UI states, error messages, empty states.
- Write README, architecture diagram, and the x402 comparison slide.
- Do a full dry run of the demo script on a clean browser profile.

### Day 7, Mon 12 Oct: submit
- Record the demo video (3 to 4 takes; keep the best). Keep it under about 3 minutes.
- Write the short write-up. Make the repo public or share access judges can verify.
- Complete the project profile on the platform and submit **by evening**.
- 13 Oct morning is for emergencies only.

## 6. Scope tiers (cut from the bottom)

- **P0 (must ship):** SpendGuard with policy and channels, Mera owner flow, 2 sellers, 3 buyer agents, live feed, rogue-agent revert demo, README, video.
- **P1 (should):** ERC-8004 reputation gating with real registry writes, LLM planner choosing sellers, metrics panel with measured latency.
- **P2 (only if ahead):** Envio indexer for the feed (Envio bounty), derived-key "many keys" in Web Workers, third seller.
- **Cut without regret:** Kuru integration, heat map, multi-sponsor sprawl, full reputation system, own identity registry, on-chain P-256 verification via the `0x0100` precompile.

## 7. Demo script (about 3 minutes)

1. **Hook (20s):** "Agents need money but nobody wants to hand them a seed phrase or an open wallet."
2. **Passkey (20s):** create an account with Face ID, no seed phrase.
3. **Envelope (30s):** fund the vault, set policy ($ cap, hourly budget, min reputation).
4. **Live economy (60s):** agents discover sellers, open channels, and buy calls. Feed scrolls, meters move, metrics show latency and call count.
5. **Safety (40s):** hit "rogue agent". Over-cap spend, unregistered payee and low-reputation payee each revert on-chain with visible reasons. Revoke an agent mid-flight; its next claim fails.
6. **Close (20s):** one slide on why channels plus Monad's fast finality, and how this differs from x402.

## 8. Bounty map (realistic)

| Prize | Plan |
|---|---|
| Track 04 (Trust, Identity & AI Infrastructure) | Primary target |
| Monad Foundation: Best Mera-Powered UX ($2,500) | Passkey owner flow and clean UX. Read the exact criteria on the platform. |
| Monad Foundation: Mera: One Passkey, Many Keys ($2,500) | Derived agent keys from one passkey (P2 unless the spike is easy) |
| Kimi / Alibaba (Qwen) credits | Free if the seller LLM uses their OpenAI-compatible endpoint. Confirm the rules. |
| Envio ($1,000) | Only if P2 time exists |
| Skip | Kuru, Privy, Dynamic, MetaMask, Chainlink, Agora. Shallow integrations score worse than none. |

Do not budget this as "$20K". The realistic upside is a track slot (about $10K per winner) plus possibly the Mera bounties, and several sponsor prizes are credits, not cash.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mera needs a passkey provider with PRF. Chrome saving to the local profile fails with `PRF_UNAVAILABLE`. | Test on Day 1. Use iCloud Keychain, 1Password or Google Password Manager. Test the demo browser and profile in advance. |
| Public RPC rate limits (about 20 to 50 requests per second, some endpoints disallow batching) | Use a dedicated Quicknode or Dwellir endpoint. Cache reads. Batch claims. Manage nonces locally. |
| ERC-8004 Reputation ABI differs from what you expect | Day 1 spike. Fallback to local counters. |
| Testnet resets or faucet limits (Circle USDC is limited per request window) | Fund early. A small mock USDC is an acceptable fallback if real USDC blocks you. |
| Hot agent keys in browser memory | Testnet only. State it plainly in the README. |
| Many teams will submit "agent payments" projects | Win on execution: working demo, real measured numbers, the revert demo, and a sharp x402 comparison. |
| Scope creep | Hold the P0/P1/P2 tiers. Nothing from the cut list returns after Day 3. |
| Reputation wash trading | Disclose it. Unique-payer counting plus owner thresholds. |

## 10. Things I could not confirm (verify yourself)

1. Exact submission cutoff time (and time zone) and the judging criteria. Check `hackathon.monad.xyz`.
2. The exact Reputation Registry `giveFeedback` signature and whether `feedbackAuth` is needed.
3. Whether Mera derived account keys can be used cleanly inside Web Workers.
4. The detailed criteria for the two Monad Foundation Mera bounties and for the Kimi / Qwen credit bounties.
5. Whether late registration is still open.

## 11. Pre-submission checklist

- [ ] Contract deployed and verified on testnet; address in README
- [ ] Agents registered in ERC-8004; IDs in README
- [ ] Demo runs from a clean browser profile
- [ ] Revert scenarios all produce visible on-chain failures
- [ ] Real latency and throughput numbers measured, not estimated
- [ ] README: architecture, setup, demo steps, x402 comparison, known limitations
- [ ] Demo video under about 3 minutes
- [ ] Short write-up and public project profile
- [ ] Code repo accessible to judges
- [ ] Submitted by the evening of 12 Oct
