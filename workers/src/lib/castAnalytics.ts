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

// ============ Content Performance Analysis (Phase 4) ============

import { addLesson } from './skills';
import { recordOutcome } from './outcomes';

interface PerformanceReport {
  analyzed: number;
  lessonsAdded: number;
  bestType: { type: string; avgEngagement: number } | null;
  bestChannel: { channel: string; avgEngagement: number } | null;
  bestLengthRange: { range: string; avgEngagement: number } | null;
  bestTimeOfDay: { hour: number; avgEngagement: number } | null;
}

/**
 * Analyze content performance and store insights as skill lessons.
 * Called after cast engagement refresh to extract actionable patterns.
 */
export async function analyzeContentPerformance(env: Env): Promise<PerformanceReport> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: casts, error } = await supabase
    .from('fixr_cast_analytics')
    .select('*')
    .gte('posted_at', cutoff)
    .order('posted_at', { ascending: false });

  if (error || !casts || casts.length === 0) {
    return { analyzed: 0, lessonsAdded: 0, bestType: null, bestChannel: null, bestLengthRange: null, bestTimeOfDay: null };
  }

  let lessonsAdded = 0;

  // --- Best content type ---
  const byType: Record<string, { total: number; engagement: number }> = {};
  for (const c of casts) {
    const t = c.cast_type || 'other';
    if (!byType[t]) byType[t] = { total: 0, engagement: 0 };
    byType[t].total++;
    byType[t].engagement += (c.likes || 0) + (c.recasts || 0) + (c.replies || 0);
  }
  let bestType: PerformanceReport['bestType'] = null;
  for (const [type, stats] of Object.entries(byType)) {
    if (stats.total < 2) continue; // Need at least 2 samples
    const avg = stats.engagement / stats.total;
    if (!bestType || avg > bestType.avgEngagement) {
      bestType = { type, avgEngagement: Math.round(avg * 10) / 10 };
    }
  }
  if (bestType && bestType.avgEngagement > 0) {
    const lesson = `Best performing content type: "${bestType.type}" with avg ${bestType.avgEngagement} engagement per post`;
    if (await addLesson(env, 'farcaster_post', lesson, 'engagement_analysis')) lessonsAdded++;
  }

  // --- Best channel ---
  const byChannel: Record<string, { total: number; engagement: number }> = {};
  for (const c of casts) {
    const ch = c.channel_id || 'no-channel';
    if (!byChannel[ch]) byChannel[ch] = { total: 0, engagement: 0 };
    byChannel[ch].total++;
    byChannel[ch].engagement += (c.likes || 0) + (c.recasts || 0) + (c.replies || 0);
  }
  let bestChannel: PerformanceReport['bestChannel'] = null;
  for (const [channel, stats] of Object.entries(byChannel)) {
    if (stats.total < 2) continue;
    const avg = stats.engagement / stats.total;
    if (!bestChannel || avg > bestChannel.avgEngagement) {
      bestChannel = { channel, avgEngagement: Math.round(avg * 10) / 10 };
    }
  }
  if (bestChannel && bestChannel.channel !== 'no-channel' && bestChannel.avgEngagement > 0) {
    const lesson = `Best performing channel: "${bestChannel.channel}" with avg ${bestChannel.avgEngagement} engagement`;
    if (await addLesson(env, 'farcaster_post', lesson, 'engagement_analysis')) lessonsAdded++;
  }

  // --- Best post length range ---
  const byLength: Record<string, { total: number; engagement: number }> = {};
  for (const c of casts) {
    const len = (c.text || '').length;
    const range = len < 100 ? 'short (<100)' : len < 300 ? 'medium (100-300)' : len < 600 ? 'long (300-600)' : 'very long (600+)';
    if (!byLength[range]) byLength[range] = { total: 0, engagement: 0 };
    byLength[range].total++;
    byLength[range].engagement += (c.likes || 0) + (c.recasts || 0) + (c.replies || 0);
  }
  let bestLengthRange: PerformanceReport['bestLengthRange'] = null;
  for (const [range, stats] of Object.entries(byLength)) {
    if (stats.total < 2) continue;
    const avg = stats.engagement / stats.total;
    if (!bestLengthRange || avg > bestLengthRange.avgEngagement) {
      bestLengthRange = { range, avgEngagement: Math.round(avg * 10) / 10 };
    }
  }
  if (bestLengthRange && bestLengthRange.avgEngagement > 0) {
    const lesson = `Best performing post length: ${bestLengthRange.range} chars with avg ${bestLengthRange.avgEngagement} engagement`;
    if (await addLesson(env, 'farcaster_post', lesson, 'engagement_analysis')) lessonsAdded++;
  }

  // --- Best time of day ---
  const byHour: Record<number, { total: number; engagement: number }> = {};
  for (const c of casts) {
    const hour = new Date(c.posted_at).getUTCHours();
    if (!byHour[hour]) byHour[hour] = { total: 0, engagement: 0 };
    byHour[hour].total++;
    byHour[hour].engagement += (c.likes || 0) + (c.recasts || 0) + (c.replies || 0);
  }
  let bestTimeOfDay: PerformanceReport['bestTimeOfDay'] = null;
  for (const [hourStr, stats] of Object.entries(byHour)) {
    if (stats.total < 2) continue;
    const avg = stats.engagement / stats.total;
    if (!bestTimeOfDay || avg > bestTimeOfDay.avgEngagement) {
      bestTimeOfDay = { hour: parseInt(hourStr, 10), avgEngagement: Math.round(avg * 10) / 10 };
    }
  }
  if (bestTimeOfDay && bestTimeOfDay.avgEngagement > 0) {
    const lesson = `Best posting time: ${bestTimeOfDay.hour}:00 UTC with avg ${bestTimeOfDay.avgEngagement} engagement`;
    if (await addLesson(env, 'farcaster_post', lesson, 'engagement_analysis')) lessonsAdded++;
  }

  console.log(`[CastAnalytics] Performance analysis: ${casts.length} casts, ${lessonsAdded} lessons added`);
  return { analyzed: casts.length, lessonsAdded, bestType, bestChannel, bestLengthRange, bestTimeOfDay };
}

/**
 * Get a compact posting context string for injection into content generation prompts.
 * Returns top-performing posts and engagement patterns.
 */
export async function getPostingContext(env: Env, daysBack: number = 30): Promise<string> {
  const performance = await getCastPerformance(env, daysBack);
  if (performance.totalCasts === 0) return '';

  let context = '## Content Performance Insights\n';

  // Top performing posts
  if (performance.topCasts.length > 0) {
    context += '\nYour top performing posts recently:\n';
    for (const cast of performance.topCasts.slice(0, 5)) {
      context += `- "${cast.text.slice(0, 80)}..." (${cast.likes} likes, ${cast.recasts} recasts, ${cast.replies} replies) [${cast.castType}]\n`;
    }
  }

  // Performance by type
  if (Object.keys(performance.performanceByType).length > 0) {
    context += '\nEngagement by content type:\n';
    const sorted = Object.entries(performance.performanceByType)
      .sort((a, b) =>
        (b[1].avgLikes + b[1].avgRecasts + b[1].avgReplies) -
        (a[1].avgLikes + a[1].avgRecasts + a[1].avgReplies)
      );
    for (const [type, stats] of sorted) {
      const avg = (stats.avgLikes + stats.avgRecasts + stats.avgReplies).toFixed(1);
      context += `- ${type}: avg ${avg} engagement (${stats.count} posts)\n`;
    }
  }

  // Overall stats
  context += `\nOverall: ${performance.totalCasts} posts, avg ${performance.avgLikes.toFixed(1)} likes, ${performance.avgRecasts.toFixed(1)} recasts, ${performance.avgReplies.toFixed(1)} replies\n`;

  return context;
}

/**
 * Record outcomes for posts that now have engagement data.
 * Updates the outcome_ledger with engagement metrics for previously posted casts.
 */
export async function recordPostEngagementOutcomes(env: Env): Promise<number> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - 72 * 3600000).toISOString(); // Last 72h

  const { data: casts, error } = await supabase
    .from('fixr_cast_analytics')
    .select('hash, cast_type, likes, recasts, replies, text')
    .gte('posted_at', cutoff)
    .gt('likes', 0); // Only posts with some engagement

  if (error || !casts) return 0;

  let recorded = 0;
  for (const cast of casts) {
    const engagement = (cast.likes || 0) + (cast.recasts || 0) + (cast.replies || 0);
    recordOutcome(env, {
      action_type: 'post',
      action_id: cast.hash,
      skill: 'farcaster_post',
      success: true,
      context: { castType: cast.cast_type, textLength: (cast.text || '').length },
      outcome: { likes: cast.likes, recasts: cast.recasts, replies: cast.replies, totalEngagement: engagement },
    }).catch(() => {}); // Fire and forget
    recorded++;
  }

  return recorded;
}
