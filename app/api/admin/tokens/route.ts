export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const AUTHORIZED_WALLET = '0xbe2cc1861341f3b058a3307385beba84167b3fa4';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    db: { schema: 'public' },
    auth: { persistSession: false },
  });
}

function checkAuth(request: NextRequest): boolean {
  const wallet = request.headers.get('x-wallet-address');
  return wallet?.toLowerCase() === AUTHORIZED_WALLET;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('launched_tokens')
    .select('*')
    .order('launched_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tokens: (data || []).map((t) => ({
      address: t.address,
      tokenId: t.token_id,
      name: t.name,
      symbol: t.symbol,
      txHash: t.tx_hash,
      launchedAt: t.launched_at,
      description: t.description,
      fairLaunchPercent: t.fair_launch_percent,
      fairLaunchDuration: t.fair_launch_duration,
      initialMarketCapUSD: t.initial_market_cap_usd,
      creatorFeePercent: t.creator_fee_percent,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
  }

  const body = await request.json();
  const { address, tokenId, name, symbol, txHash, description, fairLaunchPercent, fairLaunchDuration, initialMarketCapUSD, creatorFeePercent } = body;

  if (!address || !name || !symbol || !txHash) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('launched_tokens')
    .upsert({
      address: address.toLowerCase(),
      token_id: tokenId,
      name,
      symbol,
      tx_hash: txHash,
      launched_at: Date.now(),
      description: description || '',
      fair_launch_percent: fairLaunchPercent ?? 50,
      fair_launch_duration: fairLaunchDuration ?? 1800,
      initial_market_cap_usd: initialMarketCapUSD ?? 5000,
      creator_fee_percent: creatorFeePercent ?? 80,
    }, { onConflict: 'address' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, token: data });
}
