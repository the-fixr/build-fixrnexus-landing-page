import { ethers } from 'ethers';

// Contract addresses
const STAKING_CONTRACT = '0x39DbBa2CdAF7F668816957B023cbee1841373F5b';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Tier thresholds (in tokens, not wei)
export const TIER_THRESHOLDS = {
  FREE: 0,
  BUILDER: 1_000_000,      // 1M
  PRO: 10_000_000,         // 10M
  ELITE: 50_000_000,       // 50M
} as const;

// Rate limits per tier (requests per minute)
export const TIER_RATE_LIMITS = {
  FREE: 10,
  BUILDER: 20,    // 2x
  PRO: 50,        // 5x
  ELITE: -1,      // Unlimited (-1)
} as const;

// x402 pricing per request (in wei) for non-stakers
export const X402_PRICE_PER_REQUEST = ethers.parseEther('0.0001'); // 0.0001 ETH

export type StakingTier = keyof typeof TIER_THRESHOLDS;

export interface TierInfo {
  tier: StakingTier;
  stakedAmount: bigint;
  rateLimit: number;
  benefits: string[];
}

// Minimal ABI for checking staked balance
const STAKING_ABI = [
  'function getStakedBalance(address user) view returns (uint256)',
  'function getUserPositions(address user) view returns (tuple(uint256 amount, uint256 weightedAmount, uint256 lockEnd, uint8 tier, uint256 rewardDebt)[])',
];

let provider: ethers.JsonRpcProvider | null = null;
let stakingContract: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

function getStakingContract(): ethers.Contract {
  if (!stakingContract) {
    stakingContract = new ethers.Contract(
      STAKING_CONTRACT,
      STAKING_ABI,
      getProvider()
    );
  }
  return stakingContract;
}

/**
 * Get the staked balance for a wallet address
 */
export async function getStakedBalance(walletAddress: string): Promise<bigint> {
  try {
    const contract = getStakingContract();
    const positions = await contract.getUserPositions(walletAddress);

    // Sum up all staked amounts
    let totalStaked = 0n;
    for (const position of positions) {
      totalStaked += position.amount;
    }

    return totalStaked;
  } catch (error) {
    console.error('Error fetching staked balance:', error);
    return 0n;
  }
}

/**
 * Determine the tier for a given staked amount
 */
export function getTierFromAmount(stakedAmount: bigint): StakingTier {
  // Convert from wei to tokens (18 decimals)
  const tokens = Number(stakedAmount / 10n ** 18n);

  if (tokens >= TIER_THRESHOLDS.ELITE) return 'ELITE';
  if (tokens >= TIER_THRESHOLDS.PRO) return 'PRO';
  if (tokens >= TIER_THRESHOLDS.BUILDER) return 'BUILDER';
  return 'FREE';
}

/**
 * Get full tier info for a wallet address
 */
export async function getTierInfo(walletAddress: string): Promise<TierInfo> {
  const stakedAmount = await getStakedBalance(walletAddress);
  const tier = getTierFromAmount(stakedAmount);

  const benefits: Record<StakingTier, string[]> = {
    FREE: ['Basic API access', 'Standard rate limits', 'Community support'],
    BUILDER: ['2x API rate limits', 'Basic analytics', 'Email support'],
    PRO: ['5x API rate limits', 'Premium dashboard', 'Priority support'],
    ELITE: ['Unlimited API', 'Early access', 'Dedicated support'],
  };

  return {
    tier,
    stakedAmount,
    rateLimit: TIER_RATE_LIMITS[tier],
    benefits: benefits[tier],
  };
}

/**
 * Check if a wallet has at least a certain tier
 */
export async function hasMinimumTier(
  walletAddress: string,
  minimumTier: StakingTier
): Promise<boolean> {
  const tierInfo = await getTierInfo(walletAddress);
  const tierOrder: StakingTier[] = ['FREE', 'BUILDER', 'PRO', 'ELITE'];

  const userTierIndex = tierOrder.indexOf(tierInfo.tier);
  const requiredTierIndex = tierOrder.indexOf(minimumTier);

  return userTierIndex >= requiredTierIndex;
}

/**
 * Verify a wallet signature to prove ownership
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Generate a challenge message for wallet verification
 */
export function generateChallenge(walletAddress: string): string {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(7);
  return `FIXR API Access\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
}
