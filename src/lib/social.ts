// Fixr Agent Social Posting
// Posts to X (Twitter) and Farcaster
import crypto from 'crypto';

// Lazy getters for env vars (required for Vercel)
function getXCredentials() {
  return {
    apiKey: process.env.X_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessSecret: process.env.X_ACCESS_SECRET || '',
  };
}

function getFarcasterCredentials() {
  return {
    apiKey: process.env.NEYNAR_API_KEY || '',
    signerUuid: process.env.FARCASTER_SIGNER_UUID || '',
  };
}

export interface PostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  threadHash?: string;  // For tracking conversation threads
}

/**
 * Generate OAuth 1.0a signature for Twitter API
 */
function generateOAuth1Signature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
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
  return crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

/**
 * Post to X (Twitter)
 * Uses OAuth 1.0a User Context for posting
 */
export async function postToX(text: string): Promise<PostResult> {
  const creds = getXCredentials();

  if (!creds.accessToken || !creds.accessSecret || !creds.apiKey || !creds.apiSecret) {
    return { success: false, error: 'X credentials not configured' };
  }

  try {
    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';

    // OAuth 1.0a parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: creds.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: creds.accessToken,
      oauth_version: '1.0',
    };

    // Generate signature
    const signature = generateOAuth1Signature(
      method,
      url,
      oauthParams,
      creds.apiSecret,
      creds.accessSecret
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
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

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
 * @param text - The text content of the cast
 * @param embeds - Optional embeds (URLs)
 * @param replyTo - Optional parent cast hash to reply to (for threaded conversations)
 */
export async function postToFarcaster(
  text: string,
  embeds?: { url: string }[],
  replyTo?: string
): Promise<PostResult> {
  const creds = getFarcasterCredentials();

  if (!creds.apiKey || !creds.signerUuid) {
    return { success: false, error: `Farcaster credentials not configured: apiKey=${!!creds.apiKey}, signerUuid=${!!creds.signerUuid}` };
  }

  try {
    const bodyData: { signer_uuid: string; text: string; embeds?: { url: string }[]; parent?: string } = {
      signer_uuid: creds.signerUuid,
      text,
    };
    // Only include embeds if we have them
    if (embeds && embeds.length > 0) {
      bodyData.embeds = embeds;
    }
    // Include parent for replies
    if (replyTo) {
      bodyData.parent = replyTo;
    }

    console.log('Farcaster post request:', {
      url: 'https://api.neynar.com/v2/farcaster/cast',
      apiKeyPrefix: creds.apiKey.slice(0, 8),
      signerUuidPrefix: creds.signerUuid.slice(0, 8),
      isReply: !!replyTo,
      bodyData,
    });

    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'x-api-key': creds.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    const data = await response.json();
    console.log('Farcaster response:', { status: response.status, ok: response.ok, data });

    if (!response.ok) {
      return {
        success: false,
        error: `${response.status}: ${data.message || data.error || JSON.stringify(data)}`,
      };
    }

    const cast = data.cast;
    const hash = cast?.hash;
    return {
      success: true,
      postId: hash,  // Full hash for matching replies
      url: hash ? `https://warpcast.com/fixr/${hash.slice(0, 10)}` : undefined,
      // Include thread info for conversation tracking
      ...(cast?.thread_hash && { threadHash: cast.thread_hash }),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Post to both platforms
 */
export async function postToBoth(
  text: string,
  farcasterEmbeds?: { url: string }[]
): Promise<{ x: PostResult; farcaster: PostResult }> {
  const [x, farcaster] = await Promise.all([
    postToX(text),
    postToFarcaster(text, farcasterEmbeds),
  ]);

  return { x, farcaster };
}

/**
 * Generate a ship post for completed work
 */
export function generateShipPost(
  projectName: string,
  description: string,
  urls: { repo?: string; deployment?: string; contract?: string }
): string {
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
