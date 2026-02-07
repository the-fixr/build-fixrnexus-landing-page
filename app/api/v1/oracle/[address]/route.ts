import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { trackApiCall } from '@/lib/track-api-call';
import { verifyApiKey, recordUsage, extractApiKey, isFreeBetaMode } from '@/lib/api-auth';

const PROVIDER = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com');

const PRICE_ORACLE_ABI = [
  'function getLatestPrice() external view returns (uint256)',
  'function getCurrentSubmissionCount() external view returns (uint256)',
  'function priceSubmissions(uint256) external view returns (address validator, uint256 price, uint256 timestamp)',
  'function consensusThreshold() external view returns (uint8)',
  'function updateFrequency() external view returns (uint256)',
  'function lastUpdate() external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
];

/**
 * GET /api/v1/oracle/[address]
 * Fetch oracle data by contract address
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const startTime = Date.now();
  let statusCode = 200;

  try {
    const { address } = await params;

    // Validate address
    if (!ethers.isAddress(address)) {
      statusCode = 400;
      const response = NextResponse.json(
        { error: 'Invalid oracle address' },
        { status: statusCode }
      );

      // Track failed call
      await trackApiCall({
        oracleAddress: address,
        endpoint: `/api/v1/oracle/${address}`,
        statusCode,
        responseTimeMs: Date.now() - startTime,
      });

      return response;
    }

    // Check API key and credits (skipped in free beta mode)
    const apiKey = extractApiKey(request);
    const authResult = await verifyApiKey(apiKey);

    if (!authResult.authorized) {
      statusCode = 402; // Payment Required
      return NextResponse.json(
        {
          error: 'Payment required',
          message: authResult.reason,
          depositUrl: 'https://feeds.review/credits',
        },
        { status: statusCode }
      );
    }

    const oracle = new ethers.Contract(address, PRICE_ORACLE_ABI, PROVIDER);

    // Fetch oracle data in parallel (with error handling for fresh oracles)
    const [
      name,
      symbol,
      latestPrice,
      submissionCount,
      consensusThreshold,
      updateFrequency,
      lastUpdate,
    ] = await Promise.all([
      oracle.name().catch(() => 'Unknown'),
      oracle.symbol().catch(() => 'UNKNOWN'),
      oracle.getLatestPrice().catch(() => BigInt(0)),
      oracle.getCurrentSubmissionCount().catch(() => BigInt(0)),
      oracle.consensusThreshold().catch(() => 66),
      oracle.updateFrequency().catch(() => 3600),
      oracle.lastUpdate().catch(() => 0),
    ]);

    // Fetch individual submissions
    const submissions = [];
    for (let i = 0; i < Number(submissionCount); i++) {
      try {
        const submission = await oracle.priceSubmissions(i);
        submissions.push({
          validator: submission.validator,
          price: submission.price.toString(),
          timestamp: Number(submission.timestamp),
          formattedPrice: ethers.formatUnits(submission.price, 8),
        });
      } catch (e) {
        // Skip if submission doesn't exist
      }
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceUpdate = currentTime - Number(lastUpdate);
    const needsUpdate = timeSinceUpdate >= Number(updateFrequency);

    const responseData = {
      success: true,
      oracle: {
        address,
        name,
        symbol,
        latestPrice: latestPrice.toString(),
        formattedPrice: latestPrice > BigInt(0) ? ethers.formatUnits(latestPrice, 8) : '0',
        consensusThreshold: Number(consensusThreshold),
        updateFrequency: Number(updateFrequency),
        updateFrequencyMinutes: Number(updateFrequency) / 60,
        lastUpdate: Number(lastUpdate),
        lastUpdateDate: lastUpdate > 0 ? new Date(Number(lastUpdate) * 1000).toISOString() : null,
        timeSinceUpdate,
        needsUpdate,
        submissions: {
          count: Number(submissionCount),
          required: Math.ceil((Number(consensusThreshold) / 100) * 5), // Assuming 5 validators
          data: submissions,
        },
      },
    };

    // Track successful call (legacy tracking)
    await trackApiCall({
      oracleAddress: address,
      endpoint: `/api/v1/oracle/${address}`,
      statusCode,
      responseTimeMs: Date.now() - startTime,
    });

    // Record usage for billing (if not in free mode)
    if (apiKey && !authResult.isFreeMode) {
      await recordUsage(apiKey, `/api/v1/oracle/${address}`, address, statusCode, Date.now() - startTime);
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Oracle API error:', error);
    statusCode = 500;

    // Track failed call (best effort - may not have valid address)
    try {
      const { address } = await params;
      if (ethers.isAddress(address)) {
        await trackApiCall({
          oracleAddress: address,
          endpoint: `/api/v1/oracle/${address}`,
          statusCode,
          responseTimeMs: Date.now() - startTime,
        });
      }
    } catch {
      // Ignore tracking errors
    }

    return NextResponse.json(
      { error: 'Failed to fetch oracle data', details: error.message },
      { status: statusCode }
    );
  }
}
