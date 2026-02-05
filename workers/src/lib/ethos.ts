/**
 * Ethos Network API Integration
 *
 * Ethos provides credibility scores for Farcaster users.
 * API docs: https://developers.ethos.network/
 *
 * No API key required - uses X-Ethos-Client header for identification.
 */

const ETHOS_API_URL = 'https://api.ethos.network/api/v2';
const ETHOS_CLIENT = 'fixr-shipyard';

export interface EthosUser {
  id: number;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  score: number;
  level: EthosLevel;
  influenceFactor?: number;
  influenceFactorPercentile?: number;
  xpTotal?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MERGED';
  stats?: {
    vouch: {
      given: { amountWeiTotal: string; count: number };
      received: { amountWeiTotal: string; count: number };
    };
    review: {
      received: { positiveCount: number; negativeCount: number; neutralCount: number };
    };
  };
}

export type EthosLevel =
  | 'untrusted'
  | 'questionable'
  | 'neutral'
  | 'known'
  | 'established'
  | 'reputable'
  | 'exemplary'
  | 'distinguished'
  | 'revered'
  | 'renowned';

export interface EthosScore {
  score: number;
  level: EthosLevel;
}

/**
 * Get Ethos user by Farcaster FID
 */
export async function getEthosUserByFid(fid: number): Promise<EthosUser | null> {
  try {
    const response = await fetch(`${ETHOS_API_URL}/user/by/farcaster/${fid}`, {
      headers: {
        'X-Ethos-Client': ETHOS_CLIENT,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Ethos: No user found for FID ${fid}`);
        return null;
      }
      console.error(`Ethos API error: ${response.status}`);
      return null;
    }

    return await response.json() as EthosUser;
  } catch (error) {
    console.error('Ethos API error:', error);
    return null;
  }
}

/**
 * Get Ethos user by Farcaster username
 */
export async function getEthosUserByUsername(username: string): Promise<EthosUser | null> {
  try {
    const response = await fetch(`${ETHOS_API_URL}/user/by/farcaster/username/${username}`, {
      headers: {
        'X-Ethos-Client': ETHOS_CLIENT,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Ethos: No user found for username ${username}`);
        return null;
      }
      console.error(`Ethos API error: ${response.status}`);
      return null;
    }

    return await response.json() as EthosUser;
  } catch (error) {
    console.error('Ethos API error:', error);
    return null;
  }
}

/**
 * Get Ethos score by userkey (service:farcaster:<fid>)
 */
export async function getEthosScoreByUserkey(userkey: string): Promise<EthosScore | null> {
  try {
    const response = await fetch(
      `${ETHOS_API_URL}/score/userkey?userkey=${encodeURIComponent(userkey)}`,
      {
        headers: {
          'X-Ethos-Client': ETHOS_CLIENT,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error(`Ethos score API error: ${response.status}`);
      return null;
    }

    return await response.json() as EthosScore;
  } catch (error) {
    console.error('Ethos score API error:', error);
    return null;
  }
}

/**
 * Get Ethos score for a Farcaster FID
 */
export async function getEthosScoreByFid(fid: number): Promise<EthosScore | null> {
  return getEthosScoreByUserkey(`service:farcaster:${fid}`);
}

/**
 * Bulk fetch Ethos users by Farcaster FIDs (up to 500)
 */
export async function getEthosUsersByFids(fids: number[]): Promise<Map<number, EthosUser>> {
  const result = new Map<number, EthosUser>();

  if (fids.length === 0) return result;
  if (fids.length > 500) {
    console.warn('Ethos bulk lookup limited to 500 FIDs');
    fids = fids.slice(0, 500);
  }

  try {
    const response = await fetch(`${ETHOS_API_URL}/users/by/farcaster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ethos-Client': ETHOS_CLIENT,
      },
      body: JSON.stringify({ farcasterIds: fids.map(String) }),
    });

    if (!response.ok) {
      console.error(`Ethos bulk API error: ${response.status}`);
      return result;
    }

    const users = await response.json() as EthosUser[];

    for (const user of users) {
      // Extract FID from user data - we need to match it back
      // The response should include user.id or we need to match by username
      if (user.id) {
        result.set(user.id, user);
      }
    }

    return result;
  } catch (error) {
    console.error('Ethos bulk API error:', error);
    return result;
  }
}

/**
 * Bulk fetch Ethos scores by userkeys (up to 500)
 */
export async function getEthosScoresByUserkeys(userkeys: string[]): Promise<Map<string, EthosScore>> {
  const result = new Map<string, EthosScore>();

  if (userkeys.length === 0) return result;
  if (userkeys.length > 500) {
    console.warn('Ethos bulk score lookup limited to 500 userkeys');
    userkeys = userkeys.slice(0, 500);
  }

  try {
    const response = await fetch(`${ETHOS_API_URL}/score/userkeys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ethos-Client': ETHOS_CLIENT,
      },
      body: JSON.stringify({ userkeys }),
    });

    if (!response.ok) {
      console.error(`Ethos bulk score API error: ${response.status}`);
      return result;
    }

    const scores = await response.json() as Record<string, EthosScore>;

    for (const [userkey, score] of Object.entries(scores)) {
      result.set(userkey, score);
    }

    return result;
  } catch (error) {
    console.error('Ethos bulk score API error:', error);
    return result;
  }
}

/**
 * Get Ethos level description
 */
export function getEthosLevelDescription(level: EthosLevel): string {
  const descriptions: Record<EthosLevel, string> = {
    untrusted: 'Untrusted - Very low credibility',
    questionable: 'Questionable - Low credibility',
    neutral: 'Neutral - No reputation established',
    known: 'Known - Basic reputation',
    established: 'Established - Good reputation',
    reputable: 'Reputable - Strong reputation',
    exemplary: 'Exemplary - Excellent reputation',
    distinguished: 'Distinguished - Outstanding reputation',
    revered: 'Revered - Elite reputation',
    renowned: 'Renowned - Legendary reputation',
  };
  return descriptions[level] || level;
}

/**
 * Convert Ethos score (0-2800) to percentage (0-100)
 */
export function ethosScoreToPercent(score: number): number {
  return Math.round((score / 2800) * 100);
}

/**
 * Get color for Ethos level
 */
export function getEthosLevelColor(level: EthosLevel): string {
  const colors: Record<EthosLevel, string> = {
    untrusted: '#ef4444', // red
    questionable: '#f97316', // orange
    neutral: '#6b7280', // gray
    known: '#84cc16', // lime
    established: '#22c55e', // green
    reputable: '#14b8a6', // teal
    exemplary: '#06b6d4', // cyan
    distinguished: '#3b82f6', // blue
    revered: '#8b5cf6', // violet
    renowned: '#d946ef', // fuchsia
  };
  return colors[level] || '#6b7280';
}
