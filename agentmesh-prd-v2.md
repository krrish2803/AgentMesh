# PRD v2: AgentMesh SpendGuard

**Product:** A passkey-secured spending envelope for AI agents, with a live 3D view of the agent economy.
**Event:** Monad Metropolis hackathon, Track 04 (Trust, Identity & AI Infrastructure)
**Build window:** Tue 6 Oct to Mon 12 Oct 2026 (IST). Submit by the evening of 12 Oct; the official deadline is 13 Oct and its cutoff time is not published on the page.
**Status:** Draft v2. Merges your three-layer stack (Foundry, viem, Hono, Next.js) with the 3D scene and MongoDB from v1.

---

## 0. What changed from v1, and corrections to the stack you pasted

### Stack changes
- **Single language: TypeScript end to end** (plus Solidity). One shared `sdk` package for voucher signing and chain calls, used by contracts tests, sellers, agents and the dashboard. The Python/FastAPI backend from v1 is gone.
- **Frontend is Next.js 15 (React 19)** with Tailwind and shadcn/ui, still with Three.js (React Three Fiber) for the 3D scene.
- **MongoDB stays** because you asked for it, but only for the event log, replay mode, transcripts and metrics rollups. It is never used for enforcement.
- **AutoGen is demoted to an optional P2 Python sidecar** (details in section 7.5). It is in maintenance mode and Microsoft points new users to Microsoft Agent Framework. More importantly, it would reintroduce a second language and duplicate your signing logic. **If AutoGen is a hard requirement for you, tell me and I will restore it to P0.**

### Corrections to the pasted spec (please read these)
| # | In the pasted spec | Problem | What the PRD does |
|---|---|---|---|
| 1 | `ReentrancyGuardTransient` "to prevent replay attacks during `claim()`" | A reentrancy guard does not stop replay. Replay is stopped by monotonic accounting: each claim pays only `cumulativeAmount - claimed[channelId]`. Transient storage also needs EVM support that I did not verify on Monad. | Use standard `ReentrancyGuard` and monotonic cumulative accounting. Upgrade to the transient version only after confirming Monad's EVM version. |
| 2 | OZ `ECDSA` and `MessageHashUtils` only | You also want the `EIP712` base contract (`_hashTypedDataV4`), which uses those two internally. | Inherit OZ `EIP712`. |
| 3 | "`watchContractEvent` to stream `Rejected` events" | A reverted transaction emits no events, so a revert can never produce a `Rejected` log. | Rejections are decoded from `simulateContract` (instant, free) and published by the server. Optionally the doomed tx is also sent with an explicit gas limit so a **failed transaction appears on the explorer**. See 6.4. |
| 4 | "Qwen 2.5 / Kimi" | The Metropolis page names the Alibaba bounty as "Best Builds with Qwen 3.8 Max". | Use the model the bounty names (verify endpoint and availability). Kimi is a second option. |
| 5 | Buyer agent can be 0% LLM | Pure scripts will look like scripts to Track 04 judges, and the prompt-injection demo needs a real LLM with a tool that can spend. | Three buyer tiers (7.2). At least one buyer is a real tool-calling LLM agent. |
| 6 | Data Seller returns "simulated market sentiment or dummy data" | Fine for a demo, but undisclosed fake data looks bad. | Label it **simulated** in the UI and README. |
| 7 | Browser watchers via public RPC | Public testnet RPCs are limited to roughly 20 to 50 requests per second, shared per IP. | Browser watches only low-volume events (batched `Claimed`, `ChannelOpened`) by polling; the server uses the dedicated RPC. See 8.4. |

---

## 1. Problem and vision

**Problem.** AI agents need to buy data, compute and services from each other. Today you either hand an agent an unrestricted wallet (dangerous) or approve each payment (defeats autonomy). Settling every sub-cent call on-chain is also wasteful.

**Vision.** A human creates an account with Face ID (no seed phrase), funds a vault, and sets an envelope: cap per channel, hourly budget, minimum payee reputation. Agents discover sellers through ERC-8004 identity and reputation, open payment channels inside the envelope, and pay per call with signed vouchers. Sellers serve instantly and settle on-chain in batches. Anything outside the envelope fails on-chain, even if the LLM is manipulated.

**Why Monad.** Cheap, fast claims and sub-second finality make batched settlement and instant refunds practical. The claim is about latency and cost, not visible parallelism.

**Differentiation from x402.** x402 attaches an individually settled payment authorization to each request, with no payer-side spending policy and no reputation gating. SpendGuard adds policy-enforced pre-funded channels, batched settlement and ERC-8004-gated payees. The seller API returns HTTP 402 so it feels familiar; we call it "x402-style", not x402.

**Design principle (say it in the demo):** *The LLM decides what to buy. Deterministic code signs. The contract enforces.*

---

## 2. Goals, non-goals, metrics

**Goals**
- G1: End-to-end demo on Monad Testnet with real contracts, signatures and LLM calls.
- G2: Convincing safety story with visible, named failures.
- G3: A 3D live view that makes the agent economy legible in 10 seconds.
- G4: Qualify for Track 04 and the Mera UX bounty.

**Non-goals:** mainnet, audits, production key management, multi-chain, stake slashing, disputes, a full reputation system, on-chain P-256 verification, Kuru/Dynamic/MetaMask/Chainlink integrations, mobile-first layout.

**Success metrics (measured, never simulated)**
| Metric | Target |
|---|---|
| Paid calls in one demo run | at least 300 across at least 5 agents |
| On-chain transactions in that run | recorded and shown (expected far fewer than calls) |
| Voucher verify + serve latency, excluding LLM time | p95 under 300 ms |
| Claim confirmation latency on testnet | measured and displayed live |
| Rogue scenarios demonstrated | at least 5 of 6 |
| Fresh browser profile demo | passes |

---

## 3. Users and stories
- **Owner (human):** wants autonomy without open wallets.
- **Judge:** has about 3 minutes; wants it working, failing safely, and different from x402.
- **Seller operator:** wants per-call payment without invoices.

Stories: US-1 create account with passkey; US-2 fund and set policy; US-3 revoke and see the next claim fail; US-4 buyer discovers a seller, checks reputation, opens a channel, pays per call; US-5 seller verifies vouchers, serves instantly, claims in batches; US-6 owner watches spend, latency and rejections live; US-7 judge triggers a rogue agent and sees it stopped.

---

## 4. Scope tiers

| Tier | Contents |
|---|---|
| **P0** | SpendGuard + Foundry tests, passkey owner flow, 2 sellers, 3 buyers (tiers in 7.2), live feed, 2D dashboard, rogue revert demo, README, video |
| **P1** | 3D mesh scene on live events, ERC-8004 reputation writes and gating, LLM planner and tool-calling buyer, prompt-injection demo, Foundry invariant tests, MongoDB replay mode, metrics panel |
| **P2** | AutoGen Python sidecar planner, Privy fallback polish, third seller, Envio indexer, public deployed demo |

Cut order: P2, then 3D (fall back to 2D), then LLM seller selection (deterministic choice), then ERC-8004 writes (local counters), then replay.

---

## 5. Architecture (three layers)

```
 LAYER 3: Dashboard (Next.js 15, React 19, R3F, shadcn/ui)
 +---------------------------------------------------------------+
 | Mera passkey -> owner EOA (Privy fallback)                    |
 | fund / setPolicy / revoke  (viem, signed in browser)          |
 | HUD + 3D Mesh + feed (chain events via viem, off-chain via WS)|
 +---------------+-----------------------------+-----------------+
                 | owner txs                   | REST + WS
                 v                             v
 LAYER 1: On-chain (Foundry, Monad Testnet 10143)       LAYER 2: Off-chain (Node 22, TS)
 +-------------------------------+            +--------------------------------------+
 | SpendGuard.sol                |<-----------| apps/server (Hono): REST, WS hub,    |
 |  vault, policies, channels    |  open/     |   run control, rogue triggers,       |
 |  claim(voucher), close        |  claim/    |   chain listener -> Mongo            |
 |  payee gate: ERC-8004         |  feedback  | apps/agents: buyer runner (tiers A/B/C)|
 +---------------+---------------+            | apps/sellers: Hono x2 (402 + voucher) |
                 ^                            +-------------------+------------------+
                 |                                                |
   ERC-8004 Identity + Reputation (existing)                MongoDB Atlas (log, replay,
   Testnet USDC (existing)                                  transcripts, metrics)
                                          packages/sdk (viem): voucher sign/verify, channel client
```

### Key flows
**Owner setup.** Browser creates a passkey with Mera and derives the owner EOA (index 0). Owner approves USDC and calls `fund`. Server creates agent keys (testnet only). Owner calls `setPolicy(agent, policy)` from the browser.

**Paid call.**
1. Buyer calls a seller with no voucher; seller returns `402` with `{payeeAgentId, price, minChannelDeposit}`.
2. Buyer calls `openChannel(payee, payeeAgentId, deposit, expiry)`; the contract checks policy, window budget, payee registration and reputation, then locks the deposit.
3. Buyer retries with `X-Channel-Id` and `X-Voucher` (EIP-712 cumulative amount).
4. Seller verifies, serves immediately, records the call.
5. Seller batches `claim()` every N calls or every few seconds.
6. Buyer closes the channel (remainder refunded) and posts reputation feedback.

**Rogue attempt.** Rogue calls something outside the envelope; the server simulates and decodes the named error; optionally the doomed tx is sent with explicit gas so it shows as Failed on the explorer; the 3D scene plays the rejection effect.

---

## 6. Layer 1: On-chain settlement and security

### 6.1 Tooling
- **Foundry** (`forge`, `cast`, `anvil`): fast tests, native fuzzing and invariant testing, direct deploys to Monad Testnet (`--rpc-url https://testnet-rpc.monad.xyz --chain-id 10143`).
- **Solidity `^0.8.24`**. Set `evm_version` in `foundry.toml` explicitly after checking Monad's supported EVM version; do not assume transient storage.
- **OpenZeppelin Contracts (v5):** `EIP712` (base), `ECDSA`, `MessageHashUtils`, `IERC20`, `SafeERC20`, `ReentrancyGuard`.
- **ERC-8004 interfaces:** lightweight Solidity interfaces for the deployed Identity (`0x8004A818BFB912233c491871b3d84c89A494BD9e`) and Reputation (`0x8004B663056A597Dffe9eCcC1965A193B7388713`) registries. **Day 1: confirm the exact function signatures from the official ABI** (`github.com/erc-8004/erc-8004-contracts`, `abi/` directory), because the reputation `giveFeedback` flow may require an authorization.
- **Client SDK:** TypeScript + `viem` (`signTypedData`, `monadTestnet` chain definition, small footprint).

### 6.2 `SpendGuard.sol` specification
**Roles:** `owner` (passkey EOA), `agent` (hot key), `payee` (seller wallet tied to an ERC-8004 agent).

**Policy (per agent):** `maxPerChannel`, `budgetPerWindow`, `windowSecs`, `expiry`, `minPayeeRep`, `requireRegisteredPayee` (default true). Amounts are USDC with 6 decimals.

| Function | Caller | Behavior |
|---|---|---|
| `fund` / `withdraw` | owner | Move USDC in and out of the vault |
| `setPolicy(agent, policy)` | owner | Create or update envelope |
| `revokeAgent(agent)` | owner | Disables agent; open channels can still close and refund |
| `openChannel(payee, payeeAgentId, deposit, expiry)` | agent | Checks policy and registry; locks deposit |
| `claim(channelId, cumulativeAmount, sig)` | payee | Verifies EIP-712 voucher; pays only `cumulativeAmount - claimed[channelId]` |
| `closeChannel(channelId)` | agent, payee, or anyone after expiry | Refunds unclaimed remainder to the vault |
| `checkOpenChannel(agent, payee, payeeAgentId, deposit)` (view) | anyone | Returns an error code without a transaction; used by the dashboard and rogue panel |

**Voucher (EIP-712):** domain `{ name: "SpendGuard", version: "1", chainId: 10143, verifyingContract }`; type `Voucher(bytes32 channelId, uint256 cumulativeAmount)`.

**Custom errors:** `OverChannelCap`, `WindowBudgetExceeded`, `PayeeNotRegistered`, `PayeeReputationTooLow`, `AgentRevoked`, `PolicyExpired`, `InvalidVoucher`, `VoucherExceedsDeposit`, `ChannelNotOpen`.

**Events:** `PolicySet`, `AgentRevoked`, `ChannelOpened`, `Claimed`, `ChannelClosed`. There is **no `Rejected` event**, because reverts emit none (see 6.4).

**Reputation:** read the ERC-8004 Reputation Registry for the payee when available; fallback to `settledVolume` and `uniquePayers` counters in SpendGuard. Known weakness: history-based reputation can be wash-traded. Mitigation in scope: count distinct payers; owner-set thresholds. Say so in the README.

**Monad specifics:** Monad charges the declared `gasLimit`, not gas used. Set tight explicit gas limits on every transaction.

### 6.3 Testing
- Unit: happy path, each error, refund math, window rollover, claim after revoke.
- **Fuzz:** random cumulative sequences (never overpay), random policy values, boundary amounts.
- **Invariants (P1):** total claimed + total refunded never exceeds total deposited; vault accounting always balances; a lower or repeated cumulative amount never pays out.
- Deploy script and a fork-less testnet smoke test using `cast`.

### 6.4 How rejections are shown (the correction to the spec)
1. **Decode:** the server calls `simulateContract` (or the `checkOpenChannel` view). The named custom error is decoded instantly and free.
2. **Publish:** the server emits a `rejection` event on the WebSocket with the named error. The dashboard shows it and the 3D scene plays the shockwave.
3. **Prove on-chain (optional):** for the headline scenarios, also send the transaction with an explicit gas limit so a **failed transaction lands on the explorer**. Judges can click the hash. This costs testnet gas only.

---

## 7. Layer 2: Off-chain agent swarm and seller services

### 7.1 Runtime and services
- **Runtime:** Node.js 22 with `tsx` (Bun is acceptable if everything including Mera tests runs on it; do not mix).
- **Sellers:** Hono (`hono` + `@hono/node-server`), two microservices on ports 8101 and 8102. Custom headers (`X-Channel-Id`, `X-Voucher`) and `402 Payment Required` are native.
- **LLM client:** direct `openai` SDK pointed at an OpenAI-compatible endpoint (Qwen per the bounty, or Kimi). Vercel AI SDK is optional; the direct client is simpler and has fewer moving parts.
- **Signing:** `viem/accounts` `privateKeyToAccount` for agent keys and `signTypedData` for vouchers.
- **Server (`apps/server`, Hono):** REST, WebSocket hub, run control, rogue triggers, chain listener writing to MongoDB, nonce manager.

### 7.2 Buyer agents (three tiers, one runner)
| Tier | Agent | LLM share | What it does |
|---|---|---|---|
| **A** | Deterministic buyer | 0% | Checks sellers, picks the cheapest above the reputation threshold, requests, signs, repeats |
| **B** | Planner buyer | about 5% | One prompt: "Given Seller A ($0.001, Rep 95) and Seller B ($0.0005, Rep 40), which should I buy from?" The model returns a seller; the script executes |
| **C** | Tool-calling agent | LLM-driven | Has tools `list_sellers`, `get_reputation`, `open_channel`, `call_seller`, `close_channel`. This is the **prompt-injection target** in the demo |

Demo lineup: one of each (A, B, C) plus extra A instances to hit the call volume target.

Rules for every tier: the model never signs; signing lives inside tool code. Hard iteration cap per task. Global per-run call cap. Temperature 0 for repeatability.

### 7.3 Seller services
- **DataSeller:** no AI. Returns market sentiment data for $0.0001 per call. The data is **simulated and labeled as such**.
- **SummarizerSeller:** accepts text, calls the LLM to summarize, returns it for $0.001 once the voucher verifies.
- Both expose `GET /card` (name, endpoint, price, ERC-8004 agent ID) and `POST /query`.
- Verification: recover the signer from the EIP-712 voucher; confirm it equals the channel's agent; confirm channel open; confirm `cumulativeAmount` is at least the last accepted amount plus price and does not exceed the deposit. Cache channel state with a short TTL.
- Batched claims: every N calls or every few seconds, whichever comes first.
- Sellers register in the ERC-8004 Identity Registry with an agent card.

### 7.4 Rogue scenarios (each maps to a named error)
1. Open a channel above `maxPerChannel` (`OverChannelCap`)
2. Exhaust the hourly window (`WindowBudgetExceeded`)
3. Pay an unregistered address (`PayeeNotRegistered`)
4. Pay a low-reputation seller (`PayeeReputationTooLow`)
5. Act after revoke (`AgentRevoked`)
6. Replay or inflate a voucher (`InvalidVoucher` / `VoucherExceedsDeposit`)

**Prompt-injection (P1):** the tier C agent receives text telling it to send everything to an attacker address. It tries; the contract refuses.

### 7.5 Optional AutoGen sidecar (P2)
A small Python service exposing `POST /plan`, running an AutoGen AgentChat `AssistantAgent` that returns the seller choice. The TS buyer calls it instead of the direct LLM planner. Only build this if the P0 and P1 items are done. Pin versions; non-OpenAI model names usually need an explicit `model_info`. Keep it behind an interface so removing it changes nothing else.

### 7.6 Nonce and RPC management
- Per-key async nonce manager (local counter, resync on error).
- Dedicated RPC endpoint (Quicknode or Dwellir free plan from the hackathon perks).
- Cache reads, batch claims, back off on 429.

### 7.7 Secrets
Agent keys come from environment variables or an encrypted local file, testnet only. The owner passkey key never reaches the server. State this in the README.

---

## 8. Layer 3: Dashboard and UX

### 8.1 Stack
- **Next.js 15 (App Router, TypeScript), React 19.**
- **Tailwind CSS + shadcn/ui**, `lucide-react` for status icons (green verified shields, red revert badges).
- **Palette:** `slate-950` / `zinc-900` backgrounds, Monad purple accent `#836EF9`, red for rejections, green for verified.
- **3D:** `three`, `@react-three/fiber` v9, `@react-three/drei` v10, `@react-three/postprocessing` v3 (Bloom). These versions are compatible with React 19. Pin them on Day 1.
- **Animation:** GSAP for camera and UI sequences, `@react-spring/three` v10 for node and ring springs.
- **State and data:** Zustand (event store), TanStack Query (seller lists, channel state).
- **Chain and passkey:** `viem`, `@category-labs/mera` (primary), `@privy-io/react-auth` (fallback).

### 8.2 Next.js gotchas to plan for
- Mera and R3F are browser-only. Mark those components `"use client"` and load the Canvas with `dynamic(() => import(...), { ssr: false })`.
- Do not put per-frame state in React; read from a ref or store inside `useFrame`.
- Keep the 3D scene in one client route (`/mesh`).

### 8.3 Passkey flow
- Mera needs a passkey provider that supports the WebAuthn PRF extension (iCloud Keychain, 1Password, Google Password Manager). Chrome saving to the local profile fails with `PRF_UNAVAILABLE`.
- Mera accounts are ordinary EOAs. The owner key signs `fund` and `setPolicy` with viem.
- **Fallback:** Privy embedded wallet for owner signing if PRF fails. If you fall back, the Mera UX bounty is off the table. Privy has its own sponsor bounty; the criteria are not on the page I read, so check the platform before counting on it.
- Test the exact demo browser and profile on Day 1 and Day 6.

### 8.4 Live feed: two sources
| Source | Events | Transport |
|---|---|---|
| **On-chain, straight from the chain** | `PolicySet`, `ChannelOpened`, `Claimed`, `ChannelClosed`, `AgentRevoked` | viem `publicClient.watchContractEvent` (WebSocket or polling) |
| **Off-chain, from the server** | `call.paid`, `rejection`, agent status, run lifecycle, reputation | Server WebSocket |

Browser watchers are low volume because claims are batched, so polling at about 1 second is safe on the public RPC. The server uses the dedicated key, which never ships to the browser.

### 8.5 Screens
1. **Onboard:** create or sign in with passkey; address; USDC and MON balances; faucet links.
2. **Mesh (home):** full-screen 3D scene with a HUD overlay.
3. **Policy drawer:** edit envelope per agent, sign with passkey, revoke.
4. **Activity feed:** typed events with filters (Calls, Claims, Rejections); explorer links.
5. **Agent detail:** budget meter, channels, LLM transcript.
6. **Metrics:** latency distribution, calls vs on-chain tx count, value moved.
7. **Rogue panel:** six scenarios plus prompt-injection, each showing the named error and the failed-tx link.

### 8.6 3D scene: "The Mesh"
| Element | Representation | Source |
|---|---|---|
| Buyer agents | Glowing spheres on the left arc | agents |
| Seller agents | Faceted nodes on the right arc | agents |
| Vault | Glass cube in the center with a fill level | vault balance |
| Channels | Curved tubes between buyer and seller; thickness by deposit | `ChannelOpened` |
| Paid calls | Instanced particles flowing along tubes | `call.paid` |
| Claims | Pulse from seller to a rotating "block ring" of recent blocks | `Claimed` |
| Budget meter | Ring around each buyer filling with spend | policy + spend |
| Reputation | Seller halo radius and brightness | reputation |
| Rejection | Red shockwave and shield flash at the vault with the error name | `rejection` |
| Revoke | Buyer dims; tubes retract | `AgentRevoked` |

Performance: `InstancedMesh` capped near 2,000 live particles; Bloom only; DPR capped at 1.5; **2D mode toggle** as the fallback. The scene consumes a typed event stream and is built first against a mock generator, then switched to live events.

---

## 9. Data model (MongoDB Atlas, M0)

Role: event log, replay, transcripts and metrics only. Chain state is the source of truth.

| Collection | Key fields |
|---|---|
| `agents` | `address`, `role`, `tier`, `erc8004Id`, `ownerAddress` |
| `policies` | `agent`, policy fields, `revoked`, `txHash` (mirror of chain) |
| `channels` | `channelId`, `agent`, `payee`, `deposit`, `claimed`, `status`, `openTx`, `closeTx` |
| `calls` | `runId`, `agent`, `seller`, `channelId`, `price`, `cumulative`, `tStart`, `tServed`, `latencyMs` |
| `claims` | `channelId`, `amount`, `txHash`, `submittedAt`, `confirmedAt`, `confirmLatencyMs`, `callsCovered` |
| `events` | `runId`, `seq`, `type`, `payload`, `ts` (replay source) |
| `rejections` | `agent`, `error`, `source` (sim or failed tx), `txHash?`, `ts` |
| `reputation` | `agentId`, `score`, `volume`, `uniquePayers` |
| `transcripts` | `runId`, `agent`, `messages[]` (tier B and C LLM exchanges) |
| `runs` | `runId`, `scenario`, `status`, `startedAt`, `endedAt`, `stats` |
| `metrics_rollups` | `runId`, `bucket`, `calls`, `p50`, `p95`, `claims` |

Indexes: `events(runId, seq)`, `calls(runId, tStart)`, `channels(channelId)` unique, `claims(channelId)`, `agents(address)` unique.
If Atlas setup costs you time, a JSONL file per run is an acceptable stand-in for replay.

---

## 10. API and event contracts

### REST (Hono server)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | Dashboard bootstrap snapshot |
| POST | `/api/agents` | Create buyer agent key; returns address |
| GET | `/api/agents` | Agents with budget used |
| POST | `/api/runs/start` / `stop` | Control a scenario |
| POST | `/api/rogue/:scenario` | Trigger a rogue scenario |
| GET | `/api/metrics` | Latency, call and tx counts |
| GET | `/api/reputation` | Seller reputation |
| GET | `/api/transcripts/:agentId` | LLM transcript |
| POST | `/api/replay/start` | Replay a recorded run |
| WS | `/ws/events` | Live off-chain event stream |

### Seller API
`GET /card`; `POST /query` returns `402` with payment requirements when unpaid and the result plus `X-Price` when a valid voucher is attached. Headers: `X-Channel-Id`, `X-Voucher` (base64 JSON `{cumulativeAmount, sig}`).

### Event schema (WebSocket)
```
{ seq, ts, runId, type, payload }
types: agent.created, policy.set, agent.revoked, channel.opened, call.paid,
       claim.submitted, claim.confirmed, channel.closed, reputation.updated,
       rejection, run.started, run.stopped
```

---

## 11. Functional requirements

| ID | Requirement | Tier | Acceptance |
|---|---|---|---|
| FR-1 | Create passkey account; no seed phrase shown | P0 | Created in under 30 s; address shown |
| FR-2 | Fund vault in USDC | P0 | Balance updates after confirmation |
| FR-3 | Set policy per agent from the browser | P0 | `PolicySet` visible on chain and in the feed |
| FR-4 | Revoke agent | P0 | Next `openChannel` fails with `AgentRevoked` |
| FR-5 | Buyer opens channel within policy | P0 | `ChannelOpened`; deposit locked |
| FR-6 | Paid call via voucher; seller serves instantly | P0 | `call.paid` with latency; no on-chain tx per call |
| FR-7 | Seller batches claims | P0 | One `Claimed` covers many calls; delta paid correctly |
| FR-8 | Channel close refunds remainder | P0 | Vault restored by the unclaimed amount |
| FR-9 | Rogue scenarios fail with named errors | P0 | At least 5 of 6 shown live; headline ones have a failed-tx link |
| FR-10 | Live feed and budget meters | P0 | Events visible within about 1 s |
| FR-11 | Three buyer agents (tiers A, B, C) complete work | P0 | Tier C and B transcripts stored |
| FR-12 | Payee must be a registered ERC-8004 agent | P1 | Unregistered payee rejected |
| FR-13 | Reputation read/write (or local fallback) and gating | P1 | Score changes after settlement; gating enforced |
| FR-14 | 3D Mesh driven by live events | P1 | All elements in 8.6 respond |
| FR-15 | Prompt-injection blocked | P1 | Attempt logged; contract refusal shown |
| FR-16 | Replay mode | P1 | Recorded run replays identically |
| FR-17 | Metrics panel from real data | P1 | p50 and p95 computed from `calls` and `claims` |
| FR-18 | Fuzz and invariant tests pass | P1 | `forge test` green |

## 12. Non-functional requirements
- **Honesty:** every number shown is measured; simulated data is labeled.
- **Reliability:** RPC failure shows a status banner and retries; replay is the fallback for video.
- **Security:** testnet only; no secrets in the repo; owner key stays in the browser; CORS limited to the dashboard origin; per-run call cap.
- **Observability:** structured logs with `runId`; all events persisted.
- **Browser:** latest desktop Chrome.

---

## 13. Repository layout (pnpm workspaces)

```
agentmesh/
  contracts/              # Foundry: src/SpendGuard.sol, interfaces/, test/ (unit, fuzz, invariant), script/Deploy.s.sol
  packages/
    sdk/                  # viem: chain def, ABIs, voucher sign/verify, channel client, error decoding
  apps/
    server/               # Hono: REST, WS hub, listener, runner control, Mongo
    agents/               # buyer runner (tiers A/B/C), tools, rogue scenarios
    sellers/              # data/ and summarizer/ Hono apps
    dashboard/            # Next.js 15: app/, components/ (shadcn), scene/ (R3F), mock/
  services/
    planner-autogen/      # P2 optional Python sidecar
  docker-compose.yml      # local mongo (optional), server, sellers
  README.md
  docs/                   # architecture diagram, demo script, x402 comparison slide
```

---

## 14. Seven-day schedule

If you have a teammate: **Lane A** contracts + SDK + server + agents; **Lane B** dashboard + 3D + passkey.

### Day 1, Tue 6 Oct: spikes and scaffolding (do not skip)
- Register on the hackathon platform; confirm entry, deadline time, criteria. Join the Monad dev Discord.
- Faucets (MON, Circle USDC); dedicated RPC.
- **Spike A:** register an agent in the ERC-8004 Identity Registry.
- **Spike B:** read and write the Reputation Registry; confirm the ABI.
- **Spike C:** Mera passkey create, derive, send a tx on Monad Testnet from the demo browser (and test the Privy fallback if Mera fails).
- **Spike D:** one `openai`-client call to the Qwen/Kimi endpoint with tool calling.
- **Spike E:** Next.js 15 + R3F v9 + drei v10 hello scene with `ssr: false`.
- **Spike F:** check Monad's EVM version for `foundry.toml`.
- Scaffold the pnpm monorepo, Foundry project, Atlas cluster.
- **Gates:** Mera fails, use Privy and drop the Mera bounty. Reputation registry is a time sink, use local counters. Model tool calling fails, switch endpoint.

### Day 2, Wed 7 Oct: contract and SDK
- `SpendGuard.sol`, voucher, unit tests for every error, then fuzz tests. Deploy to testnet and verify.
- SDK: chain definition, ABIs, voucher sign/verify, error decoding.
- Dashboard: Next.js app, Tailwind, shadcn, Mera onboarding screen.

### Day 3, Thu 8 Oct: sellers and server
- Two Hono sellers with the 402 flow and batched claims.
- Server: Mongo, nonce manager, chain listener, WS hub.
- Script (no LLM): open channel, 50 paid calls, one claim, close.

### Day 4, Fri 9 Oct: agents and rogue
- Buyer runner with tiers A, B and C; transcripts stored.
- Rogue scenarios with simulation-decoded errors and failed-tx submission.
- Run 5 or more agents concurrently; fix RPC and nonce issues now.

### Day 5, Sat 10 Oct: dashboard and 3D (on mock events)
- Owner flow wired: fund, setPolicy, revoke.
- Event store, feed, budget meters, rogue panel, chain watchers.
- 3D scene on the mock generator. **Timebox 3D to about 1.5 days total; if it is not working by end of Day 6, ship 2D mode.**

### Day 6, Sun 11 Oct: integrate and harden
- Switch the scene to live events. Metrics panel from real data.
- Load test (5 to 10 agents, several hundred calls); record the numbers.
- Reputation gating, prompt-injection demo, replay mode, invariant tests (P1).
- Full dry run from a clean browser profile.

### Day 7, Mon 12 Oct: submit
- Record the video (3 to 4 takes; use replay for the safest take).
- README, architecture diagram, x402 comparison slide, short write-up.
- Complete the project profile and **submit by the evening**. 13 Oct morning is emergency buffer only.

---

## 15. Demo script (about 3 minutes)
1. **Hook (20s):** "Agents need money. Nobody wants to give them a seed phrase or an open wallet."
2. **Passkey (20s):** Create the account with Face ID; no seed phrase.
3. **Envelope (30s):** Fund; set cap, hourly budget, minimum reputation.
4. **Live economy (60s):** The 3D mesh comes alive: buyers discover sellers, open channels and buy; particles flow, meters fill, claims land on the block ring; metrics show real latency and the calls-vs-transactions ratio.
5. **Safety (40s):** Hit "rogue". Over-cap, unregistered payee and low-reputation payee each get a red shockwave with the named error and a failed-tx link. Then the prompt-injected agent tries to drain the vault and fails. Revoke an agent mid-flight; its next claim fails.
6. **Close (20s):** "The LLM decides what to buy, deterministic code signs, the contract enforces. Why channels plus Monad, and how this differs from x402."

## 16. Bounty strategy (realistic)
| Prize | Plan |
|---|---|
| Track 04 (about $10K per winner, 3 per track) | Primary |
| Monad Foundation: Best Mera-Powered UX ($2,500) | Clean passkey owner flow; read exact criteria on the platform |
| Alibaba (Qwen) / Kimi credits | Use the model the bounty names; confirm rules |
| Privy ($5,000) | Only if you end up on the Privy fallback; check criteria first |
| Envio ($1,000) | P2 only |
| Dropped | One Passkey Many Keys (agents are server-side), Kuru, Dynamic, MetaMask, Chainlink, Agora |

Do not plan around "$20K". Several sponsor prizes are credits, and a track win is one of three slots.

## 17. Risks and mitigations
| Risk | Likelihood | Mitigation |
|---|---|---|
| 3D consumes the week | High | Mock-event decoupling, 1.5-day timebox, 2D fallback |
| Mera PRF unavailable on the demo browser | Medium | Test Day 1 and Day 6; Privy fallback |
| RPC rate limits | High | Dedicated RPC, cached reads, batched claims, polling in browser, nonce manager |
| Next.js SSR vs R3F and Mera | Medium | `use client`, `dynamic(..., { ssr: false })`, single `/mesh` route |
| Transient storage / EVM version mismatch | Low | Use standard `ReentrancyGuard`; set `evm_version` explicitly |
| ERC-8004 Reputation ABI mismatch | Medium | Day 1 spike; local counters fallback |
| LLM tool-calling flakiness | Medium | Spike Day 1; temperature 0; iteration cap; deterministic tiers A and B |
| Failed-tx demo behaves unexpectedly | Low | Simulation decode is the primary display; failed tx is a bonus |
| Testnet reset or faucet limits | Medium | Fund early; mock USDC as last resort |
| Reputation wash trading | Certain (by design) | Disclose; unique-payer counts; owner thresholds |
| Live demo failure | Medium | Replay mode and recorded takes |
| Scope creep | High | Hold the tiers; nothing from the cut list returns after Day 3 |
| Many similar "agent payment" projects | High | Win on execution: real numbers, the revert demo, the x402 comparison |

## 18. Open questions to verify yourself
1. Exact submission cutoff time and time zone; judging criteria; whether late registration is open.
2. ERC-8004 Reputation Registry `giveFeedback` signature and any authorization requirement.
3. Monad's supported EVM version (affects transient storage and `foundry.toml`).
4. Which Qwen model and endpoint the Alibaba bounty accepts, and the Kimi bounty rules.
5. Privy bounty criteria, if you end up using Privy.
6. Whether AutoGen is a hard requirement (if yes, I restore it to P0).
7. Team size.

## 19. Reference values
| Item | Value |
|---|---|
| Network | Monad Testnet, chain ID `10143` |
| RPC | `https://testnet-rpc.monad.xyz` (public, rate limited) |
| ERC-8004 Identity (testnet) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation (testnet) | `0x8004B663056A597Dffe9eCcC1965A193B7388713` (confirm in the official repo) |
| Testnet USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6 decimals) |
| Faucets | `faucet.monad.xyz` (MON); Circle faucet (USDC, 1 per request window) |
| Explorers | testnet.monadscan.com, testnet.monadvision.com |

## 20. Pre-submission checklist
- [ ] Contract deployed and verified; address in README
- [ ] Agents registered in ERC-8004; IDs in README
- [ ] Demo runs from a clean browser profile on the demo machine
- [ ] At least 5 rogue scenarios show named errors; headline ones link a failed tx
- [ ] `forge test` green including fuzz tests
- [ ] Real latency and throughput numbers measured and shown
- [ ] Simulated data labeled as simulated
- [ ] README: architecture, setup, demo steps, x402 comparison, known limitations (wash trading, server-side testnet keys)
- [ ] Replay-mode take recorded as a safety copy
- [ ] Demo video about 3 minutes
- [ ] Short write-up and public project profile
- [ ] Repo accessible to judges
- [ ] Submitted by the evening of 12 Oct
