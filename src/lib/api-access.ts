import { NextRequest, NextResponse } from 'next/server';
import {
  getTierInfo,
  TIER_RATE_LIMITS,
  type StakingTier,
  type TierInfo,
} from './staking-tiers';
import { generate402Response, verifyPayment } from './x402-payments';
import { trackApiCall, type ApiCallRecord } from './api-tracking';

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface ApiAccessResult {
  allowed: boolean;
  tier?: StakingTier;
  tierInfo?: TierInfo;
  walletAddress?: string;
  ip?: string;
  remainingRequests?: number;
  paidWithTx?: string;
  response?: NextResponse;
  _startTime?: number;
}

/**
 * Extract wallet address from request headers
 */
function getWalletFromRequest(request: NextRequest): string | null {
  // Check X-Wallet-Address header
  const walletHeader = request.headers.get('X-Wallet-Address');
  if (walletHeader && walletHeader.startsWith('0x')) {
    return walletHeader;
  }

  // Check Authorization header (Bearer <wallet>:<signature>)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const [wallet] = token.split(':');
    if (wallet?.startsWith('0x')) {
      return wallet;
    }
  }

  return null;
}

/**
 * Check rate limit for a wallet/IP
 */
function checkRateLimit(
  identifier: string,
  limit: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  let entry = rateLimitStore.get(identifier);

  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs };
  }

  // Unlimited tier
  if (limit === -1) {
    return { allowed: true, remaining: -1, resetIn: 0 };
  }

  // Check if within limit
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  };
}

/**
 * Main API access middleware
 *
 * x402 Flow:
 * 1. Client makes request
 * 2. If no staking tier / rate limited → return 402 with payment details
 * 3. Client sends USDC to treasury ($0.01)
 * 4. Client retries with X-Payment-TxHash header
 * 5. Server verifies payment, serves content (tx can only be used once)
 */
export async function checkApiAccess(
  request: NextRequest,
  options: {
    requireAuth?: boolean;
    minimumTier?: StakingTier;
    allowPayment?: boolean;
  } = {}
): Promise<ApiAccessResult> {
  const { requireAuth = false, minimumTier = 'FREE', allowPayment = true } = options;

  // Check for x402 payment proof first
  const paymentTxHash = request.headers.get('X-Payment-TxHash');
  if (paymentTxHash) {
    const paymentResult = await verifyPayment(paymentTxHash);
    if (paymentResult.valid) {
      // Payment verified - grant access for this single request
      return { allowed: true, tier: 'FREE', paidWithTx: paymentTxHash };
    }
    // Payment invalid - return error
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'payment_invalid', details: paymentResult.error },
        { status: 402 }
      ),
    };
  }

  // Try to get wallet from request
  const walletAddress = getWalletFromRequest(request);

  // No wallet, no payment
  if (!walletAddress) {
    if (requireAuth) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Wallet authentication required' },
          { status: 401 }
        ),
      };
    }

    // Anonymous access - use IP-based rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(`ip:${ip}`, TIER_RATE_LIMITS.FREE);

    if (!rateCheck.allowed) {
      if (allowPayment) {
        const x402 = generate402Response(
          request.nextUrl.pathname,
          `Rate limit exceeded. Pay $0.01 USDC or stake FIXR for higher limits.`
        );
        return {
          allowed: false,
          response: NextResponse.json(x402.body, {
            status: 402,
            headers: {
              ...x402.headers,
              'Retry-After': rateCheck.resetIn.toString(),
            } as unknown as HeadersInit,
          }),
        };
      }
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Rate limit exceeded', resetIn: rateCheck.resetIn },
          { status: 429, headers: { 'Retry-After': rateCheck.resetIn.toString() } }
        ),
      };
    }

    return {
      allowed: true,
      tier: 'FREE',
      remainingRequests: rateCheck.remaining,
    };
  }

  // Wallet provided - check staking tier
  const tierInfo = await getTierInfo(walletAddress);

  // Check minimum tier requirement
  const tierOrder: StakingTier[] = ['FREE', 'BUILDER', 'PRO', 'ELITE'];
  const userTierIndex = tierOrder.indexOf(tierInfo.tier);
  const requiredTierIndex = tierOrder.indexOf(minimumTier);

  if (userTierIndex < requiredTierIndex) {
    if (allowPayment) {
      const x402 = generate402Response(
        request.nextUrl.pathname,
        `Requires ${minimumTier} tier. Your tier: ${tierInfo.tier}. Pay $0.01 USDC or stake more FIXR.`
      );
      return {
        allowed: false,
        tier: tierInfo.tier,
        tierInfo,
        walletAddress,
        response: NextResponse.json(x402.body, {
          status: 402,
          headers: x402.headers as unknown as HeadersInit,
        }),
      };
    }

    return {
      allowed: false,
      tier: tierInfo.tier,
      tierInfo,
      walletAddress,
      response: NextResponse.json(
        {
          error: 'Insufficient tier',
          required: minimumTier,
          current: tierInfo.tier,
        },
        { status: 403 }
      ),
    };
  }

  // Check rate limit based on tier
  const rateLimit = TIER_RATE_LIMITS[tierInfo.tier];
  const rateCheck = checkRateLimit(`wallet:${walletAddress}`, rateLimit);

  if (!rateCheck.allowed) {
    if (allowPayment) {
      const x402 = generate402Response(
        request.nextUrl.pathname,
        `Rate limit exceeded for ${tierInfo.tier} tier. Pay $0.01 USDC to bypass.`
      );
      return {
        allowed: false,
        tier: tierInfo.tier,
        tierInfo,
        walletAddress,
        response: NextResponse.json(x402.body, {
          status: 429,
          headers: {
            ...x402.headers,
            'Retry-After': rateCheck.resetIn.toString(),
          } as unknown as HeadersInit,
        }),
      };
    }

    return {
      allowed: false,
      tier: tierInfo.tier,
      tierInfo,
      walletAddress,
      response: NextResponse.json(
        {
          error: 'Rate limit exceeded',
          tier: tierInfo.tier,
          limit: rateLimit,
          resetIn: rateCheck.resetIn,
        },
        { status: 429, headers: { 'Retry-After': rateCheck.resetIn.toString() } }
      ),
    };
  }

  return {
    allowed: true,
    tier: tierInfo.tier,
    tierInfo,
    walletAddress,
    remainingRequests: rateCheck.remaining,
  };
}

/**
 * Helper to create tier-gated API response headers
 */
export function createAccessHeaders(result: ApiAccessResult): Record<string, string> {
  const headers: Record<string, string> = {};

  if (result.tier) {
    headers['X-Access-Tier'] = result.tier;
  }
  if (result.remainingRequests !== undefined && result.remainingRequests >= 0) {
    headers['X-RateLimit-Remaining'] = result.remainingRequests.toString();
  }
  if (result.walletAddress) {
    headers['X-Wallet-Verified'] = 'true';
  }
  if (result.paidWithTx) {
    headers['X-Payment-Verified'] = 'true';
  }

  return headers;
}

/**
 * Track API call after processing
 * Call this after your endpoint logic completes
 */
export function trackAccess(
  request: NextRequest,
  accessResult: ApiAccessResult,
  responseStatus: number
): void {
  const now = Date.now();
  const startTime = accessResult._startTime || now;

  const record: ApiCallRecord = {
    timestamp: now,
    endpoint: request.nextUrl.pathname,
    method: request.method,
    wallet: accessResult.walletAddress?.toLowerCase(),
    ip: accessResult.ip,
    tier: accessResult.tier || 'FREE',
    paidWithTx: accessResult.paidWithTx,
    responseStatus,
    responseTimeMs: now - startTime,
  };

  trackApiCall(record);
}

/**
 * Wrapper for API routes that handles access control and tracking
 */
export async function withApiAccess<T>(
  request: NextRequest,
  options: {
    requireAuth?: boolean;
    minimumTier?: StakingTier;
    allowPayment?: boolean;
  },
  handler: (access: ApiAccessResult) => Promise<{ data: T; status?: number } | NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const access = await checkApiAccess(request, options);

  // Store start time and IP for tracking
  access._startTime = startTime;
  access.ip = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined;

  if (!access.allowed && access.response) {
    trackAccess(request, access, access.response.status);
    return access.response;
  }

  try {
    const result = await handler(access);

    if (result instanceof NextResponse) {
      trackAccess(request, access, result.status);
      return result;
    }

    const status = result.status || 200;
    const response = NextResponse.json(result.data, {
      status,
      headers: createAccessHeaders(access),
    });

    trackAccess(request, access, status);
    return response;
  } catch (error) {
    console.error('API handler error:', error);
    trackAccess(request, access, 500);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: createAccessHeaders(access) }
    );
  }
}
