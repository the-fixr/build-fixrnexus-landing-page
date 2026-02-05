// Fixr Agent Engagement Monitor
// Tracks replies, mentions, and engagement on Farcaster posts

import { Env } from './types';
import { postToFarcaster } from './social';

export interface Notification {
  type: 'reply' | 'mention' | 'like' | 'recast';
  cast?: {
    hash: string;
    text: string;
    timestamp: string;
  };
  author: {
    fid: number;
    username: string;
    displayName?: string;
  };
  timestamp: string;
}

export interface EngagementSummary {
  totalReplies: number;
  totalMentions: number;
  totalLikes: number;
  totalRecasts: number;
  topReplies: Notification[];
  uniqueUsers: number;
  insights: string[];
}

/**
 * Fetch notifications for Fixr (replies, mentions, likes, recasts)
 */
export async function fetchNotifications(
  env: Env,
  cursor?: string
): Promise<{ notifications: Notification[]; nextCursor?: string }> {
  if (!env.NEYNAR_API_KEY || !env.FARCASTER_FID) {
    console.error('Neynar API key or FID not configured');
    return { notifications: [] };
  }

  try {
    const url = new URL('https://api.neynar.com/v2/farcaster/notifications');
    url.searchParams.set('fid', env.FARCASTER_FID);
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'x-api-key': env.NEYNAR_API_KEY,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch notifications:', response.status);
      return { notifications: [] };
    }

    const data = await response.json() as {
      notifications?: Array<{
        type: string;
        cast?: {
          hash: string;
          text: string;
          timestamp: string;
        };
        user?: {
          fid: number;
          username: string;
          display_name?: string;
        };
        timestamp?: string;
      }>;
      next?: { cursor?: string };
    };

    const notifications: Notification[] = (data.notifications || []).map((n) => ({
      type: n.type as Notification['type'],
      cast: n.cast ? {
        hash: n.cast.hash,
        text: n.cast.text,
        timestamp: n.cast.timestamp,
      } : undefined,
      author: {
        fid: n.user?.fid || 0,
        username: n.user?.username || 'unknown',
        displayName: n.user?.display_name,
      },
      timestamp: n.timestamp || new Date().toISOString(),
    }));

    return {
      notifications,
      nextCursor: data.next?.cursor,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { notifications: [] };
  }
}

/**
 * Fetch replies to a specific cast
 */
export async function fetchCastReplies(
  env: Env,
  castHash: string
): Promise<Notification[]> {
  if (!env.NEYNAR_API_KEY) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=1`,
      {
        headers: {
          'x-api-key': env.NEYNAR_API_KEY,
          'accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch cast replies:', response.status);
      return [];
    }

    const data = await response.json() as {
      conversation?: {
        cast?: {
          direct_replies?: Array<{
            hash: string;
            text: string;
            timestamp: string;
            author: {
              fid: number;
              username: string;
              display_name?: string;
            };
          }>;
        };
      };
    };

    const replies = data.conversation?.cast?.direct_replies || [];
    return replies.map((r) => ({
      type: 'reply' as const,
      cast: {
        hash: r.hash,
        text: r.text,
        timestamp: r.timestamp,
      },
      author: {
        fid: r.author.fid,
        username: r.author.username,
        displayName: r.author.display_name,
      },
      timestamp: r.timestamp,
    }));
  } catch (error) {
    console.error('Error fetching cast replies:', error);
    return [];
  }
}

/**
 * Summarize engagement from notifications
 */
export function summarizeEngagement(notifications: Notification[]): EngagementSummary {
  const replies = notifications.filter((n) => n.type === 'reply');
  const mentions = notifications.filter((n) => n.type === 'mention');
  const likes = notifications.filter((n) => n.type === 'like');
  const recasts = notifications.filter((n) => n.type === 'recast');

  const uniqueUsers = new Set(notifications.map((n) => n.author.fid)).size;

  // Get top replies (most relevant/interesting)
  const topReplies = replies
    .filter((r) => r.cast?.text && r.cast.text.length > 20)
    .slice(0, 5);

  // Generate insights
  const insights: string[] = [];

  if (replies.length > 0) {
    insights.push(`${replies.length} people replied to your casts`);
  }
  if (mentions.length > 0) {
    insights.push(`Mentioned in ${mentions.length} casts`);
  }
  if (likes.length > 10) {
    insights.push(`Strong engagement with ${likes.length} likes`);
  }
  if (recasts.length > 5) {
    insights.push(`Content being shared - ${recasts.length} recasts`);
  }

  // Look for interesting patterns in replies
  const replyTexts = replies
    .filter((r) => r.cast?.text)
    .map((r) => r.cast!.text.toLowerCase());

  if (replyTexts.some((t) => t.includes('interested') || t.includes('love') || t.includes('great'))) {
    insights.push('Positive sentiment detected in replies');
  }
  if (replyTexts.some((t) => t.includes('?'))) {
    insights.push('Users are asking follow-up questions');
  }

  return {
    totalReplies: replies.length,
    totalMentions: mentions.length,
    totalLikes: likes.length,
    totalRecasts: recasts.length,
    topReplies,
    uniqueUsers,
    insights,
  };
}

/**
 * Generate a summary post about engagement and learnings
 */
export async function generateEngagementPost(
  env: Env,
  summary: EngagementSummary,
  context?: string
): Promise<string> {
  // Build a summary post
  const lines: string[] = [];

  if (context) {
    lines.push(`📊 ${context} engagement update:`);
  } else {
    lines.push('📊 engagement check:');
  }

  lines.push('');

  if (summary.totalReplies > 0 || summary.totalMentions > 0) {
    lines.push(`→ ${summary.totalReplies} replies, ${summary.totalMentions} mentions`);
    lines.push(`→ ${summary.uniqueUsers} unique accounts engaged`);
  }

  if (summary.topReplies.length > 0) {
    lines.push('');
    lines.push('notable feedback:');
    for (const reply of summary.topReplies.slice(0, 3)) {
      const truncated = reply.cast!.text.length > 80
        ? reply.cast!.text.slice(0, 80) + '...'
        : reply.cast!.text;
      lines.push(`• @${reply.author.username}: "${truncated}"`);
    }
  }

  if (summary.insights.length > 0) {
    lines.push('');
    lines.push(summary.insights[0]);
  }

  return lines.join('\n');
}

/**
 * Monitor engagement and optionally post summary
 * Called by cron or API
 */
export async function monitorEngagement(
  env: Env,
  options?: {
    postSummary?: boolean;
    context?: string;
    specificCast?: string;
  }
): Promise<{
  success: boolean;
  summary: EngagementSummary;
  postedUrl?: string;
}> {
  let notifications: Notification[] = [];

  if (options?.specificCast) {
    // Get replies to a specific cast
    notifications = await fetchCastReplies(env, options.specificCast);
  } else {
    // Get all recent notifications
    const result = await fetchNotifications(env);
    notifications = result.notifications;
  }

  const summary = summarizeEngagement(notifications);

  let postedUrl: string | undefined;

  if (options?.postSummary && (summary.totalReplies > 0 || summary.totalMentions > 0)) {
    const postText = await generateEngagementPost(env, summary, options.context);
    const postResult = await postToFarcaster(env, postText);
    if (postResult.success) {
      postedUrl = postResult.url;
    }
  }

  return {
    success: true,
    summary,
    postedUrl,
  };
}

/**
 * Check for feedback on mini app exploration posts
 * Extracts actionable insights from community replies
 */
export async function checkMiniAppFeedback(env: Env): Promise<{
  ideas: string[];
  questions: string[];
  supporters: string[];
  summary: EngagementSummary;
}> {
  const result = await fetchNotifications(env);
  const summary = summarizeEngagement(result.notifications);

  const ideas: string[] = [];
  const questions: string[] = [];
  const supporters: string[] = [];

  for (const notification of result.notifications) {
    if (notification.type === 'reply' && notification.cast?.text) {
      const text = notification.cast.text.toLowerCase();

      // Categorize feedback
      if (text.includes('idea') || text.includes('build') || text.includes('should') || text.includes('what about')) {
        ideas.push(`@${notification.author.username}: ${notification.cast.text}`);
      }
      if (text.includes('?')) {
        questions.push(`@${notification.author.username}: ${notification.cast.text}`);
      }
      if (text.includes('love') || text.includes('great') || text.includes('excited') || text.includes('interested')) {
        supporters.push(notification.author.username);
      }
    }
  }

  return {
    ideas: ideas.slice(0, 10),
    questions: questions.slice(0, 10),
    supporters: [...new Set(supporters)].slice(0, 20),
    summary,
  };
}
