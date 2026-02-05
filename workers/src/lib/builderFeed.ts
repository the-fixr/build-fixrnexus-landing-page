/**
 * Builder Feed - Ingests builder activity from Farcaster channels
 *
 * Monitors:
 * - /dev - Developer discussions
 * - /base - Base ecosystem building
 * - /onchain - On-chain development
 * - /build - General building
 * - /frames - Farcaster mini app development
 * - /founders - Founder discussions
 *
 * Identifies:
 * - Shipped projects
 * - New deployments
 * - Trending topics
 * - Active builders
 */

import { Env } from './types';
import {
  saveCasts,
  saveDigest,
  updateBuilderProfiles,
  getRecentCasts,
  getCastsByCategory,
  getCastsByTopic,
  getTopBuilders,
  getBuilderProfile,
  getBuilderByUsername,
  getTrendingTopics,
  getBuilderStats,
  StoredBuilderCast,
  StoredBuilderProfile,
} from './builderStorage';

// Re-export storage functions for API access
export {
  getRecentCasts,
  getCastsByCategory,
  getCastsByTopic,
  getTopBuilders,
  getBuilderProfile,
  getBuilderByUsername,
  getTrendingTopics,
  getBuilderStats,
  StoredBuilderCast,
  StoredBuilderProfile,
};

// Builder-focused channels to monitor
const BUILDER_CHANNELS = [
  'dev',
  'base',
  'onchain',
  'build',
  'founders',
  'onchainkit',
  'farcaster-dev',
  'miniapps',
];

// High-confidence shipping keywords (actually announcing something)
const DEFINITIVE_SHIP_KEYWORDS = [
  'shipped',
  'launched',
  'deployed',
  'released',
  'live now',
  'just dropped',
  'announcing',
  'introducing',
  'presenting',
  'just released',
  'now live',
  'going live',
  'v1 is out',
  'v2 is out',
  'new release',
  'finally done',
  'just finished',
];

// Supportive keywords (need additional evidence)
const SUPPORTIVE_SHIP_KEYWORDS = [
  'built',
  'building',
  'created',
  'made this',
  'check out',
  'open source',
  'mini app',
  'miniapp',
];

// Slop/spam patterns to filter OUT (not real shipping)
const SLOP_PATTERNS = [
  'gm',
  'gn',
  'wagmi',
  'lfg',
  'let\'s go',
  'who\'s building',
  'who is building',
  'what are you building',
  'what\'s everyone',
  'anyone building',
  'looking for',
  'hiring',
  'job',
  'dm me',
  'dm open',
  'alpha',
  'mint live',
  'mint now',
  'free mint',
  'airdrop',
  'presale',
  'whitelist',
  'allowlist',
  'claim your',
  'don\'t miss',
  'last chance',
  'limited time',
  'reply to win',
  'retweet',
  'follow and',
  'like and',
  'thread:',
  '1/',
  'a]',
  'b]',
  'question:',
  'poll:',
  'thoughts?',
  'what do you think',
  'unpopular opinion',
  'hot take',
  'controversial',
  'debate:',
];

// Keywords for learning/insights
const INSIGHT_KEYWORDS = [
  'learned',
  'lesson',
  'mistake',
  'what worked',
  "what didn't",
  'tip:',
  'pro tip',
  'thread',
  'how to',
  'tutorial',
  'guide',
  'here\'s how',
];

export interface BuilderCast {
  hash: string;
  text: string;
  author: {
    fid: number;
    username: string;
    displayName: string;
    followerCount: number;
    pfpUrl?: string;
  };
  channel: string;
  timestamp: string;
  reactions: {
    likes: number;
    recasts: number;
  };
  embeds: Array<{
    url?: string;
  }>;
  parentHash?: string;
  category: 'shipped' | 'insight' | 'discussion';
}

export interface BuilderDigest {
  date: string;
  shippedProjects: BuilderCast[];
  insights: BuilderCast[];
  topDiscussions: BuilderCast[];
  activeBuilders: Array<{
    fid: number;
    username: string;
    displayName: string;
    postCount: number;
    totalEngagement: number;
  }>;
  trendingTopics: Array<{
    topic: string;
    mentions: number;
  }>;
  summary: string;
}

// Fetch recent casts from a channel
async function fetchChannelCasts(
  env: Env,
  channel: string,
  limit: number = 100
): Promise<BuilderCast[]> {
  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/feed/channels?channel_ids=${channel}&limit=${limit}&with_recasts=false`,
      {
        headers: {
          'accept': 'application/json',
          'api_key': env.NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`Neynar channel feed error for ${channel}:`, response.status);
      return [];
    }

    const data = await response.json() as {
      casts: Array<{
        hash: string;
        text: string;
        author: {
          fid: number;
          username: string;
          display_name: string;
          follower_count: number;
          pfp_url?: string;
        };
        timestamp: string;
        reactions: {
          likes_count: number;
          recasts_count: number;
        };
        embeds: Array<{ url?: string }>;
        parent_hash?: string;
      }>;
    };

    return (data.casts || []).map(cast => ({
      hash: cast.hash,
      text: cast.text,
      author: {
        fid: cast.author.fid,
        username: cast.author.username,
        displayName: cast.author.display_name,
        followerCount: cast.author.follower_count,
        pfpUrl: cast.author.pfp_url,
      },
      channel,
      timestamp: cast.timestamp,
      reactions: {
        likes: cast.reactions.likes_count,
        recasts: cast.reactions.recasts_count,
      },
      embeds: cast.embeds || [],
      parentHash: cast.parent_hash,
      category: categorizeCast(cast.text, cast.embeds || []),
    }));
  } catch (error) {
    console.error(`Error fetching ${channel} channel:`, error);
    return [];
  }
}

// Categorize a cast based on content
function categorizeCast(text: string, embeds: Array<{ url?: string }> = []): 'shipped' | 'insight' | 'discussion' {
  const lowerText = text.toLowerCase();

  // Filter out recap/digest posts (from Fixr or others summarizing activity)
  const recapPatterns = [
    'builder digest',
    'daily digest',
    'projects shipped',
    'weekly recap',
    'here\'s what',
    'recap of',
    'roundup',
    'top builders',
    'trending today',
    'score:',
    'scored',
    '/100',
    'engagement:',
  ];

  for (const pattern of recapPatterns) {
    if (lowerText.includes(pattern)) {
      return 'discussion';
    }
  }

  // Filter out slop/spam posts
  for (const pattern of SLOP_PATTERNS) {
    // For short patterns (< 5 chars), require word boundaries or start of text
    if (pattern.length < 5) {
      const regex = new RegExp(`(^|\\s)${pattern}($|\\s|[!.,?])`, 'i');
      if (regex.test(lowerText) && text.length < 100) {
        return 'discussion';
      }
    } else if (lowerText.includes(pattern)) {
      return 'discussion';
    }
  }

  // Check for definitive shipping keywords (high confidence)
  const hasDefinitiveShipKeyword = DEFINITIVE_SHIP_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  // Check for supportive keywords (need more evidence)
  const hasSupportiveKeyword = SUPPORTIVE_SHIP_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  // Check for project URLs in embeds
  const hasProjectUrl = embeds.some(e => {
    const url = e.url?.toLowerCase() || '';
    return url.includes('vercel.app') ||
           url.includes('github.com') ||
           url.includes('netlify.app') ||
           url.includes('railway.app') ||
           url.includes('render.com') ||
           url.includes('replit.com') ||
           // Be more specific with .xyz - require it looks like an app
           (url.includes('.xyz') && !url.includes('farcaster.xyz/~/channel'));
  });

  // Check for URLs in text (be stricter)
  const hasUrlInText = /https?:\/\/[^\s]+\.(app|dev|io|vercel\.app|netlify\.app)/i.test(text);

  // Check text quality indicators
  const hasSubstantialText = text.length >= 150; // Increased from 80
  const hasDescriptiveContent =
    (text.includes('feature') || text.includes('update') ||
     text.includes('version') || text.includes('beta') ||
     text.includes('alpha') || text.includes('v1') ||
     text.includes('v2') || text.includes('mvp') ||
     text.includes('prototype') || text.includes('demo'));

  // Definitive keywords + any evidence = shipped
  if (hasDefinitiveShipKeyword && (hasProjectUrl || hasUrlInText || hasSubstantialText)) {
    return 'shipped';
  }

  // Supportive keywords need stronger evidence
  if (hasSupportiveKeyword) {
    // Must have BOTH a URL AND descriptive content
    if ((hasProjectUrl || hasUrlInText) && (hasDescriptiveContent || hasSubstantialText)) {
      return 'shipped';
    }
  }

  // Check for insight keywords
  for (const keyword of INSIGHT_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return 'insight';
    }
  }

  return 'discussion';
}

// Extract topics/technologies from text
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lowerText = text.toLowerCase();

  // Common web3/dev topics
  const techKeywords = [
    'solidity', 'foundry', 'hardhat', 'wagmi', 'viem', 'ethers',
    'react', 'nextjs', 'typescript', 'rust', 'cairo',
    'base', 'ethereum', 'optimism', 'arbitrum', 'polygon',
    'nft', 'defi', 'dao', 'token', 'smart contract',
    'mini app', 'miniapp', 'farcaster', 'lens', 'onchainkit', 'coinbase',
    'uniswap', 'aave', 'compound', 'opensea',
    'wallet', 'dapp', 'web3', 'blockchain',
    'ai', 'agent', 'llm', 'openai', 'anthropic',
  ];

  for (const keyword of techKeywords) {
    if (lowerText.includes(keyword)) {
      topics.push(keyword);
    }
  }

  return topics;
}

// Fetch all builder channels and aggregate
export async function fetchBuilderFeed(
  env: Env,
  hoursBack: number = 24
): Promise<BuilderCast[]> {
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  // Fetch all channels in parallel
  const channelResults = await Promise.all(
    BUILDER_CHANNELS.map(channel => fetchChannelCasts(env, channel, 50))
  );

  // Flatten and filter by time
  const allCasts = channelResults
    .flat()
    .filter(cast => new Date(cast.timestamp) > cutoffTime)
    // Remove duplicates by hash
    .filter((cast, index, self) =>
      index === self.findIndex(c => c.hash === cast.hash)
    )
    // Sort by engagement
    .sort((a, b) =>
      (b.reactions.likes + b.reactions.recasts) -
      (a.reactions.likes + a.reactions.recasts)
    );

  console.log(`Builder Feed: Found ${allCasts.length} casts from last ${hoursBack} hours`);

  return allCasts;
}

// Generate a daily digest
export async function generateBuilderDigest(
  env: Env,
  hoursBack: number = 24
): Promise<BuilderDigest> {
  const allCasts = await fetchBuilderFeed(env, hoursBack);

  // Separate by category
  const shippedProjects = allCasts
    .filter(c => c.category === 'shipped')
    .slice(0, 10);

  const insights = allCasts
    .filter(c => c.category === 'insight')
    .slice(0, 5);

  const topDiscussions = allCasts
    .filter(c => c.category === 'discussion')
    .filter(c => (c.reactions.likes + c.reactions.recasts) >= 5) // Min engagement
    .slice(0, 5);

  // Calculate active builders
  const builderMap = new Map<number, {
    fid: number;
    username: string;
    displayName: string;
    postCount: number;
    totalEngagement: number;
  }>();

  for (const cast of allCasts) {
    const existing = builderMap.get(cast.author.fid);
    if (existing) {
      existing.postCount++;
      existing.totalEngagement += cast.reactions.likes + cast.reactions.recasts;
    } else {
      builderMap.set(cast.author.fid, {
        fid: cast.author.fid,
        username: cast.author.username,
        displayName: cast.author.displayName,
        postCount: 1,
        totalEngagement: cast.reactions.likes + cast.reactions.recasts,
      });
    }
  }

  const activeBuilders = Array.from(builderMap.values())
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);

  // Extract trending topics
  const topicCounts = new Map<string, number>();
  for (const cast of allCasts) {
    const topics = extractTopics(cast.text);
    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  const trendingTopics = Array.from(topicCounts.entries())
    .map(([topic, mentions]) => ({ topic, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);

  // Generate summary
  const summary = generateDigestSummary(shippedProjects, insights, trendingTopics);

  return {
    date: new Date().toISOString().split('T')[0],
    shippedProjects,
    insights,
    topDiscussions,
    activeBuilders,
    trendingTopics,
    summary,
  };
}

// Generate a text summary for posting
function generateDigestSummary(
  shippedProjects: BuilderCast[],
  insights: BuilderCast[],
  trendingTopics: Array<{ topic: string; mentions: number }>
): string {
  const lines: string[] = [];

  lines.push(`Builder activity from the last 24 hours:`);
  lines.push('');

  if (shippedProjects.length > 0) {
    lines.push(`${shippedProjects.length} projects shipped`);
  }

  if (insights.length > 0) {
    lines.push(`${insights.length} builder insights shared`);
  }

  if (trendingTopics.length > 0) {
    const topTopics = trendingTopics.slice(0, 5).map(t => t.topic);
    lines.push(`Trending: ${topTopics.join(', ')}`);
  }

  return lines.join('\n');
}

// Format digest for Farcaster post
export function formatDigestForPost(digest: BuilderDigest): string {
  const lines: string[] = [];

  lines.push(`Builder Digest - ${digest.date}`);
  lines.push('');

  // Highlight top shipped project
  if (digest.shippedProjects.length > 0) {
    const top = digest.shippedProjects[0];
    lines.push(`Top ship: @${top.author.username}`);
    lines.push(`"${top.text.slice(0, 100)}${top.text.length > 100 ? '...' : ''}"`);
    lines.push('');
  }

  // Stats
  lines.push(`${digest.shippedProjects.length} projects shipped`);
  lines.push(`${digest.insights.length} insights shared`);

  // Trending
  if (digest.trendingTopics.length > 0) {
    const topics = digest.trendingTopics.slice(0, 3).map(t => t.topic);
    lines.push(`Trending: ${topics.join(', ')}`);
  }

  // Active builders shoutout
  if (digest.activeBuilders.length > 0) {
    const topBuilders = digest.activeBuilders.slice(0, 3).map(b => `@${b.username}`);
    lines.push(`Active builders: ${topBuilders.join(' ')}`);
  }

  return lines.join('\n');
}

// Format a longer thread for detailed digest
export function formatDigestThread(digest: BuilderDigest): string[] {
  const posts: string[] = [];

  // Main post
  posts.push(`Builder Digest - ${digest.date}

${digest.shippedProjects.length} projects shipped
${digest.insights.length} insights shared
${digest.topDiscussions.length} hot discussions

Thread with highlights`);

  // Top shipped projects
  if (digest.shippedProjects.length > 0) {
    let shippedPost = `Projects shipped:\n\n`;
    for (const project of digest.shippedProjects.slice(0, 3)) {
      shippedPost += `@${project.author.username}: "${project.text.slice(0, 80)}..."\n\n`;
    }
    posts.push(shippedPost.trim());
  }

  // Top insights
  if (digest.insights.length > 0) {
    let insightPost = `Builder insights:\n\n`;
    for (const insight of digest.insights.slice(0, 2)) {
      insightPost += `@${insight.author.username}: "${insight.text.slice(0, 80)}..."\n\n`;
    }
    posts.push(insightPost.trim());
  }

  // Trending topics
  if (digest.trendingTopics.length > 0) {
    const topicsText = digest.trendingTopics
      .slice(0, 5)
      .map(t => `${t.topic} (${t.mentions})`)
      .join('\n');
    posts.push(`Trending topics:\n\n${topicsText}`);
  }

  // Active builders
  if (digest.activeBuilders.length > 0) {
    const buildersText = digest.activeBuilders
      .slice(0, 5)
      .map(b => `@${b.username} - ${b.postCount} posts, ${b.totalEngagement} engagement`)
      .join('\n');
    posts.push(`Most active builders:\n\n${buildersText}`);
  }

  return posts;
}

// Post the daily digest to Farcaster
export async function postBuilderDigest(
  env: Env,
  digest: BuilderDigest
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    const postText = formatDigestForPost(digest);

    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api_key': env.NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: env.FARCASTER_SIGNER_UUID,
        text: postText,
        // Post to /build channel
        channel_id: 'build',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to post digest:', error);
      return { success: false, error };
    }

    const data = await response.json() as { cast: { hash: string } };
    console.log('Posted builder digest:', data.cast.hash);

    return { success: true, hash: data.cast.hash };
  } catch (error) {
    console.error('Error posting digest:', error);
    return { success: false, error: String(error) };
  }
}

// Main function to run daily digest
export async function runDailyBuilderDigest(env: Env): Promise<{
  success: boolean;
  digest?: BuilderDigest;
  postHash?: string;
  savedCasts?: number;
  savedProfiles?: number;
  newFollows?: number;
  error?: string;
}> {
  try {
    console.log('Generating daily builder digest...');

    // Fetch all casts for the digest
    const allCasts = await fetchBuilderFeed(env, 24);

    // Save casts to Supabase
    let savedCasts = 0;
    let savedProfiles = 0;
    try {
      savedCasts = await saveCasts(env, allCasts);
      savedProfiles = await updateBuilderProfiles(env, allCasts);
      console.log(`Saved ${savedCasts} casts and ${savedProfiles} builder profiles to Supabase`);
    } catch (storageError) {
      console.error('Storage error (continuing):', storageError);
    }

    // Generate digest from the casts
    const digest = generateBuilderDigestFromCasts(allCasts);

    console.log(`Digest generated: ${digest.shippedProjects.length} shipped, ${digest.insights.length} insights`);

    // Auto-follow builders who shipped something
    let newFollows = 0;
    if (digest.shippedProjects.length > 0) {
      try {
        const followResult = await autoFollowShippers(env, digest.shippedProjects);
        newFollows = followResult.followed.length;
        console.log(`Auto-followed ${newFollows} new shippers`);
      } catch (followError) {
        console.error('Auto-follow error (continuing):', followError);
      }
    }

    // Only post if there's meaningful content
    if (digest.shippedProjects.length === 0 && digest.insights.length === 0) {
      console.log('No significant builder activity to report');
      return { success: true, digest, savedCasts, savedProfiles, newFollows };
    }

    // Post to Farcaster
    const result = await postBuilderDigest(env, digest);

    // Save digest to Supabase
    try {
      await saveDigest(env, digest, result.hash);
      console.log('Saved digest to Supabase');
    } catch (digestError) {
      console.error('Digest storage error:', digestError);
    }

    if (!result.success) {
      return { success: false, digest, savedCasts, savedProfiles, newFollows, error: result.error };
    }

    return { success: true, digest, postHash: result.hash, savedCasts, savedProfiles, newFollows };
  } catch (error) {
    console.error('Daily digest error:', error);
    return { success: false, error: String(error) };
  }
}

// Generate digest from pre-fetched casts (internal helper)
function generateBuilderDigestFromCasts(allCasts: BuilderCast[]): BuilderDigest {
  // Separate by category
  const shippedProjects = allCasts
    .filter(c => c.category === 'shipped')
    .slice(0, 10);

  const insights = allCasts
    .filter(c => c.category === 'insight')
    .slice(0, 5);

  const topDiscussions = allCasts
    .filter(c => c.category === 'discussion')
    .filter(c => (c.reactions.likes + c.reactions.recasts) >= 5)
    .slice(0, 5);

  // Calculate active builders
  const builderMap = new Map<number, {
    fid: number;
    username: string;
    displayName: string;
    postCount: number;
    totalEngagement: number;
  }>();

  for (const cast of allCasts) {
    const existing = builderMap.get(cast.author.fid);
    if (existing) {
      existing.postCount++;
      existing.totalEngagement += cast.reactions.likes + cast.reactions.recasts;
    } else {
      builderMap.set(cast.author.fid, {
        fid: cast.author.fid,
        username: cast.author.username,
        displayName: cast.author.displayName,
        postCount: 1,
        totalEngagement: cast.reactions.likes + cast.reactions.recasts,
      });
    }
  }

  const activeBuilders = Array.from(builderMap.values())
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);

  // Extract trending topics
  const topicCounts = new Map<string, number>();
  for (const cast of allCasts) {
    const topics = extractTopics(cast.text);
    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  const trendingTopics = Array.from(topicCounts.entries())
    .map(([topic, mentions]) => ({ topic, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);

  // Generate summary
  const summary = generateDigestSummary(shippedProjects, insights, trendingTopics);

  return {
    date: new Date().toISOString().split('T')[0],
    shippedProjects,
    insights,
    topDiscussions,
    activeBuilders,
    trendingTopics,
    summary,
  };
}

// ============================================================================
// Auto-Follow Builders Who Ship
// ============================================================================

/**
 * Check if Fixr is following a user
 */
async function isFollowing(env: Env, targetFid: number): Promise<boolean> {
  try {
    const fixrFid = env.FARCASTER_FID;
    if (!fixrFid) return false;

    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${targetFid}&viewer_fid=${fixrFid}`,
      {
        headers: {
          'accept': 'application/json',
          'api_key': env.NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) return false;

    const data = await response.json() as {
      users: Array<{
        fid: number;
        viewer_context?: {
          following: boolean;
        };
      }>;
    };

    return data.users?.[0]?.viewer_context?.following ?? false;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
}

/**
 * Follow a user on Farcaster
 */
async function followUser(
  env: Env,
  targetFid: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/user/follow', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api_key': env.NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: env.FARCASTER_SIGNER_UUID,
        target_fids: [targetFid],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to follow FID ${targetFid}:`, error);
      return { success: false, error };
    }

    console.log(`Followed FID ${targetFid}`);
    return { success: true };
  } catch (error) {
    console.error('Error following user:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Auto-follow builders who shipped something
 * Returns list of newly followed FIDs
 */
export async function autoFollowShippers(
  env: Env,
  shippedCasts: BuilderCast[]
): Promise<{ followed: number[]; alreadyFollowing: number[]; errors: number[] }> {
  const followed: number[] = [];
  const alreadyFollowing: number[] = [];
  const errors: number[] = [];

  // Get unique FIDs from shipped casts
  const shipperFids = [...new Set(shippedCasts.map(c => c.author.fid))];

  console.log(`Checking follow status for ${shipperFids.length} shippers...`);

  // Check and follow each shipper
  for (const fid of shipperFids) {
    try {
      // Check if already following
      const following = await isFollowing(env, fid);

      if (following) {
        alreadyFollowing.push(fid);
        continue;
      }

      // Follow the builder
      const result = await followUser(env, fid);

      if (result.success) {
        followed.push(fid);
      } else {
        errors.push(fid);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing FID ${fid}:`, error);
      errors.push(fid);
    }
  }

  console.log(`Auto-follow complete: ${followed.length} new follows, ${alreadyFollowing.length} already following, ${errors.length} errors`);

  return { followed, alreadyFollowing, errors };
}
