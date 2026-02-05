import { NextRequest, NextResponse } from 'next/server';
import { getTierInfo, generateChallenge } from '@/lib/staking-tiers';

/**
 * GET /api/access/tier?wallet=0x...
 * Check staking tier for a wallet address
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');

  if (!wallet || !wallet.startsWith('0x')) {
    return NextResponse.json(
      { error: 'Valid wallet address required' },
      { status: 400 }
    );
  }

  try {
    const tierInfo = await getTierInfo(wallet);
    const challenge = generateChallenge(wallet);

    return NextResponse.json({
      success: true,
      wallet,
      tier: tierInfo.tier,
      stakedAmount: tierInfo.stakedAmount.toString(),
      stakedFormatted: formatTokens(tierInfo.stakedAmount),
      rateLimit: tierInfo.rateLimit === -1 ? 'unlimited' : `${tierInfo.rateLimit}/min`,
      benefits: tierInfo.benefits,
      authChallenge: challenge,
      nextTier: getNextTierInfo(tierInfo.tier),
    });
  } catch (error) {
    console.error('Tier check error:', error);
    return NextResponse.json(
      { error: 'Failed to check tier' },
      { status: 500 }
    );
  }
}

function formatTokens(amount: bigint): string {
  const tokens = Number(amount / 10n ** 18n);
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

function getNextTierInfo(currentTier: string): { tier: string; required: string } | null {
  switch (currentTier) {
    case 'FREE':
      return { tier: 'BUILDER', required: '1M FIXR' };
    case 'BUILDER':
      return { tier: 'PRO', required: '10M FIXR' };
    case 'PRO':
      return { tier: 'ELITE', required: '50M FIXR' };
    default:
      return null;
  }
}
