import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { StakingTier } from './staking-tiers';

export interface ApiCallRecord {
  timestamp: number;
  endpoint: string;
  method: string;
  wallet?: string;
  ip?: string;
  tier: StakingTier;
  paidWithTx?: string;
  responseStatus: number;
  responseTimeMs: number;
}

export interface UsageStats {
  totalCalls: number;
  callsByTier: Record<StakingTier, number>;
  callsByEndpoint: Record<string, number>;
  paidCalls: number;
  revenueUsdc: number;
  uniqueWallets: number;
  uniqueIps: number;
  avgResponseTimeMs: number;
}

export interface WalletUsage {
  wallet: string;
  tier: StakingTier;
  totalCalls: number;
  paidCalls: number;
  lastCall: number;
  endpoints: Record<string, number>;
}

// In-memory storage for fast access (real-time stats)
const callHistory: ApiCallRecord[] = [];
const walletUsage = new Map<string, WalletUsage>();
const MAX_HISTORY = 10000; // Keep last 10k calls in memory

// Price per call in USDC
const PRICE_PER_CALL_USDC = 0.01;

// Supabase client (lazy init)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return null;
  }

  supabase = createClient(url, key);
  return supabase;
}

/**
 * Persist record to Supabase (async, non-blocking)
 */
async function persistToSupabase(record: ApiCallRecord): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('api_calls').insert({
      timestamp: new Date(record.timestamp).toISOString(),
      endpoint: record.endpoint,
      method: record.method,
      wallet: record.wallet?.toLowerCase(),
      ip: record.ip,
      tier: record.tier,
      paid_tx: record.paidWithTx,
      response_status: record.responseStatus,
      response_time_ms: record.responseTimeMs,
    });

    if (error) {
      console.error('Failed to persist API call:', error.message);
    }
  } catch (err) {
    console.error('Supabase persist error:', err);
  }
}

/**
 * Track an API call (in-memory + async persist)
 */
export function trackApiCall(record: ApiCallRecord): void {
  // Add to in-memory history (FIFO)
  callHistory.push(record);
  if (callHistory.length > MAX_HISTORY) {
    callHistory.shift();
  }

  // Update wallet usage if wallet provided
  if (record.wallet) {
    const walletKey = record.wallet.toLowerCase();
    const existing = walletUsage.get(walletKey);
    if (existing) {
      existing.totalCalls++;
      existing.tier = record.tier;
      existing.lastCall = record.timestamp;
      if (record.paidWithTx) existing.paidCalls++;
      existing.endpoints[record.endpoint] = (existing.endpoints[record.endpoint] || 0) + 1;
    } else {
      walletUsage.set(walletKey, {
        wallet: walletKey,
        tier: record.tier,
        totalCalls: 1,
        paidCalls: record.paidWithTx ? 1 : 0,
        lastCall: record.timestamp,
        endpoints: { [record.endpoint]: 1 },
      });
    }
  }

  // Async persist to Supabase (non-blocking)
  persistToSupabase(record).catch(() => {});
}

/**
 * Get aggregate usage stats (from memory)
 */
export function getUsageStats(since?: number): UsageStats {
  const cutoff = since || 0;
  const relevantCalls = callHistory.filter(c => c.timestamp >= cutoff);

  const callsByTier: Record<StakingTier, number> = {
    FREE: 0,
    BUILDER: 0,
    PRO: 0,
    ELITE: 0,
  };

  const callsByEndpoint: Record<string, number> = {};
  const uniqueWallets = new Set<string>();
  const uniqueIps = new Set<string>();
  let paidCalls = 0;
  let totalResponseTime = 0;

  for (const call of relevantCalls) {
    callsByTier[call.tier]++;
    callsByEndpoint[call.endpoint] = (callsByEndpoint[call.endpoint] || 0) + 1;
    if (call.wallet) uniqueWallets.add(call.wallet);
    if (call.ip) uniqueIps.add(call.ip);
    if (call.paidWithTx) paidCalls++;
    totalResponseTime += call.responseTimeMs;
  }

  return {
    totalCalls: relevantCalls.length,
    callsByTier,
    callsByEndpoint,
    paidCalls,
    revenueUsdc: paidCalls * PRICE_PER_CALL_USDC,
    uniqueWallets: uniqueWallets.size,
    uniqueIps: uniqueIps.size,
    avgResponseTimeMs: relevantCalls.length > 0
      ? Math.round(totalResponseTime / relevantCalls.length)
      : 0,
  };
}

/**
 * Get usage for a specific wallet (from memory)
 */
export function getWalletUsage(wallet: string): WalletUsage | null {
  return walletUsage.get(wallet.toLowerCase()) || null;
}

/**
 * Get top wallets by usage (from memory)
 */
export function getTopWallets(limit = 10): WalletUsage[] {
  return Array.from(walletUsage.values())
    .sort((a, b) => b.totalCalls - a.totalCalls)
    .slice(0, limit);
}

/**
 * Get recent calls (from memory)
 */
export function getRecentCalls(limit = 100): ApiCallRecord[] {
  return callHistory.slice(-limit).reverse();
}

/**
 * Get calls in time range (from memory)
 */
export function getCallsInRange(startTime: number, endTime: number): ApiCallRecord[] {
  return callHistory.filter(c => c.timestamp >= startTime && c.timestamp <= endTime);
}

/**
 * Get hourly stats for the last 24 hours (from memory)
 */
export function getHourlyStats(): { hour: number; calls: number; paid: number }[] {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const stats: { hour: number; calls: number; paid: number }[] = [];

  for (let i = 23; i >= 0; i--) {
    const hourStart = now - (i + 1) * hourMs;
    const hourEnd = now - i * hourMs;
    const hourCalls = callHistory.filter(c => c.timestamp >= hourStart && c.timestamp < hourEnd);

    stats.push({
      hour: 23 - i,
      calls: hourCalls.length,
      paid: hourCalls.filter(c => c.paidWithTx).length,
    });
  }

  return stats;
}

/**
 * Get historical stats from Supabase (for longer time ranges)
 */
export async function getHistoricalStats(days = 30): Promise<UsageStats | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await client
      .from('api_calls')
      .select('tier, endpoint, wallet, ip, paid_tx, response_time_ms')
      .gte('timestamp', since);

    if (error || !data) return null;

    const callsByTier: Record<StakingTier, number> = {
      FREE: 0,
      BUILDER: 0,
      PRO: 0,
      ELITE: 0,
    };

    const callsByEndpoint: Record<string, number> = {};
    const uniqueWallets = new Set<string>();
    const uniqueIps = new Set<string>();
    let paidCalls = 0;
    let totalResponseTime = 0;

    for (const row of data) {
      const tier = row.tier as StakingTier;
      if (callsByTier[tier] !== undefined) callsByTier[tier]++;
      callsByEndpoint[row.endpoint] = (callsByEndpoint[row.endpoint] || 0) + 1;
      if (row.wallet) uniqueWallets.add(row.wallet);
      if (row.ip) uniqueIps.add(row.ip);
      if (row.paid_tx) paidCalls++;
      totalResponseTime += row.response_time_ms || 0;
    }

    return {
      totalCalls: data.length,
      callsByTier,
      callsByEndpoint,
      paidCalls,
      revenueUsdc: paidCalls * PRICE_PER_CALL_USDC,
      uniqueWallets: uniqueWallets.size,
      uniqueIps: uniqueIps.size,
      avgResponseTimeMs: data.length > 0
        ? Math.round(totalResponseTime / data.length)
        : 0,
    };
  } catch (err) {
    console.error('Failed to get historical stats:', err);
    return null;
  }
}

/**
 * Get wallet stats from Supabase (historical)
 */
export async function getWalletHistoricalStats(wallet: string): Promise<WalletUsage | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('api_calls')
      .select('tier, endpoint, paid_tx, timestamp')
      .eq('wallet', wallet.toLowerCase())
      .order('timestamp', { ascending: false });

    if (error || !data || data.length === 0) return null;

    const endpoints: Record<string, number> = {};
    let paidCalls = 0;

    for (const row of data) {
      endpoints[row.endpoint] = (endpoints[row.endpoint] || 0) + 1;
      if (row.paid_tx) paidCalls++;
    }

    return {
      wallet: wallet.toLowerCase(),
      tier: data[0].tier as StakingTier,
      totalCalls: data.length,
      paidCalls,
      lastCall: new Date(data[0].timestamp).getTime(),
      endpoints,
    };
  } catch (err) {
    console.error('Failed to get wallet historical stats:', err);
    return null;
  }
}

/**
 * Prune old records from memory
 */
export function pruneOldRecords(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  const initialLength = callHistory.length;

  while (callHistory.length > 0 && callHistory[0].timestamp < cutoff) {
    callHistory.shift();
  }

  return initialLength - callHistory.length;
}

/**
 * Cleanup old Supabase records (call via cron)
 */
export async function cleanupSupabaseRecords(daysToKeep = 90): Promise<number> {
  const client = getSupabase();
  if (!client) return 0;

  try {
    const { data, error } = await client.rpc('cleanup_old_api_calls', {
      days_to_keep: daysToKeep,
    });

    if (error) {
      console.error('Supabase cleanup error:', error.message);
      return 0;
    }

    return data || 0;
  } catch (err) {
    console.error('Cleanup failed:', err);
    return 0;
  }
}
