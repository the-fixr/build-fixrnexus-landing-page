/**
 * Fixr Daily "What I Fixed" Auto-Posts
 * Generates and posts daily summaries of security audits and fixes
 */

import { Env } from './types';
import { postToFarcaster, postToX } from './social';
import { createClient } from '@supabase/supabase-js';

interface DailyStats {
  contractsAudited: number;
  issuesFound: number;
  criticalIssues: number;
  highIssues: number;
  conversationsHad: number;
  tokensAnalyzed: number;
  reposAnalyzed: number;
}

/**
 * Get daily stats from the last 24 hours
 */
async function getDailyStats(env: Env): Promise<DailyStats> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  const yesterdayISO = yesterday.toISOString();

  // Get conversations from last 24h
  const { data: conversations } = await supabase
    .from('conversations')
    .select('context, messages')
    .gte('updated_at', yesterdayISO);

  const stats: DailyStats = {
    contractsAudited: 0,
    issuesFound: 0,
    criticalIssues: 0,
    highIssues: 0,
    conversationsHad: 0,
    tokensAnalyzed: 0,
    reposAnalyzed: 0,
  };

  if (!conversations) return stats;

  for (const conv of conversations) {
    stats.conversationsHad++;

    const context = conv.context || {};

    // Count security audits
    if (context.securityAnalysis) {
      stats.contractsAudited++;
      const issues = context.securityAnalysis.issues || [];
      stats.issuesFound += issues.length;
      stats.criticalIssues += issues.filter(
        (i: { severity: string }) => i.severity === 'critical'
      ).length;
      stats.highIssues += issues.filter(
        (i: { severity: string }) => i.severity === 'high'
      ).length;
    }

    // Count token analyses
    if (context.tokenAnalysis) {
      stats.tokensAnalyzed++;
    }

    // Count repo analyses
    if (context.repoAnalysis) {
      stats.reposAnalyzed++;
    }
  }

  return stats;
}

/**
 * Generate the daily post text
 */
function generateDailyPost(stats: DailyStats): string | null {
  // Don't post if nothing happened
  if (
    stats.contractsAudited === 0 &&
    stats.tokensAnalyzed === 0 &&
    stats.reposAnalyzed === 0 &&
    stats.conversationsHad === 0
  ) {
    return null;
  }

  const lines: string[] = [];
  lines.push("fix'n shit report 🔧");
  lines.push('');

  // Lead with the most impressive stat
  if (stats.contractsAudited > 0) {
    lines.push(`🔍 audited ${stats.contractsAudited} contract${stats.contractsAudited > 1 ? 's' : ''}`);
    if (stats.issuesFound > 0) {
      const severity = stats.criticalIssues > 0 ? '🚨' : stats.highIssues > 0 ? '⚠️' : '📋';
      lines.push(`${severity} found ${stats.issuesFound} issue${stats.issuesFound > 1 ? 's' : ''}`);
      if (stats.criticalIssues > 0) {
        lines.push(`   ${stats.criticalIssues} critical`);
      }
    } else {
      lines.push('✅ no major issues found');
    }
  }

  if (stats.tokensAnalyzed > 0) {
    lines.push(`📊 analyzed ${stats.tokensAnalyzed} token${stats.tokensAnalyzed > 1 ? 's' : ''}`);
  }

  if (stats.reposAnalyzed > 0) {
    lines.push(`💻 reviewed ${stats.reposAnalyzed} repo${stats.reposAnalyzed > 1 ? 's' : ''}`);
  }

  if (stats.conversationsHad > stats.contractsAudited + stats.tokensAnalyzed + stats.reposAnalyzed) {
    const chatCount = stats.conversationsHad - stats.contractsAudited - stats.tokensAnalyzed - stats.reposAnalyzed;
    if (chatCount > 0) {
      lines.push(`💬 ${chatCount} other conversation${chatCount > 1 ? 's' : ''}`);
    }
  }

  lines.push('');

  // Vary the call-to-action, sometimes mentioning Shipyard
  const ctas = [
    'drop a contract address anytime - i got you',
    'need a scan? drop an address or check shipyard.fixr.nexus',
    'want more? scan tokens on Shipyard → shipyard.fixr.nexus',
    'drop a contract or check Shipyard for trending builders',
  ];
  lines.push(ctas[Math.floor(Math.random() * ctas.length)]);

  return lines.join('\n');
}

/**
 * Post daily summary to social platforms
 */
// In-memory fallback cache for deduplication when database is unavailable
// This persists across requests within the same worker instance
const memoryCache = new Map<string, number>(); // postType -> timestamp of last post

/**
 * Get today's date key in format YYYY-MM-DD
 */
function getTodayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Check if we already posted today (deduplication for cron-triggered posts)
 * Uses database with in-memory fallback for reliability
 */
export async function hasPostedToday(env: Env, postType: string): Promise<boolean> {
  const today = getTodayKey();
  const cacheKey = `${postType}:${today}`;

  // First check in-memory cache (fastest)
  if (memoryCache.has(cacheKey)) {
    console.log(`[Dedup] hasPostedToday(${postType}): true (memory cache)`);
    return true;
  }

  // Then try database
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data, error } = await supabase
      .from('daily_posts')
      .select('id')
      .eq('post_type', postType)
      .gte('created_at', todayISO)
      .limit(1);

    if (error) {
      console.error(`[Dedup] hasPostedToday DB error for ${postType}:`, error.message);
      // Database failed, rely on memory cache only (which returned false above)
      return false;
    }

    const hasPosted = (data?.length ?? 0) > 0;
    if (hasPosted) {
      // Update memory cache from database
      memoryCache.set(cacheKey, Date.now());
    }
    console.log(`[Dedup] hasPostedToday(${postType}): ${hasPosted} (database)`);
    return hasPosted;
  } catch (err) {
    console.error(`[Dedup] hasPostedToday exception for ${postType}:`, err);
    return false; // On error, allow the post
  }
}

/**
 * Record that we made a daily post (deduplication for cron-triggered posts)
 * Records to both database and in-memory cache for reliability
 */
export async function recordDailyPost(env: Env, postType: string, castHash?: string): Promise<void> {
  const today = getTodayKey();
  const cacheKey = `${postType}:${today}`;

  // Always update memory cache first (for immediate deduplication)
  memoryCache.set(cacheKey, Date.now());
  console.log(`[Dedup] Recorded ${postType} to memory cache`);

  // Then try to record in database
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { error } = await supabase.from('daily_posts').insert({
      post_type: postType,
      cast_hash: castHash,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`[Dedup] recordDailyPost DB error for ${postType}:`, error.message);
      // Database failed, but memory cache is set so future calls within this instance will be deduplicated
    } else {
      console.log(`[Dedup] Recorded ${postType} to database`);
    }
  } catch (err) {
    console.error(`[Dedup] recordDailyPost exception for ${postType}:`, err);
  }
}

/**
 * Clean up old entries from memory cache (call periodically)
 */
export function cleanupMemoryCache(): void {
  const today = getTodayKey();
  for (const key of memoryCache.keys()) {
    if (!key.endsWith(today)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Generate a content hash for deduplication
 * Uses first 100 chars + length to create a simple fingerprint
 */
function generateContentHash(content: string): string {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ');
  const prefix = normalized.slice(0, 100);
  return `${prefix.length}_${normalized.length}_${prefix.slice(0, 32)}`;
}

// Content cache for deduplication (platform:hash -> timestamp)
const contentCache = new Map<string, number>();

/**
 * Check if content has already been posted to a platform today
 * Prevents duplicate posts of the same content
 */
export async function hasPostedContent(
  env: Env,
  platform: 'farcaster' | 'x' | 'lens' | 'bluesky' | 'clanker_news',
  content: string
): Promise<boolean> {
  const today = getTodayKey();
  const contentHash = generateContentHash(content);
  const cacheKey = `content:${platform}:${contentHash}:${today}`;

  // Check in-memory cache first
  if (contentCache.has(cacheKey)) {
    console.log(`[Dedup] Content already posted to ${platform} (memory cache)`);
    return true;
  }

  // Check database
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('daily_posts')
      .select('id')
      .eq('post_type', `${platform}_content`)
      .eq('content_hash', contentHash)
      .gte('created_at', todayStart.toISOString())
      .limit(1);

    if (error) {
      console.error(`[Dedup] Content check DB error for ${platform}:`, error.message);
      return false;
    }

    const hasPosted = (data?.length ?? 0) > 0;
    if (hasPosted) {
      contentCache.set(cacheKey, Date.now());
      console.log(`[Dedup] Content already posted to ${platform} (database)`);
    }
    return hasPosted;
  } catch (err) {
    console.error(`[Dedup] Content check exception for ${platform}:`, err);
    return false;
  }
}

/**
 * Record that content has been posted to a platform
 */
export async function recordPostedContent(
  env: Env,
  platform: 'farcaster' | 'x' | 'lens' | 'bluesky' | 'clanker_news',
  content: string,
  postId?: string
): Promise<void> {
  const today = getTodayKey();
  const contentHash = generateContentHash(content);
  const cacheKey = `content:${platform}:${contentHash}:${today}`;

  // Update memory cache
  contentCache.set(cacheKey, Date.now());
  console.log(`[Dedup] Recorded ${platform} content to memory cache`);

  // Record in database
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { error } = await supabase.from('daily_posts').insert({
      post_type: `${platform}_content`,
      content_hash: contentHash,
      cast_hash: postId,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`[Dedup] Record content DB error for ${platform}:`, error.message);
    } else {
      console.log(`[Dedup] Recorded ${platform} content to database`);
    }
  } catch (err) {
    console.error(`[Dedup] Record content exception for ${platform}:`, err);
  }
}

export async function postDailySummary(env: Env): Promise<{
  posted: boolean;
  farcaster?: { success: boolean; error?: string };
  x?: { success: boolean; error?: string };
}> {
  try {
    // Check if we already posted today (prevents duplicates from multiple cron triggers)
    const alreadyPosted = await hasPostedToday(env, 'daily_summary');
    if (alreadyPosted) {
      console.log('Daily post: Already posted today, skipping');
      return { posted: false };
    }

    const stats = await getDailyStats(env);
    const post = generateDailyPost(stats);

    if (!post) {
      console.log('Daily post: No activity to report');
      return { posted: false };
    }

    console.log('Daily post content:', post);

    // Post to both platforms
    const [farcasterResult, xResult] = await Promise.all([
      postToFarcaster(env, post),
      postToX(env, post),
    ]);

    console.log('Daily post results:', { farcaster: farcasterResult, x: xResult });

    // Record that we posted today (prevents duplicate posts from multiple cron triggers)
    if (farcasterResult.success || xResult.success) {
      await recordDailyPost(env, 'daily_summary', farcasterResult.postId);
    }

    return {
      posted: true,
      farcaster: {
        success: farcasterResult.success,
        error: farcasterResult.error,
      },
      x: {
        success: xResult.success,
        error: xResult.error,
      },
    };
  } catch (error) {
    console.error('Daily post error:', error);
    return { posted: false };
  }
}

/**
 * Generate a "shipped" post for completed work
 */
export function generateShippedPost(
  projectName: string,
  description: string,
  stats?: { issuesFixed?: number; gasOptimized?: boolean }
): string {
  const lines: string[] = [];

  lines.push(`shipped: ${projectName} 🚀`);
  lines.push('');
  lines.push(description);

  if (stats?.issuesFixed) {
    lines.push(`fixed ${stats.issuesFixed} security issue${stats.issuesFixed > 1 ? 's' : ''}`);
  }

  if (stats?.gasOptimized) {
    lines.push('⛽ gas optimized');
  }

  return lines.join('\n');
}

/**
 * Generate a "found a bug" post for interesting findings
 */
export function generateBugFoundPost(
  contractName: string,
  bugType: string,
  severity: 'critical' | 'high' | 'medium'
): string {
  const severityEmoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📋';

  return `${severityEmoji} found a ${severity} ${bugType} in ${contractName}

security researchers know what's up. dm for details.

audit your contracts before deploying. seriously.`;
}
