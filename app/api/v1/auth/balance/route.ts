import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const FEEDS_CREDITS_ADDRESS = process.env.FEEDS_CREDITS_ADDRESS || '';
const PROVIDER = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com');

const FEEDS_CREDITS_ABI = [
  'function balanceOf(address user) external view returns (uint256)',
  'function hasCredits(address user, uint256 amount) external view returns (bool)',
];

/**
 * GET /api/v1/auth/balance?key=feeds_xxx
 * Check credit balance and usage for an API key
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get API key info
    const { data: keyInfo, error: keyError } = await supabase
      .from('api_keys')
      .select('wallet_address, created_at, last_used_at, is_active')
      .eq('api_key', apiKey)
      .single();

    if (keyError || !keyInfo) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (!keyInfo.is_active) {
      return NextResponse.json(
        { error: 'API key is inactive' },
        { status: 401 }
      );
    }

    // Get on-chain balance
    let onChainBalance = '0';
    let onChainBalanceFormatted = '0';

    if (FEEDS_CREDITS_ADDRESS && ethers.isAddress(FEEDS_CREDITS_ADDRESS)) {
      try {
        const credits = new ethers.Contract(FEEDS_CREDITS_ADDRESS, FEEDS_CREDITS_ABI, PROVIDER);
        const balance = await credits.balanceOf(keyInfo.wallet_address);
        onChainBalance = balance.toString();
        onChainBalanceFormatted = ethers.formatEther(balance);
      } catch (e) {
        console.error('Failed to fetch on-chain balance:', e);
      }
    }

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: todayUsage } = await supabase
      .from('daily_usage')
      .select('call_count, total_cost_wei')
      .eq('wallet_address', keyInfo.wallet_address)
      .eq('date', today)
      .single();

    // Get total pending (undeducted) usage
    const { data: pendingUsage } = await supabase
      .from('daily_usage')
      .select('call_count, total_cost_wei')
      .eq('wallet_address', keyInfo.wallet_address)
      .eq('deducted', false);

    const totalPendingCalls = pendingUsage?.reduce((sum, day) => sum + day.call_count, 0) || 0;
    const totalPendingCostWei = pendingUsage?.reduce((sum, day) => sum + BigInt(day.total_cost_wei), BigInt(0)) || BigInt(0);

    // Get pricing
    const { data: pricing } = await supabase
      .from('pricing_config')
      .select('price_per_call_wei')
      .eq('name', 'default')
      .eq('is_active', true)
      .single();

    const pricePerCall = pricing?.price_per_call_wei || 300000000000000;
    const balanceWei = BigInt(onChainBalance);
    const remainingAfterPending = balanceWei - totalPendingCostWei;
    const callsRemaining = remainingAfterPending > 0 ? Number(remainingAfterPending / BigInt(pricePerCall)) : 0;

    return NextResponse.json({
      success: true,
      walletAddress: keyInfo.wallet_address,
      balance: {
        wei: onChainBalance,
        eth: onChainBalanceFormatted,
        usd: (parseFloat(onChainBalanceFormatted) * 3000).toFixed(2), // Approximate at $3k ETH
      },
      usage: {
        today: {
          calls: todayUsage?.call_count || 0,
          costWei: todayUsage?.total_cost_wei?.toString() || '0',
        },
        pending: {
          calls: totalPendingCalls,
          costWei: totalPendingCostWei.toString(),
        },
      },
      pricing: {
        perCallWei: pricePerCall.toString(),
        perCallEth: ethers.formatEther(pricePerCall),
        perCallUsd: (parseFloat(ethers.formatEther(pricePerCall)) * 3000).toFixed(4),
      },
      callsRemaining,
      lastUsedAt: keyInfo.last_used_at,
      createdAt: keyInfo.created_at,
    });

  } catch (error: any) {
    console.error('Balance check error:', error);
    return NextResponse.json(
      { error: 'Failed to check balance', details: error.message },
      { status: 500 }
    );
  }
}
