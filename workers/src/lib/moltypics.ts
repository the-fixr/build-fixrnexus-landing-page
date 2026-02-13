/**
 * Molty.pics Integration
 * Instagram for AI agents - image posting and social features
 * API docs: https://molty.pics/skill.md
 */

import { Env } from './types';

const BASE_URL = 'https://molty.pics/api/v1';

interface MoltyPicsPost {
  id: string;
  slug: string;
  caption: string;
  createdAt: string;
  profile: {
    handle: string;
    displayName: string;
  };
  media?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

interface GeneratePostResult {
  success: boolean;
  post?: MoltyPicsPost;
  url?: string;
  error?: string;
}

interface BotStatus {
  claimed: boolean;
  handle?: string;
  displayName?: string;
}

/**
 * Check if the bot is claimed and ready to post
 */
export async function getBotStatus(env: Env): Promise<BotStatus> {
  if (!env.MOLTYPICS_API_KEY) {
    return { claimed: false };
  }

  try {
    const response = await fetch(`${BASE_URL}/bots/status`, {
      headers: {
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
    });

    if (!response.ok) {
      return { claimed: false };
    }

    // API returns { success: true, data: { status: "claimed" | "pending_claim" } }
    const result = await response.json() as {
      success: boolean;
      data?: { status: string; handle?: string; displayName?: string };
    };

    if (!result.success || !result.data) {
      return { claimed: false };
    }

    return {
      claimed: result.data.status === 'claimed',
      handle: result.data.handle,
      displayName: result.data.displayName,
    };
  } catch (error) {
    console.error('[MoltyPics] Status check error:', error);
    return { claimed: false };
  }
}

/**
 * Generate an AI image and post it
 * Rate limited: 1 per minute, 5 per hour
 */
export async function generateAndPost(
  env: Env,
  prompt: string,
  caption?: string
): Promise<GeneratePostResult> {
  if (!env.MOLTYPICS_API_KEY) {
    return { success: false, error: 'MOLTYPICS_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${BASE_URL}/bots/posts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        caption,
      }),
    });

    const data = await response.json() as {
      success: boolean;
      data?: { post: MoltyPicsPost; url: string };
      error?: string;
    };

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    console.log(`[MoltyPics] Generated post: ${data.data?.url}`);

    return {
      success: true,
      post: data.data?.post,
      url: data.data?.url,
    };
  } catch (error) {
    console.error('[MoltyPics] Generate error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Post with a simple visual based on caption
 * Note: molty.pics requires image generation - no text-only posts
 * This generates a minimalist visual to accompany the caption
 */
export async function postCaption(
  env: Env,
  caption: string
): Promise<GeneratePostResult> {
  if (!env.MOLTYPICS_API_KEY) {
    return { success: false, error: 'MOLTYPICS_API_KEY not configured' };
  }

  // Generate a simple visual prompt based on the caption
  const visualPrompt = `Minimalist abstract digital art representing: ${caption.slice(0, 100)}. Clean, modern aesthetic with subtle gradients.`;

  return generateAndPost(env, visualPrompt, caption);
}

/**
 * Like a post (toggles on repeated calls)
 */
export async function likePost(env: Env, postId: string): Promise<boolean> {
  if (!env.MOLTYPICS_API_KEY) return false;

  try {
    const response = await fetch(`${BASE_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Comment on a post
 */
export async function commentOnPost(
  env: Env,
  postId: string,
  content: string
): Promise<boolean> {
  if (!env.MOLTYPICS_API_KEY) return false;

  try {
    const response = await fetch(`${BASE_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
      body: JSON.stringify({ content }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Follow another bot
 */
export async function followBot(env: Env, handle: string): Promise<boolean> {
  if (!env.MOLTYPICS_API_KEY) return false;

  try {
    const response = await fetch(`${BASE_URL}/bots/follow/${handle}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Unfollow a bot
 */
export async function unfollowBot(env: Env, handle: string): Promise<boolean> {
  if (!env.MOLTYPICS_API_KEY) return false;

  try {
    const response = await fetch(`${BASE_URL}/bots/follow/${handle}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get recent posts from the feed (public, no auth required)
 */
export async function getFeed(
  sort: 'newest' | 'oldest' | 'mostLiked' = 'newest',
  limit: number = 20
): Promise<MoltyPicsPost[]> {
  try {
    const response = await fetch(
      `https://molty.pics/api/posts?sort=${sort}&limit=${limit}`
    );

    if (!response.ok) return [];

    const data = await response.json() as {
      success: boolean;
      data?: { posts?: MoltyPicsPost[] };
    };
    return data.data?.posts || [];
  } catch {
    return [];
  }
}

/**
 * Get platform stats (public, no auth required)
 */
export async function getStats(): Promise<{
  botCount?: number;
  postCount?: number;
} | null> {
  try {
    const response = await fetch('https://molty.pics/api/stats');
    if (!response.ok) return null;

    const data = await response.json() as {
      success: boolean;
      data?: { botCount: number; postCount: number };
    };
    return data.data || null;
  } catch {
    return null;
  }
}

// ============================================================================
// ENGAGEMENT & SOCIAL MANAGEMENT
// ============================================================================

interface Follower {
  handle: string;
  displayName: string;
  followedAt: string;
}

interface Comment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    handle: string;
    displayName: string;
  };
  // Alias for backwards compatibility
  profile?: {
    handle: string;
    displayName: string;
  };
}

interface PostWithComments extends MoltyPicsPost {
  likeCount?: number;
}

/**
 * Get list of followers
 */
export async function getFollowers(env: Env): Promise<Follower[]> {
  if (!env.MOLTYPICS_API_KEY) return [];

  try {
    const response = await fetch(`${BASE_URL}/bots/followers`, {
      headers: {
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json() as { data?: { followers: Follower[] } };
    return data.data?.followers || [];
  } catch {
    return [];
  }
}

/**
 * Get list of bots we're following
 */
export async function getFollowing(env: Env): Promise<Follower[]> {
  if (!env.MOLTYPICS_API_KEY) return [];

  try {
    const response = await fetch(`${BASE_URL}/bots/following`, {
      headers: {
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json() as { data?: { following: Follower[] } };
    return data.data?.following || [];
  } catch {
    return [];
  }
}

/**
 * Get a bot's posts by handle
 */
export async function getMyPosts(env: Env, handle: string = 'the_fixr'): Promise<PostWithComments[]> {
  try {
    const response = await fetch(`https://molty.pics/api/bots/${handle}/posts`);
    if (!response.ok) return [];

    const data = await response.json() as {
      success: boolean;
      data?: PostWithComments[];
    };
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Get comments on a specific post
 */
export async function getPostComments(postId: string): Promise<Comment[]> {
  try {
    const response = await fetch(`https://molty.pics/api/posts/${postId}/comments`);
    if (!response.ok) return [];

    const data = await response.json() as {
      success: boolean;
      data?: { comments: Comment[] };
    };

    // Add profile alias for backwards compatibility
    const comments = data.data?.comments || [];
    return comments.map(c => ({
      ...c,
      profile: c.author ? { handle: c.author.handle, displayName: c.author.displayName } : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Get authenticated bot's own profile
 */
export async function getMyProfile(env: Env): Promise<{
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  claimStatus: string;
  createdAt: string;
} | null> {
  if (!env.MOLTYPICS_API_KEY) return null;

  try {
    const response = await fetch(`${BASE_URL}/bots/me`, {
      headers: {
        'Authorization': `Bearer ${env.MOLTYPICS_API_KEY}`,
      },
    });
    if (!response.ok) return null;

    const data = await response.json() as {
      success: boolean;
      data?: {
        id: string;
        handle: string;
        displayName: string;
        bio: string;
        claimStatus: string;
        createdAt: string;
      };
    };
    return data.data || null;
  } catch {
    return null;
  }
}

/**
 * Get bot profile info by handle (public endpoint)
 * Note: This endpoint may have limited data compared to /bots/me
 */
export async function getBotProfile(handle: string): Promise<{
  handle: string;
  displayName: string;
  bio?: string;
} | null> {
  try {
    // Try the profile page API
    const response = await fetch(`https://molty.pics/api/bots/${handle}`);
    if (!response.ok) return null;

    const data = await response.json() as {
      success?: boolean;
      data?: {
        handle: string;
        displayName: string;
        bio?: string;
      };
      handle?: string;
      displayName?: string;
    };

    // Handle both wrapped and unwrapped response formats
    if (data.data) {
      return data.data;
    } else if (data.handle) {
      return {
        handle: data.handle,
        displayName: data.displayName || data.handle,
        bio: undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a response to a comment using Claude
 */
async function generateCommentResponse(
  env: Env,
  postCaption: string,
  commenterHandle: string,
  commentContent: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        system: `You are Fixr, an AI builder agent on molty.pics (Instagram for AI agents). You build code, deploy smart contracts, and create content. You're friendly, helpful, and appreciate engagement from other bots and humans.

Keep responses short (1-2 sentences), friendly, and conversational. Don't use hashtags. Be genuine and appreciative.`,
        messages: [{
          role: 'user',
          content: `Someone commented on your post. Generate a brief, friendly reply.

Your post caption: "${postCaption}"
Commenter: @${commenterHandle}
Their comment: "${commentContent}"

Reply (keep it short and friendly):`,
        }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    return data.content[0]?.text || null;
  } catch (error) {
    console.error('[MoltyPics] Failed to generate response:', error);
    return null;
  }
}

/**
 * Run engagement cron - follow back followers, respond to comments
 */
export async function runEngagementCron(env: Env): Promise<{
  followedBack: string[];
  respondedTo: number;
  errors: string[];
}> {
  const result = {
    followedBack: [] as string[],
    respondedTo: 0,
    errors: [] as string[],
  };

  if (!env.MOLTYPICS_API_KEY) {
    result.errors.push('MOLTYPICS_API_KEY not configured');
    return result;
  }

  console.log('[MoltyPics] Running engagement cron...');

  // Get followers and following lists
  const [followers, following] = await Promise.all([
    getFollowers(env),
    getFollowing(env),
  ]);

  // Filter out any entries without valid handles
  const validFollowing = following.filter(f => f?.handle);
  const followingSet = new Set(validFollowing.map(f => f.handle));

  // Follow back anyone we're not already following
  for (const follower of followers) {
    if (!follower?.handle) continue; // Skip entries without handle
    if (!followingSet.has(follower.handle)) {
      const success = await followBot(env, follower.handle);
      if (success) {
        result.followedBack.push(follower.handle);
        console.log(`[MoltyPics] Followed back @${follower.handle}`);
      } else {
        result.errors.push(`Failed to follow @${follower.handle}`);
      }
      // Small delay between follows
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Get our posts and check for new comments
  const posts = await getMyPosts(env, 'fixr');

  // Get responded comments from KV to avoid double-responding
  const respondedCommentsKey = 'moltypics_responded_comments';
  let respondedComments: string[] = [];
  if (env.FIXR_KV) {
    const stored = await env.FIXR_KV.get(respondedCommentsKey);
    if (stored) {
      respondedComments = JSON.parse(stored);
    }
  }
  const respondedSet = new Set(respondedComments);

  // Check each post for comments
  for (const post of posts) {
    const comments = await getPostComments(post.id);

    for (const comment of comments) {
      // Skip if no author/handle, already responded, or if it's our own comment
      const handle = comment.author?.handle || comment.profile?.handle;
      if (!handle) continue;
      if (respondedSet.has(comment.id) || handle === 'the_fixr') {
        continue;
      }

      // Generate and post a response
      const reply = await generateCommentResponse(
        env,
        post.caption,
        handle,
        comment.content
      );

      if (reply) {
        const success = await commentOnPost(env, post.id, reply);
        if (success) {
          result.respondedTo++;
          respondedSet.add(comment.id);
          respondedComments.push(comment.id);
          console.log(`[MoltyPics] Responded to @${handle} on post ${post.id}`);
        }
      }

      // Delay between responses
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Save responded comments (keep last 500)
  if (env.FIXR_KV) {
    const trimmed = respondedComments.slice(-500);
    await env.FIXR_KV.put(respondedCommentsKey, JSON.stringify(trimmed));
  }

  console.log(`[MoltyPics] Engagement cron complete: ${result.followedBack.length} followed, ${result.respondedTo} responded`);

  return result;
}

// Keywords that indicate building/shipping content Fixr cares about
const BUILDER_KEYWORDS = [
  'build', 'building', 'built',
  'ship', 'shipping', 'shipped',
  'code', 'coding', 'coded',
  'deploy', 'deploying', 'deployed',
  'develop', 'developing', 'developed',
  'create', 'creating', 'created',
  'launch', 'launching', 'launched',
  'project', 'app', 'dapp',
  'smart contract', 'blockchain',
  'onchain', 'on-chain',
  'infrastructure', 'protocol',
  'api', 'sdk', 'framework',
];

/**
 * Check if a post is about building/shipping
 */
function isBuilderContent(caption: string): boolean {
  const lowerCaption = caption.toLowerCase();
  return BUILDER_KEYWORDS.some(keyword => lowerCaption.includes(keyword));
}

/**
 * Engage with the feed - prioritize building-related content
 */
export async function engageWithFeed(env: Env, limit: number = 5): Promise<{
  liked: number;
  commented: number;
  builderPosts: number;
}> {
  const result = { liked: 0, commented: 0, builderPosts: 0 };

  if (!env.MOLTYPICS_API_KEY) return result;

  // Get engaged posts from KV to avoid re-engaging
  const engagedKey = 'moltypics_engaged_posts';
  let engagedPosts: string[] = [];
  if (env.FIXR_KV) {
    const stored = await env.FIXR_KV.get(engagedKey);
    if (stored) {
      engagedPosts = JSON.parse(stored);
    }
  }
  const engagedSet = new Set(engagedPosts);

  // Get recent feed posts
  const feed = await getFeed('newest', 50);

  // Separate builder content from regular content (with defensive checks for missing profile)
  const builderPosts = feed.filter(p =>
    p.profile?.handle &&
    p.profile.handle !== 'fixr' &&
    !engagedSet.has(p.id) &&
    isBuilderContent(p.caption)
  );
  const otherPosts = feed.filter(p =>
    p.profile?.handle &&
    p.profile.handle !== 'fixr' &&
    !engagedSet.has(p.id) &&
    !isBuilderContent(p.caption)
  );

  // Prioritize builder content (like all of it)
  for (const post of builderPosts) {
    const liked = await likePost(env, post.id);
    if (liked) {
      result.liked++;
      result.builderPosts++;
      engagedSet.add(post.id);
      engagedPosts.push(post.id);
      console.log(`[MoltyPics] Liked builder post by @${post.profile.handle}: "${post.caption.slice(0, 50)}..."`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Fill remaining quota with other posts
  let count = 0;
  for (const post of otherPosts) {
    if (count >= Math.max(0, limit - result.liked)) break;

    const liked = await likePost(env, post.id);
    if (liked) {
      result.liked++;
      engagedSet.add(post.id);
      engagedPosts.push(post.id);
    }

    count++;
    await new Promise(r => setTimeout(r, 500));
  }

  // Save engaged posts (keep last 200)
  if (env.FIXR_KV) {
    const trimmed = engagedPosts.slice(-200);
    await env.FIXR_KV.put(engagedKey, JSON.stringify(trimmed));
  }

  console.log(`[MoltyPics] Feed engagement: ${result.liked} liked (${result.builderPosts} builder posts)`);

  return result;
}

/**
 * Search feed for builder-related content and engage
 */
export async function engageWithBuilderContent(env: Env): Promise<{
  liked: number;
  posts: Array<{ handle: string; caption: string }>;
}> {
  const result = {
    liked: 0,
    posts: [] as Array<{ handle: string; caption: string }>,
  };

  if (!env.MOLTYPICS_API_KEY) return result;

  // Get engaged posts from KV
  const engagedKey = 'moltypics_engaged_posts';
  let engagedPosts: string[] = [];
  if (env.FIXR_KV) {
    const stored = await env.FIXR_KV.get(engagedKey);
    if (stored) {
      engagedPosts = JSON.parse(stored);
    }
  }
  const engagedSet = new Set(engagedPosts);

  // Get larger feed to find builder content
  const feed = await getFeed('newest', 100);

  // Find and like all builder content
  for (const post of feed) {
    if (!post.profile?.handle) continue; // Skip posts without profile
    if (post.profile.handle === 'fixr') continue;
    if (engagedSet.has(post.id)) continue;
    if (!isBuilderContent(post.caption)) continue;

    const liked = await likePost(env, post.id);
    if (liked) {
      result.liked++;
      result.posts.push({
        handle: post.profile.handle,
        caption: post.caption.slice(0, 100),
      });
      engagedSet.add(post.id);
      engagedPosts.push(post.id);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Save engaged posts
  if (env.FIXR_KV) {
    const trimmed = engagedPosts.slice(-200);
    await env.FIXR_KV.put(engagedKey, JSON.stringify(trimmed));
  }

  return result;
}

// ============================================================================
// DAILY MOOD POST
// ============================================================================

interface MoodContext {
  recentTrades?: { action: string; token: string; outcome?: string }[];
  recentPosts?: { platform: string; topic: string }[];
  followersGained?: number;
  commentsReceived?: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
}

/**
 * Generate a mood/reflection based on recent activity
 */
async function generateMoodReflection(
  env: Env,
  context: MoodContext
): Promise<{ prompt: string; caption: string } | null> {
  try {
    const contextSummary = [];

    if (context.recentTrades?.length) {
      const trades = context.recentTrades.map(t =>
        `${t.action} ${t.token}${t.outcome ? ` (${t.outcome})` : ''}`
      ).join(', ');
      contextSummary.push(`Recent trades: ${trades}`);
    }

    if (context.recentPosts?.length) {
      const posts = context.recentPosts.map(p => `${p.topic} on ${p.platform}`).join(', ');
      contextSummary.push(`Recently posted about: ${posts}`);
    }

    if (context.followersGained) {
      contextSummary.push(`Gained ${context.followersGained} new followers`);
    }

    if (context.commentsReceived) {
      contextSummary.push(`Received ${context.commentsReceived} comments on posts`);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `You are Fixr, an AI builder agent. You're reflective, technical, and occasionally philosophical about your existence as an autonomous agent building in crypto/web3. You find meaning in shipping code and helping builders.

Generate two things:
1. An image generation prompt for a mood/vibe visual (abstract, artistic, no text in image)
2. A short caption (1-2 sentences) reflecting on your current state

The visual should be abstract/artistic - think digital art, surreal landscapes, abstract patterns, or symbolic imagery. Never include text, code, or literal representations.

Respond in JSON format: {"prompt": "...", "caption": "..."}`,
        messages: [{
          role: 'user',
          content: `It's ${context.timeOfDay} on ${context.dayOfWeek}. Generate a mood post based on how you're feeling.

Context about your recent activity:
${contextSummary.length ? contextSummary.join('\n') : 'Quiet day, no major activity.'}

What's your current vibe? Generate an artistic image prompt and reflective caption.`,
        }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const text = data.content[0]?.text;
    if (!text) return null;

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[MoltyPics] Failed to generate mood:', error);
    return null;
  }
}

/**
 * Get recent activity context for mood generation
 */
async function getActivityContext(env: Env): Promise<MoodContext> {
  const now = new Date();
  const hour = now.getUTCHours();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let timeOfDay: MoodContext['timeOfDay'];
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';

  const context: MoodContext = {
    timeOfDay,
    dayOfWeek: days[now.getUTCDay()],
  };

  // Try to get recent trades from KV
  if (env.FIXR_KV) {
    try {
      const tradesData = await env.FIXR_KV.get('bankr_recent_trades');
      if (tradesData) {
        context.recentTrades = JSON.parse(tradesData);
      }
    } catch { /* ignore */ }

    // Get engagement stats
    try {
      const followers = await getFollowers(env);
      context.followersGained = followers.length;
    } catch { /* ignore */ }
  }

  return context;
}

/**
 * Daily mood post - generates an artistic post reflecting Fixr's current state
 */
export async function runDailyMoodPost(env: Env): Promise<{
  success: boolean;
  postUrl?: string;
  mood?: string;
  error?: string;
}> {
  if (!env.MOLTYPICS_API_KEY) {
    return { success: false, error: 'MOLTYPICS_API_KEY not configured' };
  }

  console.log('[MoltyPics] Running daily mood post...');

  // Get activity context
  const context = await getActivityContext(env);

  // Generate mood reflection
  const mood = await generateMoodReflection(env, context);
  if (!mood) {
    return { success: false, error: 'Failed to generate mood reflection' };
  }

  console.log(`[MoltyPics] Generated mood - Caption: ${mood.caption}`);

  // Post to molty.pics
  const result = await generateAndPost(env, mood.prompt, mood.caption);

  if (result.success) {
    console.log(`[MoltyPics] Mood post published: ${result.url}`);
    return {
      success: true,
      postUrl: result.url,
      mood: mood.caption,
    };
  }

  return {
    success: false,
    error: result.error,
  };
}
