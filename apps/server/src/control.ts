import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet, SpendGuardAbi } from '@agentmesh/sdk';
import { CONFIG } from './config.js';

const USDC_DECIMALS = 6;
const EXPLORER_BASE = 'https://testnet.monadscan.com';

// SpendGuard's standard buyer envelope (matches apps/agents policy template).
const STANDARD_POLICY = {
  maxPerChannel: 10_000_000n, // $10.00
  budgetPerWindow: 5_000_000n, // $5.00
  windowSecs: 3600n,
  minPayeeRep: 50n,
  requireRegisteredPayee: true,
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const HEX_KEY = /^0x[0-9a-fA-F]{64}$/;

// Monad testnet RPC occasionally drops individual calls under concurrent load.
// Retry transient reads rather than silently defaulting them to zero (which
// would corrupt the dashboard with plausible-looking zeros).
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr;
}

const ttlCache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = ttlCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  ttlCache.set(key, { at: Date.now(), value });
  return value;
}

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(CONFIG.RPC_URL),
});

export const ownerAccount =
  CONFIG.OWNER_PRIVATE_KEY && HEX_KEY.test(CONFIG.OWNER_PRIVATE_KEY)
    ? privateKeyToAccount(CONFIG.OWNER_PRIVATE_KEY)
    : null;

const ownerWallet = ownerAccount
  ? createWalletClient({
      account: ownerAccount,
      chain: monadTestnet,
      transport: http(CONFIG.RPC_URL),
    })
  : null;

const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;
const toUSDC = (units: bigint) => Number(formatUnits(units, USDC_DECIMALS));

export interface VaultState {
  vaultBalanceUSDC: number;
  ownerUSDCBalance: number;
  usdc: string;
  owner: string | null;
}

export interface ControlAgent {
  address: string;
  role: string;
  tier: 'A' | 'B' | 'C';
  erc8004Id: number;
  active: boolean;
  budgetLimit: number;
  budgetSpent: number;
  maxPerChannel: number;
  windowSecs: number;
  minPayeeRep: number;
  policyExpiry: number;
}

function agentAccounts() {
  return CONFIG.AGENT_KEYS.filter((a) => a.key && HEX_KEY.test(a.key)).map((a) => ({
    tier: a.tier,
    role: a.role,
    account: privateKeyToAccount(a.key as `0x${string}`),
  }));
}

export function controlConfigured(): boolean {
  return ownerWallet !== null;
}

export async function readVault(): Promise<VaultState> {
  return cached('vault', 2000, async () => {
    const owner = ownerAccount?.address ?? null;
    const [vaultBal, ownerBal] = await Promise.all([
      withRetry(() =>
        publicClient.readContract({
          address: CONFIG.SPEND_GUARD_ADDRESS,
          abi: SpendGuardAbi,
          functionName: 'vaultBalance',
        })
      ),
      owner
        ? withRetry(() =>
            publicClient.readContract({
              address: CONFIG.USDC_ADDRESS,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [owner],
            })
          )
        : Promise.resolve(0n),
    ]);

    return {
      vaultBalanceUSDC: toUSDC(vaultBal as bigint),
      ownerUSDCBalance: toUSDC(ownerBal as bigint),
      usdc: CONFIG.USDC_ADDRESS,
      owner,
    };
  });
}

export async function fundVault(amountUSDC = 1) {
  if (!ownerWallet || !ownerAccount) {
    throw new Error('Owner key (DEPLOYER_PRIVATE_KEY) not configured — cannot fund vault');
  }
  const amount = parseUnits(String(amountUSDC), USDC_DECIMALS);
  if (amount <= 0n) throw new Error('Fund amount must be greater than zero');

  const ownerBal = (await publicClient.readContract({
    address: CONFIG.USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [ownerAccount.address],
  })) as bigint;
  if (ownerBal < amount) {
    throw new Error(
      `Owner wallet holds ${formatUnits(ownerBal, USDC_DECIMALS)} USDC — less than the requested ${amountUSDC}`
    );
  }

  const allowance = (await publicClient.readContract({
    address: CONFIG.USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [ownerAccount.address, CONFIG.SPEND_GUARD_ADDRESS],
  })) as bigint;
  if (allowance < amount) {
    const approveHash = await ownerWallet.writeContract({
      address: CONFIG.USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONFIG.SPEND_GUARD_ADDRESS, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const hash = await ownerWallet.writeContract({
    address: CONFIG.SPEND_GUARD_ADDRESS,
    abi: SpendGuardAbi,
    functionName: 'fund',
    args: [amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('fund() transaction reverted');

  // The fund succeeded on-chain; a post-read failure must not report the whole
  // operation as failed, so fall back to a null balance (the client re-fetches).
  const vault = await readVault().catch(() => null);
  return {
    txHash: hash,
    explorerUrl: txUrl(hash),
    amountUSDC,
    vaultBalanceUSDC: vault ? vault.vaultBalanceUSDC : null,
  };
}

export async function readAgents(): Promise<ControlAgent[]> {
  return cached('agents', 2000, async () => {
    const out: ControlAgent[] = [];
    for (const { tier, role, account } of agentAccounts()) {
      const [policy, tracker] = await Promise.all([
        withRetry(() =>
          publicClient.readContract({
            address: CONFIG.SPEND_GUARD_ADDRESS,
            abi: SpendGuardAbi,
            functionName: 'policies',
            args: [account.address],
          })
        ),
        withRetry(() =>
          publicClient.readContract({
            address: CONFIG.SPEND_GUARD_ADDRESS,
            abi: SpendGuardAbi,
            functionName: 'windowTrackers',
            args: [account.address],
          })
        ),
      ]);

      const p = policy as readonly unknown[];
      const t = tracker as readonly unknown[];
      out.push({
        address: account.address,
        role,
        tier,
        erc8004Id: 0,
        active: Boolean(p[6]),
        budgetLimit: toUSDC(p[1] as bigint),
        budgetSpent: toUSDC(t[1] as bigint),
        maxPerChannel: toUSDC(p[0] as bigint),
        windowSecs: Number(p[2]),
        minPayeeRep: Number(p[4]),
        policyExpiry: Number(p[3]),
      });
    }
    return out;
  });
}

export async function setAgentActive(address: `0x${string}`, active: boolean) {
  if (!ownerWallet || !ownerAccount) {
    throw new Error('Owner key (DEPLOYER_PRIVATE_KEY) not configured');
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid agent address');
  // Lowercase to sidestep EIP-1191 (Monad chainId 10143) checksums that viem's
  // chain-agnostic argument encoder would reject as invalid EIP-55 checksums.
  const addr = address.toLowerCase() as Address;

  let hash: `0x${string}`;
  if (active) {
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400);
    hash = await ownerWallet.writeContract({
      address: CONFIG.SPEND_GUARD_ADDRESS,
      abi: SpendGuardAbi,
      functionName: 'setPolicy',
      args: [
        addr,
        STANDARD_POLICY.maxPerChannel,
        STANDARD_POLICY.budgetPerWindow,
        STANDARD_POLICY.windowSecs,
        expiry,
        STANDARD_POLICY.minPayeeRep,
        STANDARD_POLICY.requireRegisteredPayee,
      ],
    });
  } else {
    hash = await ownerWallet.writeContract({
      address: CONFIG.SPEND_GUARD_ADDRESS,
      abi: SpendGuardAbi,
      functionName: 'revokeAgent',
      args: [addr],
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash, explorerUrl: txUrl(hash), txStatus: receipt.status, active };
}
