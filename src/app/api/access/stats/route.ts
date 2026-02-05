import { NextRequest, NextResponse } from 'next/server';
import { checkApiAccess, createAccessHeaders } from '@/lib/api-access';
import {
  getUsageStats,
  getWalletUsage,
  getTopWallets,
  getRecentCalls,
  getHourlyStats,
  getHistoricalStats,
  getWalletHistoricalStats,
} from '@/lib/api-tracking';

/**
 * GET /api/access/stats
 * Get API usage statistics
 *
 * Query params:
 * - wallet: Get stats for specific wallet
 * - top: Get top N wallets by usage
 * - recent: Get last N API calls (admin only)
 * - hours: Get stats for last N hours (default: 24)
 */
export async function GET(request: NextRequest) {
  const access = await checkApiAccess(request, {
    minimumTier: 'BUILDER',
    allowPayment: false,
  });

  if (!access.allowed) {
    return access.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const wallet = searchParams.get('wallet');
  const top = searchParams.get('top');
  const recent = searchParams.get('recent');
  const hours = parseInt(searchParams.get('hours') || '24', 10);
  const historical = searchParams.get('historical'); // days for Supabase query

  // If requesting specific wallet stats
  if (wallet) {
    // Try memory first, fall back to Supabase for historical
    let walletStats = getWalletUsage(wallet);

    if (!walletStats && historical) {
      walletStats = await getWalletHistoricalStats(wallet);
    }

    if (!walletStats) {
      return NextResponse.json(
        { error: 'No usage data for this wallet' },
        { status: 404, headers: createAccessHeaders(access) }
      );
    }
    return NextResponse.json(
      { success: true, wallet: walletStats, source: walletStats ? 'memory' : 'supabase' },
      { headers: createAccessHeaders(access) }
    );
  }

  // If requesting top wallets
  if (top) {
    const limit = Math.min(parseInt(top, 10) || 10, 100);
    const topWallets = getTopWallets(limit);
    return NextResponse.json(
      { success: true, topWallets },
      { headers: createAccessHeaders(access) }
    );
  }

  // If requesting recent calls (PRO+ only)
  if (recent) {
    if (access.tier !== 'PRO' && access.tier !== 'ELITE') {
      return NextResponse.json(
        { error: 'Recent calls requires PRO tier or higher' },
        { status: 403, headers: createAccessHeaders(access) }
      );
    }
    const limit = Math.min(parseInt(recent, 10) || 100, 500);
    const recentCalls = getRecentCalls(limit);
    return NextResponse.json(
      { success: true, recentCalls },
      { headers: createAccessHeaders(access) }
    );
  }

  // Default: aggregate stats
  // If historical param provided, query Supabase for longer time range
  if (historical) {
    const days = parseInt(historical, 10) || 30;
    const historicalStats = await getHistoricalStats(days);

    if (!historicalStats) {
      return NextResponse.json(
        { error: 'Historical stats not available (Supabase not configured or no data)' },
        { status: 503, headers: createAccessHeaders(access) }
      );
    }

    return NextResponse.json({
      success: true,
      period: `last ${days} days`,
      source: 'supabase',
      stats: historicalStats,
    }, {
      headers: createAccessHeaders(access),
    });
  }

  // In-memory stats (real-time, limited to server uptime)
  const since = Date.now() - hours * 60 * 60 * 1000;
  const stats = getUsageStats(since);
  const hourlyStats = getHourlyStats();

  return NextResponse.json({
    success: true,
    period: `last ${hours} hours`,
    source: 'memory',
    stats,
    hourly: hourlyStats,
  }, {
    headers: createAccessHeaders(access),
  });
}
