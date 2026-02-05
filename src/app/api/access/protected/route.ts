import { NextRequest } from 'next/server';
import { withApiAccess, trackAccess, checkApiAccess, createAccessHeaders } from '@/lib/api-access';

/**
 * GET /api/access/protected
 * Example of a tier-gated endpoint with automatic tracking
 *
 * Headers:
 *   X-Wallet-Address: 0x... (wallet address)
 *   OR
 *   Authorization: Bearer 0x...:signature (wallet:signature)
 *   OR
 *   X-Payment-TxHash: 0x... (payment transaction hash)
 */
export async function GET(request: NextRequest) {
  return withApiAccess(
    request,
    { minimumTier: 'BUILDER', allowPayment: true },
    async (access) => ({
      data: {
        success: true,
        message: 'Welcome to the protected API',
        accessInfo: {
          tier: access.tier,
          wallet: access.walletAddress,
          remainingRequests: access.remainingRequests,
          paidWithTx: access.paidWithTx,
        },
        data: {
          secret: 'This is protected data only for BUILDER+ tiers',
          timestamp: new Date().toISOString(),
        },
      },
    })
  );
}

/**
 * POST /api/access/protected
 * Example with manual tracking (alternative approach)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const access = await checkApiAccess(request, {
    minimumTier: 'PRO',
    allowPayment: true,
  });

  // Store timing info
  access._startTime = startTime;
  access.ip = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined;

  if (!access.allowed) {
    trackAccess(request, access, access.response!.status);
    return access.response!;
  }

  try {
    const body = await request.json();

    const response = {
      success: true,
      message: 'PRO-tier operation completed',
      tier: access.tier,
      input: body,
      result: 'Your premium operation result',
    };

    trackAccess(request, access, 200);
    return Response.json(response, {
      headers: createAccessHeaders(access),
    });
  } catch (error) {
    trackAccess(request, access, 500);
    throw error;
  }
}
