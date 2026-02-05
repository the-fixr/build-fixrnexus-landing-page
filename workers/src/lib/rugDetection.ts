/**
 * Rug Detection & Incident Response System
 *
 * Monitors previously analyzed tokens for rug indicators:
 * - Price crash: >80% drop in 24h
 * - Liquidity pulled: LP removed
 * - Honeypot flip: Was tradeable, now fails sell simulation
 * - GoPlus flags: Owner dumped, trading disabled
 *
 * Posts incident updates when rugs are confirmed.
 */

import { Env } from './types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { analyzeToken, NETWORK_IDS } from './geckoterminal';
import { getGoPlusTokenSecurity } from './goplus';
import { postToFarcaster } from './social';
import { postRugAlertToX } from './xPosting';

// Types
export interface TrackedToken {
  address: string;
  symbol: string;
  name: string;
  network: string;
  // Original analysis data
  originalScore: number;
  originalPrice: number;
  originalLiquidity: number;
  originalAnalyzedAt: string;
  // Current state
  currentPrice?: number;
  currentLiquidity?: number;
  priceChange24h?: number;
  lastCheckedAt?: string;
  // Status
  status: 'active' | 'rugged' | 'suspicious' | 'delisted';
  rugIndicators: string[];
  incidentPostedAt?: string;
  incidentHash?: string;
}

export interface RugIncident {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  network: string;
  // What happened
  rugType: 'price_crash' | 'liquidity_pull' | 'honeypot_flip' | 'owner_dump' | 'trading_disabled';
  severity: 'warning' | 'confirmed' | 'critical';
  // Evidence
  originalPrice: number;
  currentPrice: number;
  priceDropPercent: number;
  originalLiquidity: number;
  currentLiquidity: number;
  liquidityDropPercent: number;
  indicators: string[];
  // Our original call
  originalScore: number;
  originalAnalyzedAt: string;
  wePredictedIt: boolean; // Did our score flag it as risky?
  // Timestamps
  detectedAt: string;
  postedAt?: string;
  postHash?: string;
}

// Get Supabase client
function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

/**
 * Track a token after analysis (call this from tokenReport)
 */
export async function trackAnalyzedToken(
  env: Env,
  address: string,
  symbol: string,
  name: string,
  network: string,
  score: number,
  price: number,
  liquidity: number
): Promise<void> {
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  const { error } = await supabase.from('tracked_tokens').upsert({
    address: address.toLowerCase(),
    symbol,
    name,
    network,
    original_score: score,
    original_price: price,
    original_liquidity: liquidity,
    original_analyzed_at: now,
    current_price: price,
    current_liquidity: liquidity,
    last_checked_at: now,
    status: 'active',
    rug_indicators: [],
    created_at: now,
  }, {
    onConflict: 'address',
  });

  if (error) {
    console.error('Failed to track token:', error);
  } else {
    console.log(`Tracking token ${symbol} (${address}) - Score: ${score}`);
  }
}

/**
 * Check a single token for rug indicators
 */
export async function checkTokenForRug(
  env: Env,
  token: TrackedToken
): Promise<{ isRugged: boolean; incident?: RugIncident }> {
  const indicators: string[] = [];
  let rugType: RugIncident['rugType'] | null = null;
  let severity: RugIncident['severity'] = 'warning';

  // Fetch current data
  const networkId = NETWORK_IDS[token.network as keyof typeof NETWORK_IDS] || 'base';
  const [geckoData, goplusData] = await Promise.all([
    analyzeToken(token.address, token.network),
    getGoPlusTokenSecurity(env, token.address, token.network),
  ]);

  const currentPrice = geckoData?.token?.priceUsd ? parseFloat(geckoData.token.priceUsd) : 0;
  const rawLiquidity = geckoData?.topPools?.[0]?.reserveUsd;
  const currentLiquidity = typeof rawLiquidity === 'string' ? parseFloat(rawLiquidity) : (rawLiquidity || 0);

  // Calculate changes
  const priceDropPercent = token.originalPrice > 0
    ? ((token.originalPrice - currentPrice) / token.originalPrice) * 100
    : 0;

  const liquidityDropPercent = token.originalLiquidity > 0
    ? ((token.originalLiquidity - currentLiquidity) / token.originalLiquidity) * 100
    : 0;

  // Check 1: Price crash (>80% drop)
  if (priceDropPercent >= 80) {
    indicators.push(`📉 Price crashed ${priceDropPercent.toFixed(0)}% (was $${token.originalPrice.toFixed(8)}, now $${currentPrice.toFixed(8)})`);
    rugType = 'price_crash';
    severity = priceDropPercent >= 95 ? 'critical' : 'confirmed';
  } else if (priceDropPercent >= 50) {
    indicators.push(`⚠️ Price down ${priceDropPercent.toFixed(0)}%`);
  }

  // Check 2: Liquidity pulled (>90% removed)
  if (liquidityDropPercent >= 90) {
    indicators.push(`💨 Liquidity pulled: ${liquidityDropPercent.toFixed(0)}% removed (was $${token.originalLiquidity.toLocaleString()}, now $${currentLiquidity.toLocaleString()})`);
    rugType = rugType || 'liquidity_pull';
    severity = 'critical';
  } else if (liquidityDropPercent >= 50) {
    indicators.push(`⚠️ Liquidity down ${liquidityDropPercent.toFixed(0)}%`);
  }

  // Check 3: GoPlus flags
  if (goplusData) {
    // Honeypot flip
    if (goplusData.security?.is_honeypot === '1') {
      indicators.push('🍯 Now flagged as HONEYPOT (wasn\'t before)');
      rugType = rugType || 'honeypot_flip';
      severity = 'critical';
    }

    // Trading disabled
    if (goplusData.security?.trading_cooldown === '1' || goplusData.security?.cannot_sell_all === '1') {
      indicators.push('🚫 Trading restrictions detected');
      rugType = rugType || 'trading_disabled';
      severity = severity === 'warning' ? 'confirmed' : severity;
    }

    // Owner actions
    if (goplusData.security?.owner_change_balance === '1') {
      indicators.push('👤 Owner can modify balances');
    }
  }

  // Check 4: Token delisted (no data)
  if (!geckoData?.token && token.status === 'active') {
    indicators.push('❓ Token no longer tradeable on DEXes');
    rugType = rugType || 'liquidity_pull';
  }

  // Update token in database
  const supabase = getSupabase(env);
  const newStatus = rugType ? (severity === 'critical' ? 'rugged' : 'suspicious') : token.status;

  await supabase.from('tracked_tokens').update({
    current_price: currentPrice,
    current_liquidity: currentLiquidity,
    price_change_24h: -priceDropPercent,
    last_checked_at: new Date().toISOString(),
    status: newStatus,
    rug_indicators: indicators,
  }).eq('address', token.address.toLowerCase());

  // If rugged, create incident
  if (rugType && severity !== 'warning') {
    const incident: RugIncident = {
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      network: token.network,
      rugType,
      severity,
      originalPrice: token.originalPrice,
      currentPrice,
      priceDropPercent,
      originalLiquidity: token.originalLiquidity,
      currentLiquidity,
      liquidityDropPercent,
      indicators,
      originalScore: token.originalScore,
      originalAnalyzedAt: token.originalAnalyzedAt,
      wePredictedIt: token.originalScore < 50, // We flagged it as risky
      detectedAt: new Date().toISOString(),
    };

    return { isRugged: true, incident };
  }

  return { isRugged: false };
}

/**
 * Scan all tracked tokens for rugs
 */
export async function scanForRugs(
  env: Env,
  maxTokens: number = 20
): Promise<{ checked: number; rugsFound: RugIncident[] }> {
  const supabase = getSupabase(env);

  // Get active tokens that haven't been checked in 6+ hours
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: tokens, error } = await supabase
    .from('tracked_tokens')
    .select('*')
    .eq('status', 'active')
    .or(`last_checked_at.is.null,last_checked_at.lt.${sixHoursAgo}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(maxTokens);

  if (error || !tokens) {
    console.error('Failed to fetch tracked tokens:', error);
    return { checked: 0, rugsFound: [] };
  }

  console.log(`Scanning ${tokens.length} tokens for rugs...`);

  const rugsFound: RugIncident[] = [];

  for (const row of tokens) {
    const token: TrackedToken = {
      address: row.address,
      symbol: row.symbol,
      name: row.name,
      network: row.network,
      originalScore: row.original_score,
      originalPrice: row.original_price,
      originalLiquidity: row.original_liquidity,
      originalAnalyzedAt: row.original_analyzed_at,
      currentPrice: row.current_price,
      currentLiquidity: row.current_liquidity,
      priceChange24h: row.price_change_24h,
      lastCheckedAt: row.last_checked_at,
      status: row.status,
      rugIndicators: row.rug_indicators || [],
      incidentPostedAt: row.incident_posted_at,
      incidentHash: row.incident_hash,
    };

    try {
      const result = await checkTokenForRug(env, token);
      if (result.isRugged && result.incident) {
        rugsFound.push(result.incident);
      }
    } catch (err) {
      console.error(`Error checking ${token.symbol}:`, err);
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`Scan complete: ${tokens.length} checked, ${rugsFound.length} rugs found`);
  return { checked: tokens.length, rugsFound };
}

/**
 * Post incident update to Farcaster
 */
export async function postRugIncident(
  env: Env,
  incident: RugIncident
): Promise<{ success: boolean; hash?: string }> {
  const supabase = getSupabase(env);

  // Check if we already posted about this
  const { data: existing } = await supabase
    .from('tracked_tokens')
    .select('incident_posted_at')
    .eq('address', incident.tokenAddress.toLowerCase())
    .single();

  if (existing?.incident_posted_at) {
    console.log(`Already posted about ${incident.tokenSymbol} rug`);
    return { success: false };
  }

  // Build incident message
  const severityEmoji = {
    warning: '⚠️',
    confirmed: '🚨',
    critical: '💀',
  };

  const predictionNote = incident.wePredictedIt
    ? `\n\n📊 We called it: Original score was ${incident.originalScore}/100 (flagged as risky)`
    : `\n\n📊 Our original score: ${incident.originalScore}/100`;

  const message = `${severityEmoji[incident.severity]} RUG ALERT: $${incident.tokenSymbol}

${incident.indicators.slice(0, 3).join('\n')}

Original analysis: ${new Date(incident.originalAnalyzedAt).toLocaleDateString()}${predictionNote}

Contract: ${incident.tokenAddress.slice(0, 10)}...${incident.tokenAddress.slice(-8)}

stay safe out there. DYOR always. 🔒`;

  // Post to Farcaster
  const result = await postToFarcaster(env, message);

  if (result.success && result.postId) {
    // Update token with incident info
    await supabase.from('tracked_tokens').update({
      incident_posted_at: new Date().toISOString(),
      incident_hash: result.postId,
    }).eq('address', incident.tokenAddress.toLowerCase());

    // Save incident to incidents table
    await supabase.from('rug_incidents').insert({
      token_address: incident.tokenAddress,
      token_symbol: incident.tokenSymbol,
      token_name: incident.tokenName,
      network: incident.network,
      rug_type: incident.rugType,
      severity: incident.severity,
      original_price: incident.originalPrice,
      current_price: incident.currentPrice,
      price_drop_percent: incident.priceDropPercent,
      original_liquidity: incident.originalLiquidity,
      current_liquidity: incident.currentLiquidity,
      liquidity_drop_percent: incident.liquidityDropPercent,
      indicators: incident.indicators,
      original_score: incident.originalScore,
      original_analyzed_at: incident.originalAnalyzedAt,
      we_predicted_it: incident.wePredictedIt,
      detected_at: incident.detectedAt,
      posted_at: new Date().toISOString(),
      post_hash: result.postId,
    });

    console.log(`Posted rug incident for ${incident.tokenSymbol}: ${result.postId}`);

    // Also post critical rugs to X (costs $0.02)
    if (incident.severity === 'critical') {
      try {
        const xResult = await postRugAlertToX(
          env,
          incident.tokenSymbol,
          incident.rugType,
          incident.priceDropPercent,
          incident.wePredictedIt
        );
        if (xResult.success) {
          console.log(`Also posted rug alert to X: ${xResult.tweetUrl} (cost: $${xResult.cost})`);
        }
      } catch (xError) {
        console.error('X rug alert failed (continuing):', xError);
      }
    }

    return { success: true, hash: result.postId };
  }

  return { success: false };
}

/**
 * Run full rug scan and post incidents
 */
export async function runRugScan(
  env: Env
): Promise<{ checked: number; rugsFound: number; postsCreated: number }> {
  const { checked, rugsFound } = await scanForRugs(env);

  let postsCreated = 0;

  for (const incident of rugsFound) {
    const result = await postRugIncident(env, incident);
    if (result.success) {
      postsCreated++;
    }
    // Rate limit between posts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { checked, rugsFound: rugsFound.length, postsCreated };
}

/**
 * Get recent rug incidents
 */
export async function getRecentIncidents(
  env: Env,
  limit: number = 10
): Promise<RugIncident[]> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('rug_incidents')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map(row => ({
    tokenAddress: row.token_address,
    tokenSymbol: row.token_symbol,
    tokenName: row.token_name,
    network: row.network,
    rugType: row.rug_type,
    severity: row.severity,
    originalPrice: row.original_price,
    currentPrice: row.current_price,
    priceDropPercent: row.price_drop_percent,
    originalLiquidity: row.original_liquidity,
    currentLiquidity: row.current_liquidity,
    liquidityDropPercent: row.liquidity_drop_percent,
    indicators: row.indicators,
    originalScore: row.original_score,
    originalAnalyzedAt: row.original_analyzed_at,
    wePredictedIt: row.we_predicted_it,
    detectedAt: row.detected_at,
    postedAt: row.posted_at,
    postHash: row.post_hash,
  }));
}

/**
 * Get tracking stats
 */
export async function getTrackingStats(env: Env): Promise<{
  totalTracked: number;
  activeTokens: number;
  suspiciousTokens: number;
  ruggedTokens: number;
  predictionAccuracy: number;
}> {
  const supabase = getSupabase(env);

  const { data: stats } = await supabase
    .from('tracked_tokens')
    .select('status, original_score');

  if (!stats) {
    return {
      totalTracked: 0,
      activeTokens: 0,
      suspiciousTokens: 0,
      ruggedTokens: 0,
      predictionAccuracy: 0,
    };
  }

  const totalTracked = stats.length;
  const activeTokens = stats.filter(s => s.status === 'active').length;
  const suspiciousTokens = stats.filter(s => s.status === 'suspicious').length;
  const ruggedTokens = stats.filter(s => s.status === 'rugged').length;

  // Calculate prediction accuracy (did we flag rugged tokens as risky?)
  const ruggedWithLowScore = stats.filter(
    s => s.status === 'rugged' && s.original_score < 50
  ).length;
  const predictionAccuracy = ruggedTokens > 0
    ? (ruggedWithLowScore / ruggedTokens) * 100
    : 100;

  return {
    totalTracked,
    activeTokens,
    suspiciousTokens,
    ruggedTokens,
    predictionAccuracy,
  };
}
