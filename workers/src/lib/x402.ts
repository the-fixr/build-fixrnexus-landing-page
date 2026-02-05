/**
 * x402 Payment Client for Neynar API Calls
 * Uses Neynar's managed wallet for gasless USDC micropayments on Base
 *
 * The x402 protocol uses HTTP 402 "Payment Required" responses to enable
 * machine-native micropayments for API access without API keys.
 *
 * Flow:
 * 1. Make API request without API key
 * 2. Receive 402 with payment requirements
 * 3. Request signature from Neynar's managed wallet
 * 4. Retry request with X-PAYMENT header
 *
 * @see https://www.x402.org/
 */

import { Env } from './types';

interface PaymentOption {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
}

interface PaymentRequired {
  x402Version: number;
  accepts: PaymentOption[];
  error?: string;
}

interface X402PaymentRequest {
  paymentOption: PaymentOption;
  originalUrl: string;
  originalBody?: string;
}

/**
 * Check if x402 payments are enabled and configured
 */
export function isX402Enabled(env: Env): boolean {
  return (
    env.USE_X402_PAYMENTS === 'true' &&
    !!env.NEYNAR_API_KEY &&
    !!env.NEYNAR_WALLET_ID
  );
}

/**
 * Parse 402 response to extract payment requirements
 */
async function parsePaymentRequired(response: Response): Promise<PaymentRequired> {
  const json = await response.json();
  return json as PaymentRequired;
}

/**
 * Request signature from Neynar's managed wallet
 */
async function requestNeynarSignature(
  env: Env,
  request: X402PaymentRequest
): Promise<string> {
  if (!env.NEYNAR_API_KEY || !env.NEYNAR_WALLET_ID) {
    throw new Error('Neynar wallet not configured');
  }

  const requestBody = {
    payment_requirements: {
      x402Version: 1,
      accepts: [request.paymentOption],
    },
    request_context: {
      url: request.originalUrl,
      body: request.originalBody ? JSON.parse(request.originalBody) : undefined,
    },
  };

  console.log('x402: Requesting Neynar signature', {
    walletId: env.NEYNAR_WALLET_ID,
    amount: request.paymentOption.maxAmountRequired,
    asset: request.paymentOption.asset,
  });

  const response = await fetch('https://api.neynar.com/v2/signature/x402/', {
    method: 'POST',
    headers: {
      'x-api-key': env.NEYNAR_API_KEY,
      'x-wallet-id': env.NEYNAR_WALLET_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('x402: Neynar signature request failed:', response.status, error);
    throw new Error(`Neynar signature failed: ${response.status}`);
  }

  const signatureData = await response.json();
  console.log('x402: Received Neynar signature');

  // Encode the signature payload as base64 for the X-PAYMENT header
  return btoa(JSON.stringify(signatureData));
}

/**
 * Make an API request with x402 payment handling
 * Automatically handles 402 responses by requesting payment signatures from Neynar
 */
export async function x402Fetch(
  env: Env,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Make initial request (may trigger 402)
  const response = await fetch(url, options);

  // If not 402, return as-is
  if (response.status !== 402) {
    return response;
  }

  console.log('x402: 402 Payment Required - initiating payment flow');

  // Parse payment requirements from 402 response
  const paymentRequired = await parsePaymentRequired(response);

  if (!paymentRequired.accepts || paymentRequired.accepts.length === 0) {
    throw new Error('No payment options in 402 response');
  }

  // Use the first payment option
  const paymentOption = paymentRequired.accepts[0];

  console.log('x402: Payment details', {
    amount: paymentOption.maxAmountRequired,
    recipient: paymentOption.payTo,
    asset: paymentOption.asset,
    network: paymentOption.network,
  });

  // Request signature from Neynar's managed wallet
  const paymentHeader = await requestNeynarSignature(env, {
    paymentOption,
    originalUrl: url,
    originalBody: options.body as string | undefined,
  });

  console.log('x402: Retrying request with X-PAYMENT header');

  // Retry the original request with payment header
  const retryResponse = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-PAYMENT': paymentHeader,
    },
  });

  if (retryResponse.ok) {
    console.log('x402: Payment completed successfully');
  } else {
    console.error('x402: Request failed after payment:', retryResponse.status);
  }

  return retryResponse;
}

/**
 * Get the appropriate fetch function for Neynar API calls
 * Uses x402-wrapped fetch if enabled (handles automatic micropayments)
 * Falls back to regular fetch with API key authentication
 */
export function getNeynarFetch(env: Env): (url: string, options?: RequestInit) => Promise<Response> {
  if (isX402Enabled(env)) {
    return (url: string, options?: RequestInit) => x402Fetch(env, url, options);
  }
  return fetch;
}

/**
 * Fetch user casts from Neynar (uses x402 if enabled)
 */
export async function fetchUserCasts(
  env: Env,
  fid: number,
  limit = 25
): Promise<Array<{ text: string; hash: string; timestamp: string }>> {
  if (!isX402Enabled(env) && !env.NEYNAR_API_KEY) {
    console.warn('x402: Neither x402 payments nor NEYNAR_API_KEY configured');
    return [];
  }

  if (!fid) {
    console.warn('x402: No FID provided');
    return [];
  }

  try {
    const fetchFn = getNeynarFetch(env);
    const headers: Record<string, string> = {
      accept: 'application/json',
    };

    // Only include API key if not using x402
    if (!isX402Enabled(env) && env.NEYNAR_API_KEY) {
      headers['api_key'] = env.NEYNAR_API_KEY;
    }

    const response = await fetchFn(
      `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=${limit}&include_replies=false`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('x402: Neynar API error:', response.status, error);
      return [];
    }

    const data = (await response.json()) as {
      casts?: Array<{ text: string; hash: string; timestamp: string }>;
    };

    return data.casts || [];
  } catch (error) {
    console.error('x402: Failed to fetch casts:', error);
    return [];
  }
}

/**
 * Fetch user profile from Neynar (uses x402 if enabled)
 */
export async function fetchUserProfile(
  env: Env,
  fid: number
): Promise<{
  username: string;
  displayName?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
} | null> {
  if (!isX402Enabled(env) && !env.NEYNAR_API_KEY) {
    return null;
  }

  try {
    const fetchFn = getNeynarFetch(env);
    const headers: Record<string, string> = {
      accept: 'application/json',
    };

    if (!isX402Enabled(env) && env.NEYNAR_API_KEY) {
      headers['api_key'] = env.NEYNAR_API_KEY;
    }

    const response = await fetchFn(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      users?: Array<{
        username: string;
        display_name?: string;
        profile?: { bio?: { text?: string } };
        follower_count?: number;
        following_count?: number;
      }>;
    };

    const user = data.users?.[0];
    if (!user) return null;

    return {
      username: user.username,
      displayName: user.display_name,
      bio: user.profile?.bio?.text,
      followerCount: user.follower_count,
      followingCount: user.following_count,
    };
  } catch (error) {
    console.error('x402: Failed to fetch user profile:', error);
    return null;
  }
}
