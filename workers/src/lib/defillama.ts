// DeFi Llama API Integration
// Free API - No API key required for basic endpoints
// Documentation: https://defillama.com/docs/api

import { Env } from './types';

// Base URLs
const LLAMA_API_BASE = 'https://api.llama.fi';
const COINS_API_BASE = 'https://coins.llama.fi';
const STABLECOINS_API_BASE = 'https://stablecoins.llama.fi';
const YIELDS_API_BASE = 'https://yields.llama.fi';

// Chain name mappings for DeFi Llama
const CHAIN_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  polygon: 'Polygon',
  bsc: 'BSC',
  avalanche: 'Avalanche',
  fantom: 'Fantom',
  solana: 'Solana',
  gnosis: 'Gnosis',
  celo: 'Celo',
  moonbeam: 'Moonbeam',
  cronos: 'Cronos',
  linea: 'Linea',
  scroll: 'Scroll',
  zksync: 'zkSync Era',
  mantle: 'Mantle',
  blast: 'Blast',
  mode: 'Mode',
};

// Types
export interface DefiLlamaProtocol {
  id: string;
  name: string;
  symbol: string;
  slug: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  fdv: number;
  mcap: number;
  chains: string[];
  category: string;
  url: string;
  description: string;
  logo: string;
  twitter: string;
  audit_links?: string[];
  oracles?: string[];
}

export interface DefiLlamaTokenPrice {
  decimals: number;
  symbol: string;
  price: number;
  timestamp: number;
  confidence: number;
}

export interface DefiLlamaChainTVL {
  name: string;
  tvl: number;
  tokenSymbol: string;
  cmcId: string;
}

export interface DefiLlamaYieldPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  rewardTokens: string[];
  underlyingTokens: string[];
  stablecoin: boolean;
  exposure: string;
}

export interface DefiLlamaAnalysis {
  tokenAddress: string;
  chain: string;
  tokenPrice: DefiLlamaTokenPrice | null;
  protocols: DefiLlamaProtocol[];
  yieldPools: DefiLlamaYieldPool[];
  chainTVL: number | null;
  insights: string[];
  timestamp: string;
}

// Get token price from DeFi Llama
export async function getTokenPrice(
  env: Env,
  tokenAddress: string,
  chain: string = 'base'
): Promise<DefiLlamaTokenPrice | null> {
  try {
    const chainName = chain.toLowerCase();
    const coinKey = `${chainName}:${tokenAddress.toLowerCase()}`;
    const url = `${COINS_API_BASE}/prices/current/${coinKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      coins: Record<string, DefiLlamaTokenPrice>;
    };

    return data.coins[coinKey] || null;
  } catch (error) {
    console.error('DeFi Llama price error:', error);
    return null;
  }
}

// Get historical token prices
export async function getHistoricalPrices(
  env: Env,
  tokenAddress: string,
  chain: string = 'base',
  span: number = 7 // days
): Promise<{ timestamp: number; price: number }[] | null> {
  try {
    const chainName = chain.toLowerCase();
    const coinKey = `${chainName}:${tokenAddress.toLowerCase()}`;
    const url = `${COINS_API_BASE}/chart/${coinKey}?span=${span}d`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      coins: Record<string, { prices: [number, number][] }>;
    };

    const prices = data.coins[coinKey]?.prices;
    if (!prices) return null;

    return prices.map(([timestamp, price]) => ({ timestamp, price }));
  } catch (error) {
    console.error('DeFi Llama historical prices error:', error);
    return null;
  }
}

// Get chain TVL
export async function getChainTVL(
  env: Env,
  chain: string = 'base'
): Promise<number | null> {
  try {
    const url = `${LLAMA_API_BASE}/v2/chains`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const chains = await response.json() as DefiLlamaChainTVL[];
    const chainData = chains.find(
      c => c.name.toLowerCase() === chain.toLowerCase() ||
           c.name.toLowerCase() === CHAIN_NAMES[chain.toLowerCase()]?.toLowerCase()
    );

    return chainData?.tvl || null;
  } catch (error) {
    console.error('DeFi Llama chain TVL error:', error);
    return null;
  }
}

// Get protocols by chain
export async function getProtocolsByChain(
  env: Env,
  chain: string = 'base'
): Promise<DefiLlamaProtocol[]> {
  try {
    const url = `${LLAMA_API_BASE}/protocols`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const protocols = await response.json() as DefiLlamaProtocol[];
    const chainName = CHAIN_NAMES[chain.toLowerCase()] || chain;

    return protocols.filter(p =>
      p.chains?.some(c => c.toLowerCase() === chainName.toLowerCase())
    );
  } catch (error) {
    console.error('DeFi Llama protocols error:', error);
    return [];
  }
}

// Search for protocol by name or symbol
export async function searchProtocol(
  env: Env,
  query: string
): Promise<DefiLlamaProtocol | null> {
  try {
    const url = `${LLAMA_API_BASE}/protocols`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const protocols = await response.json() as DefiLlamaProtocol[];
    const queryLower = query.toLowerCase();

    // Try exact match first
    let match = protocols.find(
      p => p.symbol?.toLowerCase() === queryLower ||
           p.name?.toLowerCase() === queryLower ||
           p.slug?.toLowerCase() === queryLower
    );

    // Then try partial match
    if (!match) {
      match = protocols.find(
        p => p.name?.toLowerCase().includes(queryLower) ||
             p.symbol?.toLowerCase().includes(queryLower)
      );
    }

    return match || null;
  } catch (error) {
    console.error('DeFi Llama search error:', error);
    return null;
  }
}

// Get protocol details
export async function getProtocolDetails(
  env: Env,
  slug: string
): Promise<DefiLlamaProtocol | null> {
  try {
    const url = `${LLAMA_API_BASE}/protocol/${slug}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as DefiLlamaProtocol;
  } catch (error) {
    console.error('DeFi Llama protocol details error:', error);
    return null;
  }
}

// Get yield pools for a token
export async function getYieldPools(
  env: Env,
  tokenSymbol: string,
  chain?: string
): Promise<DefiLlamaYieldPool[]> {
  try {
    const url = `${YIELDS_API_BASE}/pools`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { data: DefiLlamaYieldPool[] };
    const symbolUpper = tokenSymbol.toUpperCase();

    let pools = data.data.filter(p =>
      p.symbol?.toUpperCase().includes(symbolUpper)
    );

    // Filter by chain if specified
    if (chain) {
      const chainName = CHAIN_NAMES[chain.toLowerCase()] || chain;
      pools = pools.filter(p =>
        p.chain?.toLowerCase() === chainName.toLowerCase()
      );
    }

    // Sort by APY
    return pools.sort((a, b) => (b.apy || 0) - (a.apy || 0)).slice(0, 10);
  } catch (error) {
    console.error('DeFi Llama yields error:', error);
    return [];
  }
}

// Get DEX volumes for a chain
export async function getDexVolumes(
  env: Env,
  chain: string = 'base'
): Promise<{ protocol: string; volume24h: number; volume7d: number }[]> {
  try {
    const chainName = CHAIN_NAMES[chain.toLowerCase()] || chain;
    const url = `${LLAMA_API_BASE}/overview/dexs/${chainName.toLowerCase()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as {
      protocols: Array<{
        name: string;
        total24h: number;
        total7d: number;
      }>;
    };

    return data.protocols?.map(p => ({
      protocol: p.name,
      volume24h: p.total24h || 0,
      volume7d: p.total7d || 0,
    })) || [];
  } catch (error) {
    console.error('DeFi Llama DEX volumes error:', error);
    return [];
  }
}

// Comprehensive DeFi Llama analysis for a token
export async function getDefiLlamaAnalysis(
  env: Env,
  tokenAddress: string,
  tokenSymbol: string,
  chain: string = 'base'
): Promise<DefiLlamaAnalysis> {
  // Fetch data in parallel
  const [tokenPrice, chainTVL, yieldPools] = await Promise.all([
    getTokenPrice(env, tokenAddress, chain),
    getChainTVL(env, chain),
    getYieldPools(env, tokenSymbol, chain),
  ]);

  // Search for protocol if it's a DeFi token
  let protocols: DefiLlamaProtocol[] = [];
  const protocol = await searchProtocol(env, tokenSymbol);
  if (protocol) {
    protocols = [protocol];
  }

  // Generate insights
  const insights = generateDefiInsights(tokenPrice, protocols, yieldPools, chainTVL, chain);

  return {
    tokenAddress,
    chain,
    tokenPrice,
    protocols,
    yieldPools,
    chainTVL,
    insights,
    timestamp: new Date().toISOString(),
  };
}

// Generate insights from DeFi Llama data
function generateDefiInsights(
  tokenPrice: DefiLlamaTokenPrice | null,
  protocols: DefiLlamaProtocol[],
  yieldPools: DefiLlamaYieldPool[],
  chainTVL: number | null,
  chain: string
): string[] {
  const insights: string[] = [];

  // Price insight
  if (tokenPrice) {
    const confidence = tokenPrice.confidence || 0;
    if (confidence >= 0.9) {
      insights.push(`Price data from DeFi Llama with high confidence (${(confidence * 100).toFixed(0)}%)`);
    } else if (confidence > 0) {
      insights.push(`Price data from DeFi Llama (confidence: ${(confidence * 100).toFixed(0)}%)`);
    }
  } else {
    insights.push('Token not yet tracked on DeFi Llama - may be very new or low liquidity');
  }

  // Protocol insights
  if (protocols.length > 0) {
    const protocol = protocols[0];
    if (protocol.tvl) {
      insights.push(`Protocol TVL: $${(protocol.tvl / 1e6).toFixed(2)}M`);
    }
    if (protocol.category) {
      insights.push(`Category: ${protocol.category}`);
    }
    if (protocol.change_7d !== undefined) {
      const change = protocol.change_7d;
      if (change > 10) {
        insights.push(`TVL up ${change.toFixed(1)}% in 7 days - growing protocol`);
      } else if (change < -10) {
        insights.push(`TVL down ${Math.abs(change).toFixed(1)}% in 7 days - declining activity`);
      }
    }
    if (protocol.audit_links && protocol.audit_links.length > 0) {
      insights.push(`${protocol.audit_links.length} audit(s) on file`);
    }
  }

  // Yield pool insights
  if (yieldPools.length > 0) {
    const topPool = yieldPools[0];
    if (topPool.apy > 100) {
      insights.push(`High-yield opportunity: ${topPool.apy.toFixed(1)}% APY on ${topPool.project} (verify sustainability)`);
    } else if (topPool.apy > 10) {
      insights.push(`Yield available: ${topPool.apy.toFixed(1)}% APY on ${topPool.project}`);
    }
    insights.push(`${yieldPools.length} yield pool(s) available for this token`);
  }

  // Chain TVL context
  if (chainTVL) {
    const chainName = CHAIN_NAMES[chain.toLowerCase()] || chain;
    insights.push(`${chainName} chain TVL: $${(chainTVL / 1e9).toFixed(2)}B`);
  }

  return insights;
}

// Format DeFi Llama analysis for display
export function formatDefiLlamaAnalysis(analysis: DefiLlamaAnalysis): string {
  const lines: string[] = [];

  lines.push(`## DeFi Llama Analysis`);
  lines.push('');

  // Token price
  if (analysis.tokenPrice) {
    lines.push(`**Price:** $${analysis.tokenPrice.price.toFixed(analysis.tokenPrice.price < 0.01 ? 8 : 4)}`);
    lines.push(`**Symbol:** ${analysis.tokenPrice.symbol}`);
    lines.push('');
  }

  // Protocol data
  if (analysis.protocols.length > 0) {
    lines.push('### Protocol Data');
    for (const protocol of analysis.protocols) {
      lines.push(`- **${protocol.name}** (${protocol.symbol || 'N/A'})`);
      if (protocol.tvl) lines.push(`  - TVL: $${(protocol.tvl / 1e6).toFixed(2)}M`);
      if (protocol.category) lines.push(`  - Category: ${protocol.category}`);
      if (protocol.chains) lines.push(`  - Chains: ${protocol.chains.join(', ')}`);
      if (protocol.change_1d !== undefined) {
        const emoji = protocol.change_1d >= 0 ? '📈' : '📉';
        lines.push(`  - 24h TVL Change: ${emoji} ${protocol.change_1d >= 0 ? '+' : ''}${protocol.change_1d.toFixed(2)}%`);
      }
    }
    lines.push('');
  }

  // Yield pools
  if (analysis.yieldPools.length > 0) {
    lines.push('### Yield Opportunities');
    const topPools = analysis.yieldPools.slice(0, 5);
    for (const pool of topPools) {
      const apyEmoji = pool.apy > 50 ? '🔥' : pool.apy > 20 ? '✨' : '';
      lines.push(`- **${pool.project}** on ${pool.chain}: ${pool.apy.toFixed(2)}% APY ${apyEmoji}`);
      if (pool.tvlUsd) lines.push(`  - Pool TVL: $${(pool.tvlUsd / 1e6).toFixed(2)}M`);
    }
    lines.push('');
  }

  // Chain context
  if (analysis.chainTVL) {
    const chainName = CHAIN_NAMES[analysis.chain.toLowerCase()] || analysis.chain;
    lines.push(`### ${chainName} Chain`);
    lines.push(`- Total Chain TVL: $${(analysis.chainTVL / 1e9).toFixed(2)}B`);
    lines.push('');
  }

  // Insights
  if (analysis.insights.length > 0) {
    lines.push('### Insights');
    for (const insight of analysis.insights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
