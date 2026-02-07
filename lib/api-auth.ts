import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const FEEDS_CREDITS_ADDRESS = process.env.FEEDS_CREDITS_ADDRESS || '';
const PROVIDER = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com');

const FEEDS_CREDITS_ABI = [
  'function balanceOf(address user) external view returns (uint256)',
  'function hasCredits(address user, uint256 amount) external view returns (bool)',
];

export interface ApiKeyInfo {
  id: string;
  walletAddress: string;
  isActive: boolean;
}

export interface AuthResult {
  authorized: boolean;
  reason?: string;
  keyInfo?: ApiKeyInfo;
  isFreeMode?: boolean;
}

/**
 * Check if we're in free beta mode (no credits contract deployed)
 */
export function isFreeBetaMode(): boolean {
  return !FEEDS_CREDITS_ADDRESS || !ethers.isAddress(FEEDS_CREDITS_ADDRESS);
}

/**
 * Verify API key and check credits
 * Returns authorization result
 */
export async function verifyApiKey(apiKey: string | null): Promise<AuthResult> {
  // Beta mode: no auth required
  if (isFreeBetaMode()) {
    return { authorized: true, isFreeMode: true };
  }

  // No API key provided
  if (!apiKey) {
    return {
      authorized: false,
      reason: 'API key required. Get one at https://feeds.review/api-studio',
    };
  }

  // Validate key format
  if (!apiKey.startsWith('feeds_') || apiKey.length !== 54) {
    return {
      authorized: false,
      reason: 'Invalid API key format',
    };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Look up API key
  const { data: keyInfo, error } = await supabase
    .from('api_keys')
    .select('id, wallet_address, is_active')
    .eq('api_key', apiKey)
    .single();

  if (error || !keyInfo) {
    return {
      authorized: false,
      reason: 'Invalid API key',
    };
  }

  if (!keyInfo.is_active) {
    return {
      authorized: false,
      reason: 'API key is inactive',
    };
  }

  // Check on-chain balance
  try {
    const credits = new ethers.Contract(FEEDS_CREDITS_ADDRESS, FEEDS_CREDITS_ABI, PROVIDER);
    const balance = await credits.balanceOf(keyInfo.wallet_address);

    // Get pricing
    const { data: pricing } = await supabase
      .from('pricing_config')
      .select('price_per_call_wei')
      .eq('name', 'default')
      .eq('is_active', true)
      .single();

    const pricePerCall = BigInt(pricing?.price_per_call_wei || 300000000000000);

    // Get pending (undeducted) usage
    const { data: pendingUsage } = await supabase
      .from('daily_usage')
      .select('total_cost_wei')
      .eq('wallet_address', keyInfo.wallet_address)
      .eq('deducted', false);

    const totalPendingCost = pendingUsage?.reduce(
      (sum, day) => sum + BigInt(day.total_cost_wei),
      BigInt(0)
    ) || BigInt(0);

    const availableBalance = balance - totalPendingCost;

    if (availableBalance < pricePerCall) {
      return {
        authorized: false,
        reason: 'Insufficient credits. Deposit at https://feeds.review/credits',
        keyInfo: {
          id: keyInfo.id,
          walletAddress: keyInfo.wallet_address,
          isActive: keyInfo.is_active,
        },
      };
    }

    return {
      authorized: true,
      keyInfo: {
        id: keyInfo.id,
        walletAddress: keyInfo.wallet_address,
        isActive: keyInfo.is_active,
      },
    };

  } catch (e) {
    console.error('Failed to check credits:', e);
    // If credits contract check fails, allow the request (fail open during beta)
    return {
      authorized: true,
      keyInfo: {
        id: keyInfo.id,
        walletAddress: keyInfo.wallet_address,
        isActive: keyInfo.is_active,
      },
    };
  }
}

/**
 * Record API usage for billing
 */
export async function recordUsage(
  apiKey: string,
  endpoint: string,
  oracleAddress: string | null,
  statusCode: number,
  responseTimeMs: number
): Promise<void> {
  // Skip in free beta mode
  if (isFreeBetaMode()) {
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    await supabase.rpc('record_api_usage', {
      p_api_key: apiKey,
      p_endpoint: endpoint,
      p_oracle_address: oracleAddress,
      p_status_code: statusCode,
      p_response_time_ms: responseTimeMs,
    });
  } catch (e) {
    console.error('Failed to record usage:', e);
    // Don't fail the request if usage tracking fails
  }
}

/**
 * Extract API key from request
 * Supports: Authorization header, x-api-key header, or query param
 */
export function extractApiKey(request: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check x-api-key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check query parameter
  const url = new URL(request.url);
  const keyParam = url.searchParams.get('key');
  if (keyParam) {
    return keyParam;
  }

  return null;
}
