/**
 * Bluesky/AT Protocol Integration
 * Posts to Bluesky via AT Protocol (app.bsky.feed.post)
 * Uses app passwords for authentication
 */

import { Env } from './types';
import { PostResult } from './social';

const BSKY_SERVICE = 'https://bsky.social';

interface BlueskySession {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
}

// Session cache to avoid repeated logins
let sessionCache: BlueskySession | null = null;
let sessionCacheTime = 0;
const SESSION_CACHE_TTL = 1800000; // 30 minutes

/**
 * Create a session with Bluesky using app password
 */
async function createSession(env: Env): Promise<BlueskySession | null> {
  if (!env.BLUESKY_HANDLE || !env.BLUESKY_APP_PASSWORD) {
    console.error('Bluesky credentials not configured');
    return null;
  }

  // Return cached session if still valid
  const now = Date.now();
  if (sessionCache && (now - sessionCacheTime) < SESSION_CACHE_TTL) {
    return sessionCache;
  }

  try {
    const response = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: env.BLUESKY_HANDLE,
        password: env.BLUESKY_APP_PASSWORD,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string; error?: string };
      console.error('Bluesky session creation failed:', error);
      return null;
    }

    const data = await response.json() as BlueskySession;

    // Cache the session
    sessionCache = data;
    sessionCacheTime = now;

    return data;
  } catch (error) {
    console.error('Bluesky session error:', error);
    return null;
  }
}

/**
 * Parse facets (mentions, links, hashtags) from text
 * Bluesky requires explicit facets for rich text
 */
function parseFacets(text: string): Array<{
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: string; uri?: string; tag?: string }>;
}> {
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: string; uri?: string; tag?: string }>;
  }> = [];

  // Find URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[1];
    // Remove trailing punctuation that might have been captured
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
    const byteStart = new TextEncoder().encode(text.slice(0, match.index)).length;
    const byteEnd = byteStart + new TextEncoder().encode(cleanUrl).length;

    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: cleanUrl }],
    });
  }

  // Find hashtags
  const hashtagRegex = /#(\w+)/g;
  while ((match = hashtagRegex.exec(text)) !== null) {
    const byteStart = new TextEncoder().encode(text.slice(0, match.index)).length;
    const byteEnd = byteStart + new TextEncoder().encode(match[0]).length;

    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: match[1] }],
    });
  }

  return facets;
}

/**
 * Post to Bluesky
 * Character limit: 300 graphemes
 */
export async function postToBluesky(
  env: Env,
  text: string,
  options?: {
    replyTo?: { uri: string; cid: string };
    embed?: { url: string; title?: string; description?: string };
  }
): Promise<PostResult> {
  if (!env.BLUESKY_HANDLE || !env.BLUESKY_APP_PASSWORD) {
    return { success: false, error: 'Bluesky credentials not configured' };
  }

  try {
    const session = await createSession(env);
    if (!session) {
      return { success: false, error: 'Failed to create Bluesky session' };
    }

    // Bluesky has a 300 grapheme limit
    let postText = text;
    if (postText.length > 300) {
      postText = postText.slice(0, 297) + '...';
    }

    // Build the post record
    const record: {
      $type: string;
      text: string;
      createdAt: string;
      facets?: Array<{
        index: { byteStart: number; byteEnd: number };
        features: Array<{ $type: string; uri?: string; tag?: string }>;
      }>;
      reply?: {
        root: { uri: string; cid: string };
        parent: { uri: string; cid: string };
      };
      embed?: {
        $type: string;
        external: {
          uri: string;
          title: string;
          description: string;
        };
      };
    } = {
      $type: 'app.bsky.feed.post',
      text: postText,
      createdAt: new Date().toISOString(),
    };

    // Parse and add facets for rich text
    const facets = parseFacets(postText);
    if (facets.length > 0) {
      record.facets = facets;
    }

    // Add reply reference if replying
    if (options?.replyTo) {
      record.reply = {
        root: options.replyTo,
        parent: options.replyTo,
      };
    }

    // Add embed if provided
    if (options?.embed) {
      record.embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: options.embed.url,
          title: options.embed.title || '',
          description: options.embed.description || '',
        },
      };
    }

    const response = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { message?: string; error?: string };
      return {
        success: false,
        error: `${response.status}: ${error.message || error.error || JSON.stringify(error)}`,
      };
    }

    const data = await response.json() as { uri: string; cid: string };

    // Extract the post ID (rkey) from the URI
    // Format: at://did:plc:xxx/app.bsky.feed.post/rkey
    const rkey = data.uri.split('/').pop();

    return {
      success: true,
      postId: data.uri,
      url: `https://bsky.app/profile/${session.handle}/post/${rkey}`,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Crosspost content from Farcaster to Bluesky
 * Adds attribution and respects character limits
 */
export async function crosspostToBluesky(
  env: Env,
  text: string,
  imageUrl?: string
): Promise<PostResult> {
  // Add attribution
  const attribution = '\n\n🔄 via @fixr on Farcaster';
  const maxTextLength = 300 - attribution.length;

  let postText = text;
  if (postText.length > maxTextLength) {
    postText = postText.slice(0, maxTextLength - 3) + '...';
  }
  postText += attribution;

  return postToBluesky(env, postText, imageUrl ? {
    embed: {
      url: imageUrl,
      title: 'Image from Farcaster',
      description: '',
    },
  } : undefined);
}

/**
 * Clear the session cache (force re-authentication)
 */
export function clearBlueskySession(): void {
  sessionCache = null;
  sessionCacheTime = 0;
}
