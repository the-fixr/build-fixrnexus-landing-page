/**
 * Fixr Public API - Access Control & x402 Payment Verification
 *
 * Access Tiers (based on FIXR token staking):
 * - Free: 10 req/min
 * - Builder (1M+ FIXR): 20 req/min
 * - Pro (10M+ FIXR): 50 req/min
 * - Elite (50M+ FIXR): Unlimited
 *
 * x402 Pay-Per-Call: $0.01 USDC on Base per request
 */

import { Context, Next } from 'hono';
import { Env } from './types';

// FIXR Staking Contract on Base
const FIXR_STAKING_ADDRESS = '0x39DbBa2CdAF7F668816957B023cbee1841373F5b';
const FIXR_TREASURY = '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;
const PRICE_PER_CALL = 10000; // 0.01 USDC in 6 decimals

// Solana x402 payment constants
const SOLANA_TREASURY = '96vRDBvjR2FhtzH5WtawLWdLh1dFmZjnY4DEsmjaEvuU';
const USDC_SOLANA_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';

// Tier thresholds in FIXR tokens (18 decimals)
const TIERS = {
  FREE: { minStake: 0n, rateLimit: 10, name: 'FREE' },
  BUILDER: { minStake: 1_000_000n * 10n ** 18n, rateLimit: 20, name: 'BUILDER' },
  PRO: { minStake: 10_000_000n * 10n ** 18n, rateLimit: 50, name: 'PRO' },
  ELITE: { minStake: 50_000_000n * 10n ** 18n, rateLimit: Infinity, name: 'ELITE' },
} as const;

export type TierName = keyof typeof TIERS;

export interface AccessInfo {
  tier: TierName;
  stakedAmount: string;
  rateLimit: number;
  requestsUsed: number;
  wallet?: string;
  paidWithX402: boolean;
}

// In-memory rate limit tracking (per-minute window)
const rateLimitCache = new Map<string, { count: number; windowStart: number }>();

/**
 * Get staked amount for a wallet from the staking contract
 */
async function getStakedAmount(env: Env, wallet: string): Promise<bigint> {
  try {
    // Call staking contract's stakers(address) function
    // Function selector for stakers(address): 0x9168ae72
    const data = `0x9168ae72000000000000000000000000${wallet.slice(2).toLowerCase()}`;

    const response = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: FIXR_STAKING_ADDRESS, data }, 'latest'],
      }),
    });

    const result = (await response.json()) as { result?: string; error?: { message: string } };

    if (result.error || !result.result) {
      console.error('[PublicAPI] Staking lookup error:', result.error);
      return 0n;
    }

    // Decode StakerInfo struct - first 32 bytes is stakedAmount
    const stakedHex = result.result.slice(0, 66); // 0x + 64 chars
    return BigInt(stakedHex);
  } catch (error) {
    console.error('[PublicAPI] Failed to get staked amount:', error);
    return 0n;
  }
}

/**
 * Determine tier based on staked amount
 */
function getTierFromStake(stakedAmount: bigint): TierName {
  if (stakedAmount >= TIERS.ELITE.minStake) return 'ELITE';
  if (stakedAmount >= TIERS.PRO.minStake) return 'PRO';
  if (stakedAmount >= TIERS.BUILDER.minStake) return 'BUILDER';
  return 'FREE';
}

/**
 * Check rate limit for a wallet/identifier
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit(identifier: string, limit: number): { allowed: boolean; used: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  const cached = rateLimitCache.get(identifier);

  if (!cached || now - cached.windowStart > windowMs) {
    // New window
    rateLimitCache.set(identifier, { count: 1, windowStart: now });
    return { allowed: true, used: 1 };
  }

  if (cached.count >= limit) {
    return { allowed: false, used: cached.count };
  }

  cached.count++;
  return { allowed: true, used: cached.count };
}

/**
 * Verify x402 payment transaction
 * Checks that the transaction:
 * 1. Is a USDC transfer on Base
 * 2. Sent to Fixr treasury
 * 3. Amount >= 0.01 USDC
 * 4. Is confirmed
 * 5. Hasn't been used before
 */
async function verifyX402Payment(
  env: Env,
  txHash: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if tx already used (prevent replay)
    if (env.FIXR_KV) {
      const used = await env.FIXR_KV.get(`x402_tx:${txHash}`);
      if (used) {
        return { valid: false, error: 'Transaction already used' };
      }
    }

    // Fetch transaction receipt
    const response = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });

    const result = (await response.json()) as {
      result?: {
        status: string;
        logs: Array<{
          address: string;
          topics: string[];
          data: string;
        }>;
      };
      error?: { message: string };
    };

    if (result.error || !result.result) {
      return { valid: false, error: 'Transaction not found' };
    }

    const receipt = result.result;

    // Check transaction succeeded
    if (receipt.status !== '0x1') {
      return { valid: false, error: 'Transaction failed' };
    }

    // Find USDC Transfer event to treasury
    // Transfer(address,address,uint256) topic: 0xddf252ad...
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    const usdcTransfer = receipt.logs.find((log) => {
      const isUsdc = log.address.toLowerCase() === USDC_BASE.toLowerCase();
      const isTransfer = log.topics[0] === transferTopic;
      const toTreasury =
        log.topics[2] &&
        `0x${log.topics[2].slice(26)}`.toLowerCase() === FIXR_TREASURY.toLowerCase();
      return isUsdc && isTransfer && toTreasury;
    });

    if (!usdcTransfer) {
      return { valid: false, error: 'No USDC transfer to treasury found' };
    }

    // Check amount >= 0.01 USDC
    const amount = BigInt(usdcTransfer.data);
    if (amount < BigInt(PRICE_PER_CALL)) {
      return { valid: false, error: 'Insufficient payment amount' };
    }

    // Mark transaction as used
    if (env.FIXR_KV) {
      await env.FIXR_KV.put(`x402_tx:${txHash}`, Date.now().toString(), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return { valid: true };
  } catch (error) {
    console.error('[PublicAPI] Payment verification error:', error);
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Verify x402 payment on Solana
 * Checks preTokenBalances vs postTokenBalances for USDC transfer to treasury
 */
async function verifySolanaX402Payment(
  env: Env,
  txSignature: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check replay
    if (env.FIXR_KV) {
      const used = await env.FIXR_KV.get(`x402_sol_tx:${txSignature}`);
      if (used) {
        return { valid: false, error: 'Transaction already used' };
      }
    }

    const rpcUrl = env.SOLANA_RPC_URL || SOLANA_PUBLIC_RPC;

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          txSignature,
          { commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
        ],
      }),
    });

    const result = (await response.json()) as {
      result?: {
        meta: {
          err: unknown;
          preTokenBalances: Array<{
            accountIndex: number;
            mint: string;
            owner: string;
            uiTokenAmount: { amount: string; decimals: number };
          }>;
          postTokenBalances: Array<{
            accountIndex: number;
            mint: string;
            owner: string;
            uiTokenAmount: { amount: string; decimals: number };
          }>;
        };
      };
      error?: { message: string };
    };

    if (result.error || !result.result) {
      return { valid: false, error: 'Transaction not found' };
    }

    const { meta } = result.result;

    if (meta.err !== null) {
      return { valid: false, error: 'Transaction failed' };
    }

    // Find treasury's USDC balance change
    const pre = meta.preTokenBalances.find(
      (b) => b.owner === SOLANA_TREASURY && b.mint === USDC_SOLANA_MINT
    );
    const post = meta.postTokenBalances.find(
      (b) => b.owner === SOLANA_TREASURY && b.mint === USDC_SOLANA_MINT
    );

    const preAmount = BigInt(pre?.uiTokenAmount?.amount ?? '0');
    const postAmount = BigInt(post?.uiTokenAmount?.amount ?? '0');
    const received = postAmount - preAmount;

    if (received < BigInt(PRICE_PER_CALL)) {
      return { valid: false, error: 'Insufficient payment amount' };
    }

    // Mark as used
    if (env.FIXR_KV) {
      await env.FIXR_KV.put(`x402_sol_tx:${txSignature}`, Date.now().toString(), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return { valid: true };
  } catch (error) {
    console.error('[PublicAPI] Solana payment verification error:', error);
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Public API access middleware
 * Checks wallet staking tier or x402 payment
 */
export async function publicApiMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response> {
  const wallet = c.req.header('X-Wallet-Address');
  const paymentTxHash = c.req.header('X-Payment-TxHash');
  const paymentChain = (c.req.header('X-Payment-Chain') || 'base').toLowerCase();

  let accessInfo: AccessInfo = {
    tier: 'FREE',
    stakedAmount: '0',
    rateLimit: TIERS.FREE.rateLimit,
    requestsUsed: 0,
    paidWithX402: false,
  };

  // Check x402 payment first (bypasses rate limiting)
  if (paymentTxHash) {
    const verification = paymentChain === 'solana'
      ? await verifySolanaX402Payment(c.env, paymentTxHash)
      : await verifyX402Payment(c.env, paymentTxHash);

    if (verification.valid) {
      accessInfo.paidWithX402 = true;
      accessInfo.tier = 'ELITE'; // Paid requests get elite treatment
      accessInfo.rateLimit = Infinity;
      c.set('accessInfo', accessInfo);
      return next();
    } else {
      return c.json(
        {
          success: false,
          error: 'Invalid payment',
          details: verification.error,
          x402: getX402PaymentOptions(),
        },
        402
      );
    }
  }

  // Check wallet staking tier
  if (wallet && wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
    const stakedAmount = await getStakedAmount(c.env, wallet);
    const tier = getTierFromStake(stakedAmount);

    accessInfo.wallet = wallet;
    accessInfo.tier = tier;
    accessInfo.stakedAmount = stakedAmount.toString();
    accessInfo.rateLimit = TIERS[tier].rateLimit;
  }

  // Check rate limit
  const identifier = wallet || c.req.header('CF-Connecting-IP') || 'anonymous';
  const { allowed, used } = checkRateLimit(identifier, accessInfo.rateLimit);
  accessInfo.requestsUsed = used;

  if (!allowed) {
    return c.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        tier: accessInfo.tier,
        limit: `${accessInfo.rateLimit}/min`,
        used: used,
        upgrade: accessInfo.tier !== 'ELITE' ? 'Stake more FIXR or pay with x402' : undefined,
        x402: getX402PaymentOptions(),
      },
      429
    );
  }

  c.set('accessInfo', accessInfo);
  return next();
}

/**
 * Build x402 payment options object (both Base and Solana)
 */
function getX402PaymentOptions() {
  return {
    pricePerCall: '$0.01 USDC',
    amount: PRICE_PER_CALL,
    chains: {
      base: {
        token: USDC_BASE,
        recipient: FIXR_TREASURY,
        chainId: 8453,
      },
      solana: {
        mint: USDC_SOLANA_MINT,
        recipient: SOLANA_TREASURY,
        network: 'mainnet-beta',
      },
    },
    headers: {
      payment: 'X-Payment-TxHash',
      chain: 'X-Payment-Chain (base | solana)',
      wallet: 'X-Wallet-Address',
    },
  };
}

/**
 * Get access tier endpoint handler
 */
export async function getAccessTier(c: Context<{ Bindings: Env }>): Promise<Response> {
  const wallet = c.req.query('wallet');

  if (!wallet || !wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
    return c.json({ success: false, error: 'Valid wallet address required' }, 400);
  }

  const stakedAmount = await getStakedAmount(c.env, wallet);
  const tier = getTierFromStake(stakedAmount);
  const tierInfo = TIERS[tier];

  // Calculate next tier
  let nextTier: { tier: string; required: string } | undefined;
  if (tier === 'FREE') {
    nextTier = { tier: 'BUILDER', required: '1M FIXR' };
  } else if (tier === 'BUILDER') {
    nextTier = { tier: 'PRO', required: '10M FIXR' };
  } else if (tier === 'PRO') {
    nextTier = { tier: 'ELITE', required: '50M FIXR' };
  }

  return c.json({
    success: true,
    wallet,
    tier,
    stakedAmount: stakedAmount.toString(),
    rateLimit: `${tierInfo.rateLimit}/min`,
    nextTier,
    staking: {
      contract: FIXR_STAKING_ADDRESS,
      chain: 'Base',
    },
  });
}

/**
 * Get x402 payment info endpoint handler
 */
export function getPaymentInfo(c: Context<{ Bindings: Env }>): Response {
  return c.json({
    success: true,
    x402: {
      version: 2,
      pricePerCall: '$0.01 USDC',
      priceInUnits: PRICE_PER_CALL,
      chains: {
        base: {
          token: USDC_BASE,
          symbol: 'USDC',
          decimals: USDC_DECIMALS,
          chainId: 8453,
          recipient: FIXR_TREASURY,
        },
        solana: {
          mint: USDC_SOLANA_MINT,
          symbol: 'USDC',
          decimals: USDC_DECIMALS,
          network: 'mainnet-beta',
          recipient: SOLANA_TREASURY,
        },
      },
      headers: {
        payment: 'X-Payment-TxHash',
        chain: 'X-Payment-Chain (base | solana, default: base)',
        wallet: 'X-Wallet-Address',
      },
    },
    tiers: Object.entries(TIERS).map(([name, info]) => ({
      name,
      minStake: info.minStake.toString(),
      rateLimit: info.rateLimit === Infinity ? 'Unlimited' : `${info.rateLimit}/min`,
    })),
  });
}

/**
 * Helper to get access info from context
 */
export function getAccessInfo(c: Context): AccessInfo | undefined {
  return c.get('accessInfo') as AccessInfo | undefined;
}

// Export constants for docs
export const API_CONFIG = {
  FIXR_STAKING_ADDRESS,
  FIXR_TREASURY,
  USDC_BASE,
  SOLANA_TREASURY,
  USDC_SOLANA_MINT,
  PRICE_PER_CALL,
  TIERS,
};
