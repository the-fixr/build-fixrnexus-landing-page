/**
 * GeckoTerminal API Integration for Token Analysis
 * Provides on-chain DEX data, prices, pools, and OHLCV charts
 *
 * Rate limit: 30 requests/minute (free tier)
 * Docs: https://apiguide.geckoterminal.com/
 *
 * NOTE: This is for RESEARCH and ANALYSIS only.
 * Fixr will NOT create tokens under any circumstances before 2/28/2026.
 */

const GECKO_BASE_URL = 'https://api.geckoterminal.com/api/v2';

// Network IDs for common chains
export const NETWORK_IDS: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  solana: 'solana',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon: 'polygon_pos',
  avalanche: 'avax',
  bsc: 'bsc',
  fantom: 'ftm',
  monad: 'monad', // May not be available yet
};

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
  priceUsd?: string;
  fdvUsd?: string;
  marketCapUsd?: string;
  volume24h?: string;
  priceChange24h?: number;
  imageUrl?: string;
}

export interface PoolInfo {
  address: string;
  name: string;
  dex: string;
  baseToken: {
    address: string;
    symbol: string;
    name: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
    name: string;
  };
  priceUsd?: string;
  priceNative?: string;
  volume24h?: string;
  reserveUsd?: string;
  fdvUsd?: string;
  priceChange24h?: number;
  txns24h?: {
    buys: number;
    sells: number;
  };
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TrendingPool {
  address: string;
  name: string;
  priceUsd: string;
  priceChange24h: number;
  volume24h: string;
  dex: string;
}

export interface TokenAnalysis {
  token: TokenInfo | null;
  topPools: PoolInfo[];
  trending: boolean;
  summary: string;
  warnings: string[];
}

/**
 * Fetch token info by address
 */
export async function getTokenInfo(
  network: string,
  tokenAddress: string
): Promise<TokenInfo | null> {
  const networkId = NETWORK_IDS[network.toLowerCase()] || network;

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${networkId}/tokens/${tokenAddress}`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    if (!response.ok) {
      console.error(`GeckoTerminal token fetch failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      data?: {
        attributes?: {
          address?: string;
          name?: string;
          symbol?: string;
          decimals?: number;
          total_supply?: string;
          price_usd?: string;
          fdv_usd?: string;
          market_cap_usd?: string;
          volume_usd?: { h24?: string };
          price_change_percentage?: { h24?: number };
          image_url?: string;
        };
      };
    };

    const attrs = data.data?.attributes;
    if (!attrs) return null;

    return {
      address: attrs.address || tokenAddress,
      name: attrs.name || 'Unknown',
      symbol: attrs.symbol || '???',
      decimals: attrs.decimals || 18,
      totalSupply: attrs.total_supply,
      priceUsd: attrs.price_usd,
      fdvUsd: attrs.fdv_usd,
      marketCapUsd: attrs.market_cap_usd,
      volume24h: attrs.volume_usd?.h24,
      priceChange24h: attrs.price_change_percentage?.h24,
      imageUrl: attrs.image_url,
    };
  } catch (error) {
    console.error('GeckoTerminal token fetch error:', error);
    return null;
  }
}

/**
 * Fetch top pools for a token
 */
export async function getTokenPools(
  network: string,
  tokenAddress: string,
  limit = 5
): Promise<PoolInfo[]> {
  const networkId = NETWORK_IDS[network.toLowerCase()] || network;

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${networkId}/tokens/${tokenAddress}/pools?page=1`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    if (!response.ok) {
      console.error(`GeckoTerminal pools fetch failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      data?: Array<{
        attributes?: {
          address?: string;
          name?: string;
          base_token_price_usd?: string;
          base_token_price_native_currency?: string;
          volume_usd?: { h24?: string };
          reserve_in_usd?: string;
          fdv_usd?: string;
          price_change_percentage?: { h24?: number };
          transactions?: { h24?: { buys?: number; sells?: number } };
        };
        relationships?: {
          base_token?: { data?: { id?: string } };
          quote_token?: { data?: { id?: string } };
          dex?: { data?: { id?: string } };
        };
      }>;
      included?: Array<{
        id?: string;
        type?: string;
        attributes?: {
          address?: string;
          symbol?: string;
          name?: string;
        };
      }>;
    };

    const pools: PoolInfo[] = [];
    const included = data.included || [];

    for (const pool of (data.data || []).slice(0, limit)) {
      const attrs = pool.attributes;
      if (!attrs) continue;

      // Find token info from included
      const baseTokenId = pool.relationships?.base_token?.data?.id;
      const quoteTokenId = pool.relationships?.quote_token?.data?.id;
      const dexId = pool.relationships?.dex?.data?.id;

      const baseTokenData = included.find((i) => i.id === baseTokenId);
      const quoteTokenData = included.find((i) => i.id === quoteTokenId);

      pools.push({
        address: attrs.address || '',
        name: attrs.name || 'Unknown Pool',
        dex: dexId?.split('_').pop() || 'Unknown DEX',
        baseToken: {
          address: baseTokenData?.attributes?.address || '',
          symbol: baseTokenData?.attributes?.symbol || '???',
          name: baseTokenData?.attributes?.name || 'Unknown',
        },
        quoteToken: {
          address: quoteTokenData?.attributes?.address || '',
          symbol: quoteTokenData?.attributes?.symbol || '???',
          name: quoteTokenData?.attributes?.name || 'Unknown',
        },
        priceUsd: attrs.base_token_price_usd,
        priceNative: attrs.base_token_price_native_currency,
        volume24h: attrs.volume_usd?.h24,
        reserveUsd: attrs.reserve_in_usd,
        fdvUsd: attrs.fdv_usd,
        priceChange24h: attrs.price_change_percentage?.h24,
        txns24h: attrs.transactions?.h24
          ? {
              buys: attrs.transactions.h24.buys || 0,
              sells: attrs.transactions.h24.sells || 0,
            }
          : undefined,
      });
    }

    return pools;
  } catch (error) {
    console.error('GeckoTerminal pools fetch error:', error);
    return [];
  }
}

/**
 * Fetch OHLCV data for a pool
 */
export async function getPoolOHLCV(
  network: string,
  poolAddress: string,
  timeframe: 'day' | 'hour' | 'minute' = 'hour',
  aggregate = 1,
  limit = 100
): Promise<OHLCVData[]> {
  const networkId = NETWORK_IDS[network.toLowerCase()] || network;

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${networkId}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    if (!response.ok) {
      console.error(`GeckoTerminal OHLCV fetch failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      data?: {
        attributes?: {
          ohlcv_list?: Array<[number, number, number, number, number, number]>;
        };
      };
    };

    const ohlcvList = data.data?.attributes?.ohlcv_list || [];

    return ohlcvList.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    }));
  } catch (error) {
    console.error('GeckoTerminal OHLCV fetch error:', error);
    return [];
  }
}

/**
 * Fetch trending pools on a network
 */
export async function getTrendingPools(
  network: string,
  limit = 10
): Promise<TrendingPool[]> {
  const networkId = NETWORK_IDS[network.toLowerCase()] || network;

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${networkId}/trending_pools`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    if (!response.ok) {
      console.error(`GeckoTerminal trending fetch failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      data?: Array<{
        attributes?: {
          address?: string;
          name?: string;
          base_token_price_usd?: string;
          price_change_percentage?: { h24?: number };
          volume_usd?: { h24?: string };
        };
        relationships?: {
          dex?: { data?: { id?: string } };
        };
      }>;
    };

    return (data.data || []).slice(0, limit).map((pool) => {
      const attrs = pool.attributes;
      return {
        address: attrs?.address || '',
        name: attrs?.name || 'Unknown',
        priceUsd: attrs?.base_token_price_usd || '0',
        priceChange24h: attrs?.price_change_percentage?.h24 || 0,
        volume24h: attrs?.volume_usd?.h24 || '0',
        dex: pool.relationships?.dex?.data?.id?.split('_').pop() || 'Unknown',
      };
    });
  } catch (error) {
    console.error('GeckoTerminal trending fetch error:', error);
    return [];
  }
}

/**
 * Search for pools by query
 */
export async function searchPools(
  query: string,
  network?: string
): Promise<PoolInfo[]> {
  try {
    let url = `${GECKO_BASE_URL}/search/pools?query=${encodeURIComponent(query)}`;
    if (network) {
      const networkId = NETWORK_IDS[network.toLowerCase()] || network;
      url += `&network=${networkId}`;
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(`GeckoTerminal search failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      data?: Array<{
        attributes?: {
          address?: string;
          name?: string;
          base_token_price_usd?: string;
          volume_usd?: { h24?: string };
          reserve_in_usd?: string;
          price_change_percentage?: { h24?: number };
        };
        relationships?: {
          base_token?: { data?: { id?: string } };
          quote_token?: { data?: { id?: string } };
          dex?: { data?: { id?: string } };
          network?: { data?: { id?: string } };
        };
      }>;
    };

    return (data.data || []).slice(0, 10).map((pool) => {
      const attrs = pool.attributes;
      return {
        address: attrs?.address || '',
        name: attrs?.name || 'Unknown',
        dex: pool.relationships?.dex?.data?.id?.split('_').pop() || 'Unknown',
        baseToken: { address: '', symbol: '???', name: 'Unknown' },
        quoteToken: { address: '', symbol: '???', name: 'Unknown' },
        priceUsd: attrs?.base_token_price_usd,
        volume24h: attrs?.volume_usd?.h24,
        reserveUsd: attrs?.reserve_in_usd,
        priceChange24h: attrs?.price_change_percentage?.h24,
      };
    });
  } catch (error) {
    console.error('GeckoTerminal search error:', error);
    return [];
  }
}

/**
 * Get new pools on a network
 */
export async function getNewPools(network: string, limit = 10): Promise<PoolInfo[]> {
  const networkId = NETWORK_IDS[network.toLowerCase()] || network;

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${networkId}/new_pools`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    if (!response.ok) {
      console.error(`GeckoTerminal new pools fetch failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      data?: Array<{
        attributes?: {
          address?: string;
          name?: string;
          base_token_price_usd?: string;
          volume_usd?: { h24?: string };
          reserve_in_usd?: string;
          pool_created_at?: string;
        };
        relationships?: {
          dex?: { data?: { id?: string } };
        };
      }>;
    };

    return (data.data || []).slice(0, limit).map((pool) => {
      const attrs = pool.attributes;
      return {
        address: attrs?.address || '',
        name: attrs?.name || 'Unknown',
        dex: pool.relationships?.dex?.data?.id?.split('_').pop() || 'Unknown',
        baseToken: { address: '', symbol: '???', name: 'Unknown' },
        quoteToken: { address: '', symbol: '???', name: 'Unknown' },
        priceUsd: attrs?.base_token_price_usd,
        volume24h: attrs?.volume_usd?.h24,
        reserveUsd: attrs?.reserve_in_usd,
      };
    });
  } catch (error) {
    console.error('GeckoTerminal new pools fetch error:', error);
    return [];
  }
}

/**
 * Comprehensive token analysis
 */
export async function analyzeToken(
  network: string,
  tokenAddress: string
): Promise<TokenAnalysis> {
  const warnings: string[] = [];

  // Fetch token info and pools in parallel
  const [token, pools, trending] = await Promise.all([
    getTokenInfo(network, tokenAddress),
    getTokenPools(network, tokenAddress, 5),
    getTrendingPools(network, 20),
  ]);

  // Check if token is trending
  const isTrending = trending.some(
    (p) =>
      p.name.toLowerCase().includes(token?.symbol?.toLowerCase() || '') ||
      p.address.toLowerCase() === tokenAddress.toLowerCase()
  );

  // Generate warnings
  if (!token) {
    warnings.push('Token not found or not indexed yet');
  } else {
    if (!token.priceUsd || parseFloat(token.priceUsd) === 0) {
      warnings.push('No price data available - low liquidity or new token');
    }
    if (pools.length === 0) {
      warnings.push('No liquidity pools found');
    }
    if (pools.length === 1) {
      warnings.push('Only one liquidity pool - limited trading options');
    }

    // Check for low liquidity
    const totalLiquidity = pools.reduce(
      (sum, p) => sum + parseFloat(p.reserveUsd || '0'),
      0
    );
    if (totalLiquidity < 10000) {
      warnings.push(`Low total liquidity: $${totalLiquidity.toFixed(2)}`);
    }

    // Check volume
    const totalVolume = pools.reduce(
      (sum, p) => sum + parseFloat(p.volume24h || '0'),
      0
    );
    if (totalVolume < 1000) {
      warnings.push(`Very low 24h volume: $${totalVolume.toFixed(2)}`);
    }
  }

  // Generate summary
  let summary = '';
  if (token) {
    const price = token.priceUsd ? `$${parseFloat(token.priceUsd).toFixed(8)}` : 'N/A';
    const change = token.priceChange24h
      ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`
      : 'N/A';
    const fdv = token.fdvUsd
      ? `$${(parseFloat(token.fdvUsd) / 1e6).toFixed(2)}M`
      : 'N/A';
    const vol = token.volume24h
      ? `$${(parseFloat(token.volume24h) / 1e3).toFixed(1)}K`
      : 'N/A';

    summary = `${token.name} (${token.symbol}): ${price} (${change} 24h), FDV: ${fdv}, Vol: ${vol}`;
    if (isTrending) summary += ' 🔥 TRENDING';
    if (pools.length > 0) {
      summary += ` | ${pools.length} pool(s) on ${[...new Set(pools.map((p) => p.dex))].join(', ')}`;
    }
  } else {
    summary = 'Token not found on GeckoTerminal';
  }

  return {
    token,
    topPools: pools,
    trending: isTrending,
    summary,
    warnings,
  };
}

/**
 * Format token analysis for Farcaster response (short)
 */
export function formatTokenAnalysisShort(analysis: TokenAnalysis): string {
  if (!analysis.token) {
    return "couldn't find that token on geckoterminal. might be too new or not indexed yet.";
  }

  const { token, topPools, trending, warnings } = analysis;
  const lines: string[] = [];

  // Price and change
  const price = token.priceUsd ? `$${parseFloat(token.priceUsd).toFixed(6)}` : 'no price';
  const change = token.priceChange24h
    ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}%`
    : '';

  lines.push(`${token.symbol}: ${price} ${change}${trending ? ' 🔥' : ''}`);

  // Quick stats
  const stats: string[] = [];
  if (token.fdvUsd) {
    const fdv = parseFloat(token.fdvUsd);
    stats.push(`FDV: $${fdv >= 1e6 ? (fdv / 1e6).toFixed(1) + 'M' : (fdv / 1e3).toFixed(0) + 'K'}`);
  }
  if (token.volume24h) {
    const vol = parseFloat(token.volume24h);
    stats.push(`Vol: $${vol >= 1e6 ? (vol / 1e6).toFixed(1) + 'M' : (vol / 1e3).toFixed(0) + 'K'}`);
  }
  if (stats.length > 0) lines.push(stats.join(' | '));

  // Top pool
  if (topPools.length > 0) {
    const pool = topPools[0];
    lines.push(`top pool: ${pool.name} on ${pool.dex}`);
  }

  // Key warning
  if (warnings.length > 0) {
    lines.push(`⚠️ ${warnings[0]}`);
  }

  return lines.join('\n');
}
