/**
 * Cast Analytics - Track Fixr's cast performance over time
 *
 * Stores engagement metrics (likes, recasts, replies) for Fixr's posts
 * to learn what content resonates with the audience.
 */

import { Env } from './types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export interface CastAnalytics {
  hash: string;
  text: string;
  castType: 'digest' | 'analysis' | 'reply' | 'daily_report' | 'follow_notification' | 'incident' | 'other';
  postedAt: string;
  likes: number;
  recasts: number;
  replies: number;
  parentHash?: string;
  channelId?: string;
  // Metadata about what the cast was about
  metadata?: {
    tokenAddress?: string;
    tokenSymbol?: string;
    builderFid?: number;
    reportType?: string;
  };
  // Timestamps for tracking
  lastUpdated: string;
  createdAt: string;
}

export interface CastPerformance {
  totalCasts: number;
  totalLikes: number;
  totalRecasts: number;
  totalReplies: number;
  avgLikes: number;
  avgRecasts: number;
  avgReplies: number;
  topCasts: CastAnalytics[];
  performanceByType: Record<string, {
    count: number;
    avgLikes: number;
    avgRecasts: number;
    avgReplies: number;
  }>;
}

// Get Supabase client
function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

/**
 * Save a new cast to analytics
 */
export async function trackCast(
  env: Env,
  hash: string,
  text: string,
  castType: CastAnalytics['castType'],
  options?: {
    parentHash?: string;
    channelId?: string;
    metadata?: CastAnalytics['metadata'];
  }
): Promise<void> {
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  const { error } = await supabase.from('fixr_cast_analytics').upsert({
    hash,
    text: text.slice(0, 1000), // Limit text length
    cast_type: castType,
    posted_at: now,
    likes: 0,
    recasts: 0,
    replies: 0,
    parent_hash: options?.parentHash,
    channel_id: options?.channelId,
    metadata: options?.metadata || {},
    last_updated: now,
    created_at: now,
  }, {
    onConflict: 'hash',
  });

  if (error) {
    console.error('Failed to track cast:', error);
  }
}

/**
 * Update engagement metrics for a cast
 */
export async function updateCastEngagement(
  env: Env,
  hash: string,
  engagement: { likes: number; recasts: number; replies: number }
): Promise<void> {
  const supabase = getSupabase(env);

  const { error } = await supabase
    .from('fixr_cast_analytics')
    .update({
      likes: engagement.likes,
      recasts: engagement.recasts,
      replies: engagement.replies,
      last_updated: new Date().toISOString(),
    })
    .eq('hash', hash);

  if (error) {
    console.error('Failed to update cast engagement:', error);
  }
}

/**
 * Fetch engagement for a cast from Neynar
 */
export async function fetchCastEngagement(
  env: Env,
  hash: string
): Promise<{ likes: number; recasts: number; replies: number } | null> {
  if (!env.NEYNAR_API_KEY) return null;

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`,
      {
        headers: {
          'accept': 'application/json',
          'api_key': env.NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      cast?: {
        reactions?: { likes_count?: number; recasts_count?: number };
        replies?: { count?: number };
      };
    };

    return {
      likes: data.cast?.reactions?.likes_count || 0,
      recasts: data.cast?.reactions?.recasts_count || 0,
      replies: data.cast?.replies?.count || 0,
    };
  } catch (error) {
    console.error('Error fetching cast engagement:', error);
    return null;
  }
}

/**
 * Update engagement for all recent casts (call periodically)
 */
export async function refreshRecentCastEngagement(
  env: Env,
  hoursBack: number = 72
): Promise<{ updated: number; errors: number }> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  // Get recent casts
  const { data: casts, error } = await supabase
    .from('fixr_cast_analytics')
    .select('hash')
    .gte('posted_at', cutoff)
    .order('posted_at', { ascending: false })
    .limit(50);

  if (error || !casts) {
    console.error('Failed to fetch recent casts:', error);
    return { updated: 0, errors: 1 };
  }

  let updated = 0;
  let errors = 0;

  for (const cast of casts) {
    const engagement = await fetchCastEngagement(env, cast.hash);
    if (engagement) {
      await updateCastEngagement(env, cast.hash, engagement);
      updated++;
    } else {
      errors++;
    }
    // Rate limit: 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Refreshed engagement for ${updated} casts (${errors} errors)`);
  return { updated, errors };
}

/**
 * Get overall performance metrics
 */
export async function getCastPerformance(
  env: Env,
  daysBack: number = 30
): Promise<CastPerformance> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const { data: casts, error } = await supabase
    .from('fixr_cast_analytics')
    .select('*')
    .gte('posted_at', cutoff)
    .order('posted_at', { ascending: false });

  if (error || !casts || casts.length === 0) {
    return {
      totalCasts: 0,
      totalLikes: 0,
      totalRecasts: 0,
      totalReplies: 0,
      avgLikes: 0,
      avgRecasts: 0,
      avgReplies: 0,
      topCasts: [],
      performanceByType: {},
    };
  }

  // Calculate totals
  const totalLikes = casts.reduce((sum, c) => sum + (c.likes || 0), 0);
  const totalRecasts = casts.reduce((sum, c) => sum + (c.recasts || 0), 0);
  const totalReplies = casts.reduce((sum, c) => sum + (c.replies || 0), 0);

  // Group by type
  const byType: Record<string, CastAnalytics[]> = {};
  for (const cast of casts) {
    const type = cast.cast_type || 'other';
    if (!byType[type]) byType[type] = [];
    byType[type].push({
      hash: cast.hash,
      text: cast.text,
      castType: cast.cast_type,
      postedAt: cast.posted_at,
      likes: cast.likes || 0,
      recasts: cast.recasts || 0,
      replies: cast.replies || 0,
      parentHash: cast.parent_hash,
      channelId: cast.channel_id,
      metadata: cast.metadata,
      lastUpdated: cast.last_updated,
      createdAt: cast.created_at,
    });
  }

  const performanceByType: CastPerformance['performanceByType'] = {};
  for (const [type, typeCasts] of Object.entries(byType)) {
    const count = typeCasts.length;
    performanceByType[type] = {
      count,
      avgLikes: typeCasts.reduce((sum, c) => sum + c.likes, 0) / count,
      avgRecasts: typeCasts.reduce((sum, c) => sum + c.recasts, 0) / count,
      avgReplies: typeCasts.reduce((sum, c) => sum + c.replies, 0) / count,
    };
  }

  // Top casts by total engagement
  const topCasts = casts
    .map(c => ({
      hash: c.hash,
      text: c.text,
      castType: c.cast_type as CastAnalytics['castType'],
      postedAt: c.posted_at,
      likes: c.likes || 0,
      recasts: c.recasts || 0,
      replies: c.replies || 0,
      parentHash: c.parent_hash,
      channelId: c.channel_id,
      metadata: c.metadata,
      lastUpdated: c.last_updated,
      createdAt: c.created_at,
    }))
    .sort((a, b) => (b.likes + b.recasts + b.replies) - (a.likes + a.recasts + a.replies))
    .slice(0, 10);

  return {
    totalCasts: casts.length,
    totalLikes,
    totalRecasts,
    totalReplies,
    avgLikes: totalLikes / casts.length,
    avgRecasts: totalRecasts / casts.length,
    avgReplies: totalReplies / casts.length,
    topCasts,
    performanceByType,
  };
}

/**
 * Get best performing content type
 */
export async function getBestContentType(
  env: Env,
  daysBack: number = 30
): Promise<{ type: string; avgEngagement: number } | null> {
  const performance = await getCastPerformance(env, daysBack);

  if (Object.keys(performance.performanceByType).length === 0) {
    return null;
  }

  let bestType = '';
  let bestAvg = 0;

  for (const [type, stats] of Object.entries(performance.performanceByType)) {
    const avgEngagement = stats.avgLikes + stats.avgRecasts + stats.avgReplies;
    if (avgEngagement > bestAvg) {
      bestAvg = avgEngagement;
      bestType = type;
    }
  }

  return { type: bestType, avgEngagement: bestAvg };
}
