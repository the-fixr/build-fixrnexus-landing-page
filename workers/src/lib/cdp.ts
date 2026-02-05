/**
 * Coinbase Developer Platform (CDP) - Onchain Data API Integration
 *
 * Fetches on-chain activity data from Base network for builder scoring.
 * Uses Address History API for transaction data.
 *
 * Docs: https://docs.cdp.coinbase.com/onchain-data/docs/welcome
 */

import { Env } from './types';

// CDP JSON-RPC endpoint - Client API Key is appended to the URL
const CDP_BASE_URL = 'https://api.developer.coinbase.com/rpc/v1/base';

export interface CDPTransaction {
  hash: string;
  blockNumber: number;
  timestamp: string;
  from: string;
  to: string | null;
  value: string;
  gasUsed: string;
  status: 'success' | 'failed';
  contractAddress?: string; // Present if contract creation
}

export interface BaseActivityStats {
  transactionCount: number;
  contractsDeployed: number;
  uniqueContractsInteracted: number;
  totalGasSpent: bigint;
  firstTransactionDate: string | null;
  lastTransactionDate: string | null;
  isEarlyAdopter: boolean; // First tx before Base mainnet launch + 30 days
}

export interface BaseActivityScore {
  score: number; // 0-100
  breakdown: {
    transactionScore: number; // 0-30
    contractDeployScore: number; // 0-40
    diversityScore: number; // 0-15
    longevityScore: number; // 0-15
  };
  stats: BaseActivityStats;
}

/**
 * Get CDP API endpoint URL with Client API Key
 * Client API Keys are embedded directly in the URL for JSON-RPC
 */
function getCDPEndpoint(env: Env): string | null {
  if (!env.CDP_CLIENT_KEY) {
    return null;
  }
  // Client API Key is appended to the base URL
  return `${CDP_BASE_URL}/${env.CDP_CLIENT_KEY}`;
}

/**
 * Generate ES256 JWT for CDP API authentication (for REST endpoints)
 * CDP requires JWTs signed with ES256 algorithm
 * Note: JSON-RPC endpoints use Client API Keys in URL instead
 */
async function generateCDPJWT(env: Env, uri: string): Promise<string | null> {
  if (!env.CDP_KEY_ID || !env.CDP_KEY_SECRET) {
    return null;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', kid: env.CDP_KEY_ID, typ: 'JWT', nonce: crypto.randomUUID() };
    const payload = {
      sub: env.CDP_KEY_ID,
      iss: 'cdp',
      nbf: now,
      exp: now + 120, // 2 minutes expiry
      uri,
    };

    // Base64url encode header and payload
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const message = `${headerB64}.${payloadB64}`;

    // Try to import the secret as an EC key
    // The secret may be in PEM format or raw base64
    let privateKey: CryptoKey;

    // Check if it's a PEM key
    if (env.CDP_KEY_SECRET.includes('-----BEGIN')) {
      // PEM format - extract the base64 content
      const pemContent = env.CDP_KEY_SECRET
        .replace('-----BEGIN EC PRIVATE KEY-----', '')
        .replace('-----END EC PRIVATE KEY-----', '')
        .replace(/\s/g, '');

      const keyData = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        keyData,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
    } else {
      // Raw base64 format - this might be a raw EC private key
      const keyData = Uint8Array.from(atob(env.CDP_KEY_SECRET), c => c.charCodeAt(0));

      // Try importing as raw key (32 bytes for P-256 private key)
      if (keyData.length === 32) {
        // Create a JWK from raw private key
        const jwk = {
          kty: 'EC',
          crv: 'P-256',
          d: btoa(String.fromCharCode(...keyData)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          x: '', // Would need public key components
          y: '',
        };
        // This won't work without public key - skip to fallback
        throw new Error('Raw key format not supported without public key');
      }

      // Try as PKCS8
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        keyData,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
    }

    // Sign the message
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      encoder.encode(message)
    );

    // Convert signature to base64url
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${message}.${signatureB64}`;
  } catch (error) {
    console.error('CDP JWT generation error:', error);
    return null;
  }
}

/**
 * Fetch transaction history for an address on Base
 */
export async function getAddressTransactions(
  env: Env,
  address: string,
  limit: number = 100
): Promise<CDPTransaction[]> {
  const endpoint = getCDPEndpoint(env);
  if (!endpoint) {
    console.warn('CDP credentials not configured');
    return [];
  }

  try {
    // Use CDP's Address History API with Client API Key in URL
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'cdp_listAddressTransactions',
        params: [{
          address: address.toLowerCase(),
          pageSize: limit,
        }],
      }),
    });

    if (!response.ok) {
      console.error('CDP API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json() as {
      result?: {
        addressTransactions?: Array<{
          hash: string;
          blockHeight: string;
          status: string;
          ethereum: {
            from: string;
            to: string | null;
            value: string;
            blockTimestamp: string;
            receipt?: {
              gasUsed: string;
              status: string;
              contractAddress?: string;
            };
            flattenedTraces?: Array<{
              type: string;
              to?: string;
            }>;
          };
        }>;
        // Error response from gRPC
        code?: number;
        message?: string;
      };
      error?: { message: string; code?: number };
    };

    if (data.error) {
      console.error('CDP API error:', data.error.message);
      return [];
    }

    // Check for gRPC error in result (e.g., message size limits)
    if (data.result?.code && data.result?.message) {
      // If the response is too large, try with smaller page size
      if (data.result.code === 8 && data.result.message.includes('message larger than max')) {
        console.warn(`CDP: Response too large for address ${address} (limit ${limit}), trying smaller page size`);
        // Try progressively smaller page sizes for very active addresses
        if (limit > 3) {
          return getAddressTransactions(env, address, 3);
        } else if (limit > 1) {
          return getAddressTransactions(env, address, 1);
        }
      }
      console.error('CDP API gRPC error:', data.result.message);
      return [];
    }

    if (!data.result?.addressTransactions) {
      return [];
    }

    return data.result.addressTransactions.map(tx => {
      const eth = tx.ethereum;
      // Check if this is a contract creation (to is null or contractAddress in receipt)
      const isContractCreation = !eth.to || (eth.receipt?.contractAddress && eth.receipt.contractAddress !== '');

      return {
        hash: tx.hash,
        blockNumber: parseInt(tx.blockHeight),
        timestamp: eth.blockTimestamp,
        from: eth.from,
        to: eth.to,
        value: eth.value,
        gasUsed: eth.receipt?.gasUsed || '0',
        status: (tx.status === 'CONFIRMED' && eth.receipt?.status === '1') ? 'success' as const : 'failed' as const,
        contractAddress: isContractCreation ? (eth.receipt?.contractAddress || eth.to || undefined) : undefined,
      };
    });
  } catch (error) {
    console.error('CDP fetch error:', error);
    return [];
  }
}

/**
 * Calculate Base activity stats from transactions
 */
export function calculateActivityStats(transactions: CDPTransaction[]): BaseActivityStats {
  if (transactions.length === 0) {
    return {
      transactionCount: 0,
      contractsDeployed: 0,
      uniqueContractsInteracted: 0,
      totalGasSpent: BigInt(0),
      firstTransactionDate: null,
      lastTransactionDate: null,
      isEarlyAdopter: false,
    };
  }

  const successfulTxs = transactions.filter(tx => tx.status === 'success');
  const contractDeployments = successfulTxs.filter(tx => tx.contractAddress);
  const uniqueContracts = new Set(
    successfulTxs
      .filter(tx => tx.to)
      .map(tx => tx.to!.toLowerCase())
  );

  let totalGas = BigInt(0);
  for (const tx of successfulTxs) {
    try {
      totalGas += BigInt(tx.gasUsed);
    } catch {
      // Skip invalid gas values
    }
  }

  // Sort by timestamp
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstTxDate = sorted[0]?.timestamp || null;
  const lastTxDate = sorted[sorted.length - 1]?.timestamp || null;

  // Base mainnet launched Aug 9, 2023 - early adopter if first tx within 30 days
  const baseMainnetLaunch = new Date('2023-08-09');
  const earlyAdopterCutoff = new Date('2023-09-09');
  const isEarlyAdopter = firstTxDate
    ? new Date(firstTxDate) <= earlyAdopterCutoff
    : false;

  return {
    transactionCount: successfulTxs.length,
    contractsDeployed: contractDeployments.length,
    uniqueContractsInteracted: uniqueContracts.size,
    totalGasSpent: totalGas,
    firstTransactionDate: firstTxDate,
    lastTransactionDate: lastTxDate,
    isEarlyAdopter,
  };
}

/**
 * Calculate Base activity score (0-100)
 */
export function calculateBaseActivityScore(stats: BaseActivityStats): BaseActivityScore {
  // Transaction score: 0-30 points
  // 0 txs = 0, 10 txs = 10, 50 txs = 20, 100+ txs = 30
  let transactionScore = 0;
  if (stats.transactionCount > 0) {
    transactionScore = Math.min(30, Math.floor(Math.log10(stats.transactionCount + 1) * 15));
  }

  // Contract deployment score: 0-40 points (biggest builder signal)
  // 1 contract = 20, 2 = 30, 3+ = 40
  let contractDeployScore = 0;
  if (stats.contractsDeployed >= 3) {
    contractDeployScore = 40;
  } else if (stats.contractsDeployed === 2) {
    contractDeployScore = 30;
  } else if (stats.contractsDeployed === 1) {
    contractDeployScore = 20;
  }

  // Diversity score: 0-15 points (unique contracts interacted)
  // 5 contracts = 5, 20 contracts = 10, 50+ = 15
  let diversityScore = 0;
  if (stats.uniqueContractsInteracted >= 50) {
    diversityScore = 15;
  } else if (stats.uniqueContractsInteracted >= 20) {
    diversityScore = 10;
  } else if (stats.uniqueContractsInteracted >= 5) {
    diversityScore = 5;
  }

  // Longevity score: 0-15 points
  // Early adopter bonus + account age
  let longevityScore = 0;
  if (stats.isEarlyAdopter) {
    longevityScore = 15; // Max for early Base adopters
  } else if (stats.firstTransactionDate) {
    const ageInDays = Math.floor(
      (Date.now() - new Date(stats.firstTransactionDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    // 30 days = 3, 90 days = 6, 180 days = 9, 365+ days = 12
    longevityScore = Math.min(12, Math.floor(ageInDays / 30) * 3);
  }

  const totalScore = transactionScore + contractDeployScore + diversityScore + longevityScore;

  return {
    score: totalScore,
    breakdown: {
      transactionScore,
      contractDeployScore,
      diversityScore,
      longevityScore,
    },
    stats,
  };
}

/**
 * Get Base activity score for an address
 * Note: Using smaller page size (50) to avoid gRPC size limits on active addresses
 */
export async function getBaseActivityScore(
  env: Env,
  address: string
): Promise<BaseActivityScore | null> {
  try {
    const transactions = await getAddressTransactions(env, address, 50);
    const stats = calculateActivityStats(transactions);
    return calculateBaseActivityScore(stats);
  } catch (error) {
    console.error('Error calculating Base activity score:', error);
    return null;
  }
}

/**
 * Get Base activity for multiple addresses (aggregate for a Farcaster user)
 * Note: Using smaller page size (30) per address to avoid gRPC size limits
 */
export async function getAggregateBaseActivity(
  env: Env,
  addresses: string[]
): Promise<BaseActivityScore | null> {
  if (addresses.length === 0) return null;

  try {
    // Fetch transactions for all addresses (limit per address to avoid gRPC size errors)
    const allTransactions: CDPTransaction[] = [];
    for (const address of addresses.slice(0, 5)) { // Limit to 5 addresses
      const txs = await getAddressTransactions(env, address, 30);
      allTransactions.push(...txs);
    }

    // Deduplicate by hash
    const uniqueTxs = Array.from(
      new Map(allTransactions.map(tx => [tx.hash, tx])).values()
    );

    const stats = calculateActivityStats(uniqueTxs);
    return calculateBaseActivityScore(stats);
  } catch (error) {
    console.error('Error calculating aggregate Base activity:', error);
    return null;
  }
}

/**
 * Daily activity for heatmap visualization
 */
export interface DailyActivity {
  date: string; // YYYY-MM-DD format
  count: number;
  level: 0 | 1 | 2 | 3 | 4; // 0 = no activity, 4 = high activity
}

/**
 * Heatmap data for GitHub-style visualization
 */
export interface ActivityHeatmap {
  days: DailyActivity[];
  totalDays: number;
  activeDays: number;
  maxDailyCount: number;
  streakCurrent: number;
  streakLongest: number;
}

/**
 * Generate heatmap data from transactions
 * Returns last 90 days of activity
 */
export function generateActivityHeatmap(transactions: CDPTransaction[]): ActivityHeatmap {
  const now = new Date();
  const daysToShow = 90; // ~3 months

  // Create a map of date -> transaction count
  const dailyCounts = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.status !== 'success') continue;
    const date = tx.timestamp.split('T')[0]; // Get YYYY-MM-DD
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  }

  // Find max count for level calculation
  const maxCount = Math.max(1, ...Array.from(dailyCounts.values()));

  // Generate last 90 days
  const days: DailyActivity[] = [];
  let activeDays = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = daysToShow - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = dailyCounts.get(dateStr) || 0;

    // Calculate level (0-4) based on activity
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 0) {
      activeDays++;
      const ratio = count / maxCount;
      if (ratio >= 0.75) level = 4;
      else if (ratio >= 0.5) level = 3;
      else if (ratio >= 0.25) level = 2;
      else level = 1;

      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }

    days.push({ date: dateStr, count, level });
  }

  // Calculate current streak (from most recent day going back)
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    days,
    totalDays: daysToShow,
    activeDays,
    maxDailyCount: maxCount,
    streakCurrent: currentStreak,
    streakLongest: longestStreak,
  };
}

/**
 * Get Base activity with heatmap for multiple addresses
 */
export async function getBaseActivityWithHeatmap(
  env: Env,
  addresses: string[]
): Promise<{ score: BaseActivityScore; heatmap: ActivityHeatmap } | null> {
  if (addresses.length === 0) return null;

  try {
    // Fetch transactions for all addresses
    const allTransactions: CDPTransaction[] = [];
    for (const address of addresses.slice(0, 5)) {
      const txs = await getAddressTransactions(env, address, 30);
      allTransactions.push(...txs);
    }

    // Deduplicate by hash
    const uniqueTxs = Array.from(
      new Map(allTransactions.map(tx => [tx.hash, tx])).values()
    );

    const stats = calculateActivityStats(uniqueTxs);
    const score = calculateBaseActivityScore(stats);
    const heatmap = generateActivityHeatmap(uniqueTxs);

    return { score, heatmap };
  } catch (error) {
    console.error('Error getting Base activity with heatmap:', error);
    return null;
  }
}
