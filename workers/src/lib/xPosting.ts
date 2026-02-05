/**
 * X (Twitter) Posting Strategy
 *
 * Cost-conscious posting to X at $0.02/post.
 * Only posts high-value content:
 * - Daily builder digest (1x/day)
 * - Rug alerts (critical severity only)
 *
 * Skips low-value posts like GM/GN to conserve budget.
 */

import { Env } from './types';
import { postToX } from './social';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cost per post in USD
const COST_PER_POST = 0.02;

// Daily budget limit (posts per day)
const DAILY_POST_LIMIT = 5; // Max $0.10/day

// Types
export interface XPostRecord {
  id: string;
  text: string;
  postType: 'digest' | 'rug_alert' | 'manual' | 'announcement';
  tweetId?: string;
  tweetUrl?: string;
  cost: number;
  postedAt: string;
  success: boolean;
  error?: string;
}

export interface XPostingStats {
  todayPosts: number;
  todayCost: number;
  remainingBudget: number;
  totalPosts: number;
  totalCost: number;
}

// Get Supabase client
function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

/**
 * Check if we can post to X today (under daily limit)
 */
export async function canPostToX(env: Env): Promise<{ allowed: boolean; reason?: string; stats: XPostingStats }> {
  const supabase = getSupabase(env);
  const today = new Date().toISOString().split('T')[0];

  // Get today's posts
  const { data: todayPosts, error } = await supabase
    .from('x_posts')
    .select('*')
    .gte('posted_at', `${today}T00:00:00Z`)
    .lt('posted_at', `${today}T23:59:59Z`);

  if (error) {
    console.error('Error checking X post limit:', error);
    // Allow posting if we can't check (fail open for now)
    return {
      allowed: true,
      stats: {
        todayPosts: 0,
        todayCost: 0,
        remainingBudget: DAILY_POST_LIMIT * COST_PER_POST,
        totalPosts: 0,
        totalCost: 0,
      },
    };
  }

  const successfulPosts = (todayPosts || []).filter(p => p.success);
  const todayCount = successfulPosts.length;
  const todayCost = todayCount * COST_PER_POST;

  // Get total stats
  const { data: allPosts } = await supabase
    .from('x_posts')
    .select('success')
    .eq('success', true);

  const totalPosts = allPosts?.length || 0;
  const totalCost = totalPosts * COST_PER_POST;

  const stats: XPostingStats = {
    todayPosts: todayCount,
    todayCost,
    remainingBudget: (DAILY_POST_LIMIT - todayCount) * COST_PER_POST,
    totalPosts,
    totalCost,
  };

  if (todayCount >= DAILY_POST_LIMIT) {
    return {
      allowed: false,
      reason: `Daily limit reached (${todayCount}/${DAILY_POST_LIMIT} posts, $${todayCost.toFixed(2)} spent)`,
      stats,
    };
  }

  return { allowed: true, stats };
}

/**
 * Post to X with cost tracking
 */
async function postToXWithTracking(
  env: Env,
  text: string,
  postType: XPostRecord['postType']
): Promise<{ success: boolean; tweetUrl?: string; cost: number; error?: string }> {
  const supabase = getSupabase(env);

  // Check if we can post
  const { allowed, reason, stats } = await canPostToX(env);
  if (!allowed) {
    console.log(`X posting blocked: ${reason}`);
    return { success: false, cost: 0, error: reason };
  }

  // Post to X
  const result = await postToX(env, text, { skipHashtags: false });

  // Record the post attempt
  const record: Partial<XPostRecord> = {
    id: `xpost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: text.slice(0, 500),
    postType,
    tweetId: result.postId,
    tweetUrl: result.url,
    cost: result.success ? COST_PER_POST : 0,
    postedAt: new Date().toISOString(),
    success: result.success,
    error: result.error,
  };

  await supabase.from('x_posts').insert({
    id: record.id,
    text: record.text,
    post_type: record.postType,
    tweet_id: record.tweetId,
    tweet_url: record.tweetUrl,
    cost: record.cost,
    posted_at: record.postedAt,
    success: record.success,
    error: record.error,
  });

  if (result.success) {
    console.log(`Posted to X (${postType}): ${result.url} - Cost: $${COST_PER_POST}`);
    console.log(`Today's X stats: ${stats.todayPosts + 1}/${DAILY_POST_LIMIT} posts, $${(stats.todayCost + COST_PER_POST).toFixed(2)} spent`);
  }

  return {
    success: result.success,
    tweetUrl: result.url,
    cost: result.success ? COST_PER_POST : 0,
    error: result.error,
  };
}

/**
 * Post daily builder digest to X
 * Condensed version optimized for Twitter's 280 char limit
 */
export async function postDigestToX(
  env: Env,
  shippedCount: number,
  topBuilders: string[],
  topTopics: string[]
): Promise<{ success: boolean; tweetUrl?: string; cost: number; error?: string }> {
  // Build a concise digest for X
  const builders = topBuilders.slice(0, 3).map(b => `@${b}`).join(' ');
  const topics = topTopics.slice(0, 3).join(' ');

  let text = `Daily Builder Digest\n\n`;
  text += `${shippedCount} projects shipped today\n\n`;

  if (builders) {
    text += `Top builders: ${builders}\n`;
  }

  if (topics) {
    text += `Trending: ${topics}\n`;
  }

  text += `\nBuilding in public on Farcaster`;

  // Ensure under 280 chars
  if (text.length > 280) {
    text = text.slice(0, 277) + '...';
  }

  return postToXWithTracking(env, text, 'digest');
}

/**
 * Post rug alert to X (critical severity only)
 */
export async function postRugAlertToX(
  env: Env,
  tokenSymbol: string,
  rugType: string,
  priceDropPercent: number,
  wePredictedIt: boolean
): Promise<{ success: boolean; tweetUrl?: string; cost: number; error?: string }> {
  let text = `RUG ALERT: $${tokenSymbol}\n\n`;
  text += `${rugType.replace('_', ' ')} detected\n`;
  text += `Price dropped ${priceDropPercent.toFixed(0)}%\n\n`;

  if (wePredictedIt) {
    text += `We flagged this one as risky.\n`;
  }

  text += `DYOR always. Stay safe.`;

  return postToXWithTracking(env, text, 'rug_alert');
}

/**
 * Post manual announcement to X
 */
export async function postAnnouncementToX(
  env: Env,
  text: string
): Promise<{ success: boolean; tweetUrl?: string; cost: number; error?: string }> {
  return postToXWithTracking(env, text, 'announcement');
}

/**
 * Get X posting statistics
 */
export async function getXPostingStats(env: Env): Promise<XPostingStats> {
  const { stats } = await canPostToX(env);
  return stats;
}

/**
 * Get recent X posts
 */
export async function getRecentXPosts(env: Env, limit: number = 20): Promise<XPostRecord[]> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('x_posts')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('Error fetching X posts:', error);
    return [];
  }

  return data.map(row => ({
    id: row.id,
    text: row.text,
    postType: row.post_type,
    tweetId: row.tweet_id,
    tweetUrl: row.tweet_url,
    cost: row.cost,
    postedAt: row.posted_at,
    success: row.success,
    error: row.error,
  }));
}
