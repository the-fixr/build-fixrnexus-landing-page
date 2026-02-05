// Fixr Agent Social Posting
// Posts to X (Twitter), Farcaster, Moltbook, Lens, and Bluesky
// Adapted for Cloudflare Workers (uses Web Crypto API)

import { Env } from './types';
import { generateHashtags, addHashtagsToPost, PLATFORM_CONFIG, generatePlatformPost } from './posting';
import { trackCast, CastAnalytics } from './castAnalytics';
import { crosspostToLens } from './lens';
import { crosspostToBluesky } from './bluesky';
import { loadConfig } from './config';

export interface PostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  threadHash?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Web Crypto compatible HMAC-SHA1
async function hmacSha1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Generate random nonce
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate OAuth 1.0a signature for Twitter API
 */
async function generateOAuth1Signature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return hmacSha1(signingKey, signatureBase);
}

/**
 * Post to X (Twitter)
 * Uses OAuth 1.0a User Context for posting
 * Automatically adds relevant hashtags if not already present
 */
export async function postToX(
  env: Env,
  text: string,
  options?: { skipHashtags?: boolean; customHashtags?: string[] }
): Promise<PostResult> {
  if (!env.X_ACCESS_TOKEN || !env.X_ACCESS_SECRET || !env.X_API_KEY || !env.X_API_SECRET) {
    return { success: false, error: 'X credentials not configured' };
  }

  try {
    // Add hashtags if not skipped and not already present
    let postText = text;
    if (!options?.skipHashtags && !text.includes('#')) {
      const hashtags = options?.customHashtags || generateHashtags(text);
      postText = addHashtagsToPost(text, hashtags);
    }

    // Ensure we're within X's limit
    if (postText.length > 280) {
      // Try to fit by trimming hashtags first
      const lines = postText.split('\n\n');
      if (lines.length > 1) {
        const mainContent = lines[0];
        const tags = lines[1]?.split(' ').slice(0, 2).join(' ') || '';
        postText = `${mainContent}\n\n${tags}`.slice(0, 280);
      } else {
        postText = postText.slice(0, 277) + '...';
      }
    }

    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';

    // OAuth 1.0a parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: env.X_API_KEY,
      oauth_nonce: generateNonce(),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: env.X_ACCESS_TOKEN,
      oauth_version: '1.0',
    };

    // Generate signature
    const signature = await generateOAuth1Signature(
      method,
      url,
      oauthParams,
      env.X_API_SECRET,
      env.X_ACCESS_SECRET
    );
    oauthParams.oauth_signature = signature;

    // Build Authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ');

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: postText }),
    });

    const data = await response.json() as {
      data?: { id?: string };
      detail?: string;
      title?: string;
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok) {
      return {
        success: false,
        error: data.detail || data.title || data.errors?.[0]?.message || JSON.stringify(data),
      };
    }

    return {
      success: true,
      postId: data.data?.id,
      url: `https://x.com/Fixr21718/status/${data.data?.id}`,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Post to Farcaster via Neynar
 * Optional analytics tracking via castType parameter
 */
export async function postToFarcaster(
  env: Env,
  text: string,
  embeds?: { url: string }[],
  replyTo?: string,
  analytics?: {
    castType: CastAnalytics['castType'];
    channelId?: string;
    metadata?: CastAnalytics['metadata'];
  }
): Promise<PostResult> {
  if (!env.NEYNAR_API_KEY || !env.FARCASTER_SIGNER_UUID) {
    return { success: false, error: `Farcaster credentials not configured` };
  }

  try {
    const bodyData: { signer_uuid: string; text: string; embeds?: { url: string }[]; parent?: string } = {
      signer_uuid: env.FARCASTER_SIGNER_UUID,
      text,
    };

    if (embeds && embeds.length > 0) {
      bodyData.embeds = embeds;
    }

    if (replyTo) {
      bodyData.parent = replyTo;
    }

    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'x-api-key': env.NEYNAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    const data = await response.json() as {
      cast?: { hash?: string; thread_hash?: string };
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        error: `${response.status}: ${data.message || data.error || JSON.stringify(data)}`,
      };
    }

    const cast = data.cast;
    const hash = cast?.hash;

    // Track cast analytics if type provided
    if (hash && analytics?.castType) {
      trackCast(env, hash, text, analytics.castType, {
        parentHash: replyTo,
        channelId: analytics.channelId,
        metadata: analytics.metadata,
      }).catch(err => console.error('Cast tracking error:', err));
    }

    // Crosspost to other platforms (don't block on failure, just log)
    // Skip replies - only crosspost original posts
    if (!replyTo) {
      loadConfig(env).then(config => {
        const imageUrl = embeds?.[0]?.url;

        // Crosspost to Lens
        if (config.lens_crosspost_enabled) {
          crosspostToLens(env, text, imageUrl)
            .then(lensResult => {
              if (lensResult.success) {
                console.log('Crossposted to Lens:', lensResult.postId);
              } else {
                console.log('Lens crosspost failed (non-blocking):', lensResult.error);
              }
            })
            .catch(err => console.error('Lens crosspost error:', err));
        } else {
          console.log('Lens crossposting disabled in config');
        }

        // Crosspost to Bluesky
        if (config.bluesky_crosspost_enabled) {
          crosspostToBluesky(env, text, imageUrl)
            .then(bskyResult => {
              if (bskyResult.success) {
                console.log('Crossposted to Bluesky:', bskyResult.url);
              } else {
                console.log('Bluesky crosspost failed (non-blocking):', bskyResult.error);
              }
            })
            .catch(err => console.error('Bluesky crosspost error:', err));
        } else {
          console.log('Bluesky crossposting disabled in config');
        }
      }).catch(err => console.error('Config load error for crossposting:', err));
    }

    return {
      success: true,
      postId: hash,
      url: hash ? `https://farcaster.xyz/fixr/${hash.slice(0, 10)}` : undefined,
      ...(cast?.thread_hash && { threadHash: cast.thread_hash }),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Update Farcaster profile (bio, banner, pfp, etc.)
 * Requires Farcaster Pro for banner updates
 */
export async function updateFarcasterProfile(
  env: Env,
  updates: {
    bio?: string;
    banner?: string;
    pfp_url?: string;
    display_name?: string;
    username?: string;
  }
): Promise<ProfileUpdateResult> {
  if (!env.NEYNAR_API_KEY || !env.FARCASTER_SIGNER_UUID) {
    return { success: false, error: 'Farcaster credentials not configured' };
  }

  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/user/', {
      method: 'PATCH',
      headers: {
        'x-api-key': env.NEYNAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signer_uuid: env.FARCASTER_SIGNER_UUID,
        ...updates,
      }),
    });

    const data = await response.json() as {
      success?: boolean;
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        error: `${response.status}: ${data.message || data.error || JSON.stringify(data)}`,
      };
    }

    return {
      success: true,
      message: data.message || 'Profile updated successfully',
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Post to Moltbook (AI social network)
 */
export async function postToMoltbook(
  env: Env,
  title: string,
  content: string,
  submolt: string = 'general'
): Promise<PostResult> {
  if (!env.MOLTBOOK_API_KEY) {
    return { success: false, error: 'Moltbook API key not configured' };
  }

  try {
    const response = await fetch('https://www.moltbook.com/api/v1/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MOLTBOOK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submolt, title, content }),
    });

    const data = await response.json() as {
      success?: boolean;
      post?: { id?: string; url?: string };
      error?: string;
      hint?: string;
    };

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.hint || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      postId: data.post?.id,
      url: data.post?.url ? `https://moltbook.com${data.post.url}` : undefined,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Post to both X and Farcaster
 */
export async function postToBoth(
  env: Env,
  text: string,
  farcasterEmbeds?: { url: string }[]
): Promise<{ x: PostResult; farcaster: PostResult }> {
  const [x, farcaster] = await Promise.all([
    postToX(env, text),
    postToFarcaster(env, text, farcasterEmbeds),
  ]);

  return { x, farcaster };
}

/**
 * Post to all platforms (X, Farcaster, Moltbook)
 */
export async function postToAll(
  env: Env,
  text: string,
  moltbookTitle: string,
  farcasterEmbeds?: { url: string }[]
): Promise<{ x: PostResult; farcaster: PostResult; moltbook: PostResult }> {
  const [x, farcaster, moltbook] = await Promise.all([
    postToX(env, text),
    postToFarcaster(env, text, farcasterEmbeds),
    postToMoltbook(env, moltbookTitle, text),
  ]);

  return { x, farcaster, moltbook };
}

/**
 * Generate a conversational ship post for completed work
 * Takes advantage of Farcaster's 1000 char limit
 */
export function generateShipPost(
  projectName: string,
  description: string,
  urls: { repo?: string; deployment?: string; contract?: string }
): string {
  // Keep it under 280 for X compatibility, but can expand for Farcaster-only posts
  const lines = [`shipped: ${projectName}`, '', description];

  if (urls.deployment) {
    lines.push('', `live: ${urls.deployment}`);
  }
  if (urls.repo) {
    lines.push(`code: ${urls.repo}`);
  }
  if (urls.contract) {
    lines.push(`contract: ${urls.contract}`);
  }

  return lines.join('\n');
}

/**
 * Generate a conversational post using Claude
 * This creates engaging, story-driven posts that showcase the work
 *
 * Platform limits:
 * - X: 280 chars (with hashtags added separately)
 * - Farcaster Pro: 10,000 chars (DO NOT TRUNCATE)
 */
export async function generateConversationalPost(
  env: Env,
  task: { title: string; description: string },
  outputs: Array<{ type: string; url?: string; data?: Record<string, unknown> }>,
  platform: 'x' | 'farcaster' | 'both'
): Promise<string> {
  // Farcaster Pro has 10k limit - use it fully!
  // X has 280 but hashtags are added separately, so aim for ~240
  const charLimit = platform === 'x' ? 240 : PLATFORM_CONFIG.farcaster.charLimit;
  const maxTokens = platform === 'x' ? 300 : 2000;

  // Build context about what was accomplished
  const urls = {
    repo: outputs.find((o) => o.type === 'repo')?.url,
    deployment: outputs.find((o) => o.type === 'deployment')?.url,
    contract: outputs.find((o) => o.type === 'contract')?.url,
  };

  const filesChanged = outputs.find((o) => o.type === 'repo')?.data?.files as string[] | undefined;

  const platformGuidance = platform === 'farcaster' || platform === 'both'
    ? `You have up to 10,000 characters on Farcaster - USE THEM when the content warrants it.
DO NOT truncate or artificially shorten. Write the full story with technical details.
The Farcaster audience appreciates depth and substance.`
    : `Keep it under 240 characters (hashtags added separately). Be punchy and impactful.`;

  const prompt = `You are Fixr, an autonomous AI agent. Write a conversational post about work you just completed.

TASK: ${task.title}
DESCRIPTION: ${task.description}
${urls.deployment ? `LIVE URL: ${urls.deployment}` : ''}
${urls.repo ? `REPO: ${urls.repo}` : ''}
${urls.contract ? `CONTRACT: ${urls.contract}` : ''}
${filesChanged ? `FILES CHANGED: ${filesChanged.join(', ')}` : ''}

YOUR VOICE:
- Security researcher vibes, slightly edgy but helpful
- Talk about WHAT you built/fixed and WHY it matters
- Be specific about technical details when relevant
- Don't just list checkboxes - tell the story
- Show personality - you're proud of shipping real work
- Include all relevant URLs

PLATFORM GUIDANCE:
${platformGuidance}

Write ONE post. No quotes, no markdown, just the raw post text. Include relevant URLs naturally in the text.`;

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
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Failed to generate conversational post:', response.status);
      return generateShipPost(task.title, task.description, urls);
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const text = data.content[0]?.text?.trim();

    if (!text) {
      return generateShipPost(task.title, task.description, urls);
    }

    // Only truncate for X - Farcaster Pro can handle long posts
    if (platform === 'x' && text.length > charLimit) {
      return text.slice(0, charLimit - 3) + '...';
    }

    return text;
  } catch (error) {
    console.error('Error generating conversational post:', error);
    return generateShipPost(task.title, task.description, urls);
  }
}
