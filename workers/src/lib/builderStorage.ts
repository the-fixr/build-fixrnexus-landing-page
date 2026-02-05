/**
 * Builder Feed Storage - Supabase persistence for builder activity
 *
 * Tables:
 * - builder_casts: Individual casts from builder channels
 * - builder_digests: Daily digest summaries
 * - builder_profiles: Active builder profiles with accumulated stats
 * - builder_topics: Trending topic history
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from './types';
import { BuilderCast, BuilderDigest } from './builderFeed';

// Get Supabase client
function getSupabase(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

// ============================================================================
// Types for Stored Data
// ============================================================================

export interface StoredBuilderCast {
  hash: string;
  text: string;
  author_fid: number;
  author_username: string;
  author_display_name: string;
  author_follower_count: number;
  author_pfp_url?: string;
  channel: string;
  timestamp: string;
  likes: number;
  recasts: number;
  embeds: string[]; // JSON array of URLs
  parent_hash?: string;
  category: 'shipped' | 'insight' | 'discussion';
  topics: string[]; // Extracted topics
  created_at: string;
}

export interface StoredBuilderDigest {
  id: string;
  date: string;
  shipped_count: number;
  insights_count: number;
  discussions_count: number;
  top_shipped_hashes: string[];
  top_insight_hashes: string[];
  top_discussion_hashes: string[];
  active_builders: Array<{
    fid: number;
    username: string;
    displayName: string;
    postCount: number;
    totalEngagement: number;
  }>;
  trending_topics: Array<{
    topic: string;
    mentions: number;
  }>;
  summary: string;
  post_hash?: string; // Farcaster post hash if posted
  created_at: string;
}

export interface StoredBuilderProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url?: string;
  follower_count: number;
  total_casts: number;
  shipped_count: number;
  insight_count: number;
  total_engagement: number;
  first_seen: string;
  last_seen: string;
  top_topics: string[];
  updated_at: string;
}

// ============================================================================
// Cast Storage
// ============================================================================

/**
 * Save casts to Supabase (upsert to handle duplicates)
 */
export async function saveCasts(env: Env, casts: BuilderCast[]): Promise<number> {
  if (casts.length === 0) return 0;

  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  // Extract topics for each cast
  const castsWithTopics = casts.map(cast => ({
    hash: cast.hash,
    text: cast.text,
    author_fid: cast.author.fid,
    author_username: cast.author.username,
    author_display_name: cast.author.displayName,
    author_follower_count: cast.author.followerCount,
    author_pfp_url: cast.author.pfpUrl,
    channel: cast.channel,
    timestamp: cast.timestamp,
    likes: cast.reactions.likes,
    recasts: cast.reactions.recasts,
    embeds: cast.embeds.map(e => e.url).filter(Boolean),
    parent_hash: cast.parentHash,
    category: cast.category,
    topics: extractTopicsFromText(cast.text),
    created_at: now,
  }));

  // Upsert in batches of 100
  let savedCount = 0;
  for (let i = 0; i < castsWithTopics.length; i += 100) {
    const batch = castsWithTopics.slice(i, i + 100);
    const { error } = await supabase
      .from('builder_casts')
      .upsert(batch, { onConflict: 'hash' });

    if (error) {
      console.error('Error saving casts batch:', error);
    } else {
      savedCount += batch.length;
    }
  }

  console.log(`Saved ${savedCount} casts to Supabase`);
  return savedCount;
}

/**
 * Get casts from the last N hours
 */
export async function getRecentCasts(
  env: Env,
  hoursBack: number = 24,
  limit: number = 200
): Promise<StoredBuilderCast[]> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('builder_casts')
    .select('*')
    .gte('timestamp', cutoff)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent casts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get casts by category
 */
export async function getCastsByCategory(
  env: Env,
  category: 'shipped' | 'insight' | 'discussion',
  hoursBack: number = 168, // 7 days default
  limit: number = 50
): Promise<StoredBuilderCast[]> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('builder_casts')
    .select('*')
    .eq('category', category)
    .gte('timestamp', cutoff)
    .order('likes', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching casts by category:', error);
    return [];
  }

  return data || [];
}

/**
 * Get casts mentioning a specific topic
 */
export async function getCastsByTopic(
  env: Env,
  topic: string,
  hoursBack: number = 168,
  limit: number = 50
): Promise<StoredBuilderCast[]> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('builder_casts')
    .select('*')
    .contains('topics', [topic.toLowerCase()])
    .gte('timestamp', cutoff)
    .order('likes', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching casts by topic:', error);
    return [];
  }

  return data || [];
}

/**
 * Search casts by text content
 */
export async function searchCasts(
  env: Env,
  query: string,
  limit: number = 50
): Promise<StoredBuilderCast[]> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('builder_casts')
    .select('*')
    .ilike('text', `%${query}%`)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching casts:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Digest Storage
// ============================================================================

/**
 * Save a daily digest
 */
export async function saveDigest(
  env: Env,
  digest: BuilderDigest,
  postHash?: string
): Promise<string> {
  const supabase = getSupabase(env);
  const id = `digest-${digest.date}`;

  const storedDigest: StoredBuilderDigest = {
    id,
    date: digest.date,
    shipped_count: digest.shippedProjects.length,
    insights_count: digest.insights.length,
    discussions_count: digest.topDiscussions.length,
    top_shipped_hashes: digest.shippedProjects.map(c => c.hash),
    top_insight_hashes: digest.insights.map(c => c.hash),
    top_discussion_hashes: digest.topDiscussions.map(c => c.hash),
    active_builders: digest.activeBuilders,
    trending_topics: digest.trendingTopics,
    summary: digest.summary,
    post_hash: postHash,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('builder_digests')
    .upsert(storedDigest, { onConflict: 'id' });

  if (error) {
    console.error('Error saving digest:', error);
    throw error;
  }

  console.log(`Saved digest ${id}`);
  return id;
}

/**
 * Get digest by date
 */
export async function getDigestByDate(
  env: Env,
  date: string
): Promise<StoredBuilderDigest | null> {
  const supabase = getSupabase(env);
  const id = `digest-${date}`;

  const { data, error } = await supabase
    .from('builder_digests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get recent digests
 */
export async function getRecentDigests(
  env: Env,
  limit: number = 7
): Promise<StoredBuilderDigest[]> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('builder_digests')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent digests:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Builder Profile Storage
// ============================================================================

/**
 * Update builder profiles from casts
 */
export async function updateBuilderProfiles(
  env: Env,
  casts: BuilderCast[]
): Promise<number> {
  if (casts.length === 0) return 0;

  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  // Aggregate stats per builder
  const builderStats = new Map<number, {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl?: string;
    followerCount: number;
    castCount: number;
    shippedCount: number;
    insightCount: number;
    totalEngagement: number;
    topics: Map<string, number>;
    latestTimestamp: string;
  }>();

  for (const cast of casts) {
    const existing = builderStats.get(cast.author.fid);
    const topics = extractTopicsFromText(cast.text);

    if (existing) {
      existing.castCount++;
      if (cast.category === 'shipped') existing.shippedCount++;
      if (cast.category === 'insight') existing.insightCount++;
      existing.totalEngagement += cast.reactions.likes + cast.reactions.recasts;
      for (const topic of topics) {
        existing.topics.set(topic, (existing.topics.get(topic) || 0) + 1);
      }
      if (cast.timestamp > existing.latestTimestamp) {
        existing.latestTimestamp = cast.timestamp;
        existing.followerCount = cast.author.followerCount;
        existing.pfpUrl = cast.author.pfpUrl;
      }
    } else {
      const topicMap = new Map<string, number>();
      for (const topic of topics) {
        topicMap.set(topic, 1);
      }
      builderStats.set(cast.author.fid, {
        fid: cast.author.fid,
        username: cast.author.username,
        displayName: cast.author.displayName,
        pfpUrl: cast.author.pfpUrl,
        followerCount: cast.author.followerCount,
        castCount: 1,
        shippedCount: cast.category === 'shipped' ? 1 : 0,
        insightCount: cast.category === 'insight' ? 1 : 0,
        totalEngagement: cast.reactions.likes + cast.reactions.recasts,
        topics: topicMap,
        latestTimestamp: cast.timestamp,
      });
    }
  }

  // Fetch existing profiles to merge stats
  const fids = Array.from(builderStats.keys());
  const { data: existingProfiles } = await supabase
    .from('builder_profiles')
    .select('*')
    .in('fid', fids);

  const existingMap = new Map(
    (existingProfiles || []).map(p => [p.fid, p as StoredBuilderProfile])
  );

  // Prepare upsert data
  const profilesToUpsert: StoredBuilderProfile[] = [];

  for (const [fid, stats] of builderStats) {
    const existing = existingMap.get(fid);
    const topTopics = Array.from(stats.topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    if (existing) {
      // Merge with existing
      const mergedTopics = mergeTopics(existing.top_topics, topTopics);
      profilesToUpsert.push({
        fid,
        username: stats.username,
        display_name: stats.displayName,
        pfp_url: stats.pfpUrl,
        follower_count: stats.followerCount,
        total_casts: existing.total_casts + stats.castCount,
        shipped_count: existing.shipped_count + stats.shippedCount,
        insight_count: existing.insight_count + stats.insightCount,
        total_engagement: existing.total_engagement + stats.totalEngagement,
        first_seen: existing.first_seen,
        last_seen: stats.latestTimestamp,
        top_topics: mergedTopics,
        updated_at: now,
      });
    } else {
      // New profile
      profilesToUpsert.push({
        fid,
        username: stats.username,
        display_name: stats.displayName,
        pfp_url: stats.pfpUrl,
        follower_count: stats.followerCount,
        total_casts: stats.castCount,
        shipped_count: stats.shippedCount,
        insight_count: stats.insightCount,
        total_engagement: stats.totalEngagement,
        first_seen: stats.latestTimestamp,
        last_seen: stats.latestTimestamp,
        top_topics: topTopics,
        updated_at: now,
      });
    }
  }

  // Upsert profiles
  const { error } = await supabase
    .from('builder_profiles')
    .upsert(profilesToUpsert, { onConflict: 'fid' });

  if (error) {
    console.error('Error updating builder profiles:', error);
    return 0;
  }

  console.log(`Updated ${profilesToUpsert.length} builder profiles`);
  return profilesToUpsert.length;
}

/**
 * Get top builders by various metrics
 */
export async function getTopBuilders(
  env: Env,
  orderBy: 'total_engagement' | 'shipped_count' | 'total_casts' = 'total_engagement',
  limit: number = 20
): Promise<StoredBuilderProfile[]> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('builder_profiles')
    .select('*')
    .order(orderBy, { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching top builders:', error);
    return [];
  }

  return data || [];
}

/**
 * Get builder profile by FID
 */
export async function getBuilderProfile(
  env: Env,
  fid: number
): Promise<StoredBuilderProfile | null> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('builder_profiles')
    .select('*')
    .eq('fid', fid)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get builder profile by username
 */
export async function getBuilderByUsername(
  env: Env,
  username: string
): Promise<StoredBuilderProfile | null> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('builder_profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get builders interested in a specific topic
 */
export async function getBuildersByTopic(
  env: Env,
  topic: string,
  limit: number = 20
): Promise<StoredBuilderProfile[]> {
  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from('builder_profiles')
    .select('*')
    .contains('top_topics', [topic.toLowerCase()])
    .order('total_engagement', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching builders by topic:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// Topic Trending
// ============================================================================

/**
 * Get trending topics over a time period
 */
export async function getTrendingTopics(
  env: Env,
  hoursBack: number = 168 // 7 days
): Promise<Array<{ topic: string; mentions: number; growth: number }>> {
  const supabase = getSupabase(env);
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const previousCutoff = new Date(Date.now() - hoursBack * 2 * 60 * 60 * 1000).toISOString();

  // Get recent casts with topics
  const { data: recentCasts } = await supabase
    .from('builder_casts')
    .select('topics')
    .gte('timestamp', cutoff);

  const { data: previousCasts } = await supabase
    .from('builder_casts')
    .select('topics')
    .gte('timestamp', previousCutoff)
    .lt('timestamp', cutoff);

  // Count topics in recent period
  const recentTopics = new Map<string, number>();
  for (const cast of recentCasts || []) {
    for (const topic of cast.topics || []) {
      recentTopics.set(topic, (recentTopics.get(topic) || 0) + 1);
    }
  }

  // Count topics in previous period
  const previousTopics = new Map<string, number>();
  for (const cast of previousCasts || []) {
    for (const topic of cast.topics || []) {
      previousTopics.set(topic, (previousTopics.get(topic) || 0) + 1);
    }
  }

  // Calculate growth
  const trending: Array<{ topic: string; mentions: number; growth: number }> = [];
  for (const [topic, mentions] of recentTopics) {
    const previous = previousTopics.get(topic) || 0;
    const growth = previous > 0 ? ((mentions - previous) / previous) * 100 : 100;
    trending.push({ topic, mentions, growth });
  }

  // Sort by mentions
  return trending.sort((a, b) => b.mentions - a.mentions).slice(0, 20);
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get builder activity stats
 */
export async function getBuilderStats(env: Env): Promise<{
  totalBuilders: number;
  totalCasts: number;
  totalShipped: number;
  totalInsights: number;
  avgEngagement: number;
  topChannels: Array<{ channel: string; count: number }>;
}> {
  const supabase = getSupabase(env);

  // Get builder count
  const { count: totalBuilders } = await supabase
    .from('builder_profiles')
    .select('*', { count: 'exact', head: true });

  // Get cast stats
  const { data: castStats } = await supabase
    .from('builder_casts')
    .select('category, channel, likes, recasts');

  let totalCasts = 0;
  let totalShipped = 0;
  let totalInsights = 0;
  let totalEngagement = 0;
  const channelCounts = new Map<string, number>();

  for (const cast of castStats || []) {
    totalCasts++;
    if (cast.category === 'shipped') totalShipped++;
    if (cast.category === 'insight') totalInsights++;
    totalEngagement += (cast.likes || 0) + (cast.recasts || 0);
    channelCounts.set(cast.channel, (channelCounts.get(cast.channel) || 0) + 1);
  }

  const topChannels = Array.from(channelCounts.entries())
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalBuilders: totalBuilders || 0,
    totalCasts,
    totalShipped,
    totalInsights,
    avgEngagement: totalCasts > 0 ? totalEngagement / totalCasts : 0,
    topChannels,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract topics from text
 */
function extractTopicsFromText(text: string): string[] {
  const topics: string[] = [];
  const lowerText = text.toLowerCase();

  const techKeywords = [
    'solidity', 'foundry', 'hardhat', 'wagmi', 'viem', 'ethers',
    'react', 'nextjs', 'typescript', 'rust', 'cairo',
    'base', 'ethereum', 'optimism', 'arbitrum', 'polygon',
    'nft', 'defi', 'dao', 'token', 'smart contract',
    'frame', 'farcaster', 'lens', 'onchainkit', 'coinbase',
    'uniswap', 'aave', 'compound', 'opensea',
    'wallet', 'dapp', 'web3', 'blockchain',
    'ai', 'agent', 'llm', 'openai', 'anthropic', 'claude',
    'mcp', 'miniapp', 'mini app',
  ];

  for (const keyword of techKeywords) {
    if (lowerText.includes(keyword)) {
      topics.push(keyword);
    }
  }

  return topics;
}

/**
 * Merge topic arrays, keeping top N
 */
function mergeTopics(existing: string[], newTopics: string[]): string[] {
  const combined = new Map<string, number>();

  // Weight existing topics
  for (let i = 0; i < existing.length; i++) {
    combined.set(existing[i], (existing.length - i) * 2); // Higher weight for existing
  }

  // Add new topics
  for (let i = 0; i < newTopics.length; i++) {
    const current = combined.get(newTopics[i]) || 0;
    combined.set(newTopics[i], current + (newTopics.length - i));
  }

  return Array.from(combined.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);
}
