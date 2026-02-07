import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { trackApiCall } from '@/lib/track-api-call';

const PROVIDER = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com');

const FARCASTER_ORACLE_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function targetToken() external view returns (string)',
  'function consensusThreshold() external view returns (uint8)',
  'function updateFrequency() external view returns (uint256)',
  'function lastUpdate() external view returns (uint256)',
  'function getLatestMetrics() external view returns (tuple(uint256 mentions24h, int256 sentimentScore, uint256 engagementRate, uint256 uniqueUsers, uint256 totalEngagement, uint256 topCastFid, uint256 timestamp))',
  'function getCurrentSubmissionCount() external view returns (uint256)',
  'function currentSubmissions(uint256) external view returns (tuple(address validator, tuple(uint256 mentions24h, int256 sentimentScore, uint256 engagementRate, uint256 uniqueUsers, uint256 totalEngagement, uint256 topCastFid, uint256 timestamp) metrics, uint256 timestamp, bool processed))',
];

/**
 * GET /api/v1/farcaster/[address]
 * Fetch Farcaster oracle social metrics by contract address
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

      await trackApiCall({
        oracleAddress: address,
        endpoint: `/api/v1/farcaster/${address}`,
        statusCode,
        responseTimeMs: Date.now() - startTime,
      });

      return response;
    }

    const oracle = new ethers.Contract(address, FARCASTER_ORACLE_ABI, PROVIDER);

    // Fetch oracle configuration and data
    const [
      name,
      symbol,
      targetToken,
      consensusThreshold,
      updateFrequency,
      lastUpdate,
      latestMetrics,
      submissionCount,
    ] = await Promise.all([
      oracle.name().catch(() => 'Unknown'),
      oracle.symbol().catch(() => 'UNKNOWN'),
      oracle.targetToken().catch(() => ''),
      oracle.consensusThreshold().catch(() => 66),
      oracle.updateFrequency().catch(() => 3600),
      oracle.lastUpdate().catch(() => 0),
      oracle.getLatestMetrics().catch(() => ({
        mentions24h: BigInt(0),
        sentimentScore: BigInt(0),
        engagementRate: BigInt(0),
        uniqueUsers: BigInt(0),
        totalEngagement: BigInt(0),
        topCastFid: BigInt(0),
        timestamp: BigInt(0),
      })),
      oracle.getCurrentSubmissionCount().catch(() => BigInt(0)),
    ]);

    // Fetch individual submissions
    const submissions = [];
    for (let i = 0; i < Number(submissionCount); i++) {
      try {
        const submission = await oracle.currentSubmissions(i);
        submissions.push({
          validator: submission.validator,
          metrics: {
            mentions24h: Number(submission.metrics.mentions24h),
            sentimentScore: Number(submission.metrics.sentimentScore),
            sentimentLabel: getSentimentLabel(Number(submission.metrics.sentimentScore)),
            engagementRate: Number(submission.metrics.engagementRate),
            engagementRatePercent: `${(Number(submission.metrics.engagementRate) / 100).toFixed(2)}%`,
            uniqueUsers: Number(submission.metrics.uniqueUsers),
            totalEngagement: Number(submission.metrics.totalEngagement),
            topCastFid: Number(submission.metrics.topCastFid),
            timestamp: Number(submission.metrics.timestamp),
          },
          timestamp: Number(submission.timestamp),
          processed: submission.processed,
        });
      } catch (e) {
        // Skip if submission doesn't exist
      }
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceUpdate = currentTime - Number(lastUpdate);
    const needsUpdate = timeSinceUpdate >= Number(updateFrequency);

    // Format latest metrics
    const formattedMetrics = {
      mentions24h: Number(latestMetrics.mentions24h),
      sentimentScore: Number(latestMetrics.sentimentScore),
      sentimentLabel: getSentimentLabel(Number(latestMetrics.sentimentScore)),
      engagementRate: Number(latestMetrics.engagementRate),
      engagementRatePercent: `${(Number(latestMetrics.engagementRate) / 100).toFixed(2)}%`,
      uniqueUsers: Number(latestMetrics.uniqueUsers),
      totalEngagement: Number(latestMetrics.totalEngagement),
      topCastFid: Number(latestMetrics.topCastFid),
      timestamp: Number(latestMetrics.timestamp),
      timestampDate: latestMetrics.timestamp > 0 ? new Date(Number(latestMetrics.timestamp) * 1000).toISOString() : null,
    };

    const responseData = {
      success: true,
      oracle: {
        address,
        name,
        symbol,
        targetToken,
        consensusThreshold: Number(consensusThreshold),
        updateFrequency: Number(updateFrequency),
        updateFrequencyMinutes: Number(updateFrequency) / 60,
        lastUpdate: Number(lastUpdate),
        lastUpdateDate: lastUpdate > 0 ? new Date(Number(lastUpdate) * 1000).toISOString() : null,
        timeSinceUpdate,
        needsUpdate,
        latestMetrics: formattedMetrics,
        submissions: {
          count: Number(submissionCount),
          required: Math.ceil((Number(consensusThreshold) / 100) * 5), // Assuming 5 validators
          data: submissions,
        },
      },
    };

    // Track successful call
    await trackApiCall({
      oracleAddress: address,
      endpoint: `/api/v1/farcaster/${address}`,
      statusCode,
      responseTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Farcaster Oracle API error:', error);
    statusCode = 500;

    // Track failed call
    try {
      const { address } = await params;
      if (ethers.isAddress(address)) {
        await trackApiCall({
          oracleAddress: address,
          endpoint: `/api/v1/farcaster/${address}`,
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

/**
 * Helper function to get sentiment label from score
 * Score range: -10000 to +10000
 */
function getSentimentLabel(score: number): string {
  if (score >= 5000) return 'Very Positive';
  if (score >= 2000) return 'Positive';
  if (score >= 500) return 'Slightly Positive';
  if (score >= -500) return 'Neutral';
  if (score >= -2000) return 'Slightly Negative';
  if (score >= -5000) return 'Negative';
  return 'Very Negative';
}
