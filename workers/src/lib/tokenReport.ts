/**
 * Comprehensive Token Analysis Report Engine
 *
 * Integrates multiple data sources for full-service token analysis:
 * - GeckoTerminal: Price, liquidity, pools, volume
 * - Honeypot.is: Honeypot detection (ETH, Base, BSC)
 * - GoPlus Security: Advanced security checks (honeypot, taxes, ownership)
 * - Neynar: Farcaster sentiment and mentions
 * - DeFi Llama: TVL, protocol data, yields
 * - @bankr Archive: Check if bankr has mentioned the token
 * - Basescan/Etherscan: Contract verification status
 * - Security Analysis: Source code vulnerability scan
 * - Alchemy: Whale tracking and holder concentration
 */

import { Env } from './types';
import { withRetry } from './retry';
import {
  analyzeToken,
  TokenAnalysis,
  getTokenInfo,
  getTokenPools,
  TokenInfo,
  PoolInfo,
} from './geckoterminal';
import {
  analyzeContract,
  fetchContractSource,
  ContractSecurityAnalysis,
} from './security';
import {
  getWalletIntelligence,
  getContractCreator,
  getCreatorFromWebacy,
  getClankerInfo,
  WalletIntelligence,
  formatWalletIntelligence,
} from './walletIntel';
import {
  getTokenHolderAnalysis,
  TokenHolderAnalysis,
  formatHolderAnalysis,
} from './alchemy';
import {
  getGoPlusTokenSecurity,
  GoPlusSecurityAnalysis,
  formatGoPlusAnalysis,
} from './goplus';
import {
  getDefiLlamaAnalysis,
  DefiLlamaAnalysis,
  formatDefiLlamaAnalysis,
} from './defillama';
import { trackAnalyzedToken } from './rugDetection';

// ============ Types ============

export interface HoneypotResult {
  isHoneypot: boolean;
  honeypotReason?: string;
  simulationSuccess: boolean;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  canTakeBackOwnership: boolean;
  ownerAddress?: string;
  creatorAddress?: string;
  holderCount?: number;
  error?: string;
}

export interface FarcasterSentiment {
  mentionCount: number;
  recentMentions: Array<{
    author: string;
    text: string;
    timestamp: string;
    hash: string;
  }>;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'unknown';
  topMentioners: string[];
}

export interface BankrMention {
  found: boolean;
  mentions: Array<{
    text: string;
    timestamp: string;
    hash: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
  }>;
}

export interface ContractVerification {
  isVerified: boolean;
  contractName?: string;
  compiler?: string;
  optimizationUsed?: boolean;
  runs?: number;
  evmVersion?: string;
  license?: string;
}

export interface ComprehensiveTokenReport {
  // Basic info
  address: string;
  network: string;
  timestamp: string;

  // GeckoTerminal data
  tokenInfo: TokenInfo | null;
  pools: PoolInfo[];
  geckoAnalysis: TokenAnalysis | null;

  // Honeypot detection
  honeypot: HoneypotResult | null;

  // Farcaster sentiment
  farcasterSentiment: FarcasterSentiment | null;

  // @bankr mentions
  bankrMentions: BankrMention | null;

  // Contract verification
  verification: ContractVerification | null;

  // Security analysis
  securityAnalysis: ContractSecurityAnalysis | null;

  // Deployer intelligence (Webacy + Clanker + history)
  deployerIntel: WalletIntelligence | null;

  // Whale/holder analysis (Alchemy)
  whaleAnalysis: TokenHolderAnalysis | null;

  // GoPlus Security (additional security checks)
  goplusSecurity: GoPlusSecurityAnalysis | null;

  // DeFi Llama (TVL, protocol data, yields)
  defiLlama: DefiLlamaAnalysis | null;

  // Overall assessment
  overallScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  warnings: string[];
  positives: string[];
  summary: string;
}

// ============ Honeypot.is Integration ============

const HONEYPOT_CHAINS: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  base: 8453,
  bsc: 56,
  binance: 56,
};

export async function checkHoneypot(
  network: string,
  tokenAddress: string
): Promise<HoneypotResult | null> {
  const chainId = HONEYPOT_CHAINS[network.toLowerCase()];

  if (!chainId) {
    return {
      isHoneypot: false,
      simulationSuccess: false,
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
      isOpenSource: false,
      isProxy: false,
      isMintable: false,
      canTakeBackOwnership: false,
      error: `Network ${network} not supported by honeypot.is`
    };
  }

  try {
    const { result: response } = await withRetry(
      async () => {
        const r = await fetch(
          `https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&chainID=${chainId}`,
          { headers: { Accept: 'application/json' } }
        );
        if (!r.ok) throw new Error(`Honeypot.is API error: ${r.status}`);
        return r;
      },
      { maxRetries: 2, baseDelay: 1000 }
    );

    if (!response) {
      return null;
    }

    const data = await response.json() as {
      honeypotResult?: {
        isHoneypot?: boolean;
        honeypotReason?: string;
      };
      simulationSuccess?: boolean;
      simulationResult?: {
        buyTax?: number;
        sellTax?: number;
        transferTax?: number;
      };
      contractCode?: {
        openSource?: boolean;
        isProxy?: boolean;
        hasProxyCalls?: boolean;
      };
      holderAnalysis?: {
        holders?: number;
      };
      flags?: string[];
      summary?: {
        riskLevel?: number;
      };
      token?: {
        name?: string;
        symbol?: string;
      };
      pair?: {
        pair?: {
          address?: string;
          name?: string;
        };
      };
    };

    const honeypotResult = data.honeypotResult || {};
    const simResult = data.simulationResult || {};
    const contractCode = data.contractCode || {};

    return {
      isHoneypot: honeypotResult.isHoneypot || false,
      honeypotReason: honeypotResult.honeypotReason,
      simulationSuccess: data.simulationSuccess || false,
      buyTax: simResult.buyTax || 0,
      sellTax: simResult.sellTax || 0,
      transferTax: simResult.transferTax || 0,
      isOpenSource: contractCode.openSource || false,
      isProxy: contractCode.isProxy || false,
      isMintable: (data.flags || []).includes('mintable'),
      canTakeBackOwnership: (data.flags || []).includes('canTakeBackOwnership'),
      holderCount: data.holderAnalysis?.holders,
    };
  } catch (error) {
    console.error('Honeypot.is fetch error:', error);
    return null;
  }
}

// ============ Farcaster Sentiment via Neynar ============

export async function getFarcasterSentiment(
  env: Env,
  tokenSymbol: string,
  tokenAddress?: string
): Promise<FarcasterSentiment | null> {
  if (!env.NEYNAR_API_KEY) {
    return null;
  }

  try {
    // Search for casts mentioning the token symbol or address
    const searchQuery = tokenSymbol.startsWith('$') ? tokenSymbol : `$${tokenSymbol}`;

    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(searchQuery)}&limit=25`,
      {
        headers: {
          'x-api-key': env.NEYNAR_API_KEY,
          'accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Neynar search error: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      result?: {
        casts?: Array<{
          hash: string;
          text: string;
          timestamp: string;
          author: {
            username: string;
            fid: number;
            follower_count?: number;
          };
        }>;
      };
    };

    const casts = data.result?.casts || [];

    // Filter to recent casts (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentCasts = casts.filter(c => c.timestamp > weekAgo);

    // Analyze sentiment (simple keyword analysis)
    let bullishCount = 0;
    let bearishCount = 0;
    const bullishKeywords = ['moon', 'pump', 'bullish', 'buy', 'long', 'lfg', 'gem', 'alpha', '🚀', '📈', '💎'];
    const bearishKeywords = ['dump', 'rug', 'scam', 'sell', 'short', 'bearish', 'avoid', 'honeypot', '📉', '⚠️', '🚨'];

    for (const cast of recentCasts) {
      const text = cast.text.toLowerCase();
      if (bullishKeywords.some(kw => text.includes(kw))) bullishCount++;
      if (bearishKeywords.some(kw => text.includes(kw))) bearishCount++;
    }

    let sentiment: 'bullish' | 'bearish' | 'neutral' | 'unknown' = 'unknown';
    if (recentCasts.length >= 3) {
      if (bullishCount > bearishCount * 2) sentiment = 'bullish';
      else if (bearishCount > bullishCount * 2) sentiment = 'bearish';
      else if (bullishCount + bearishCount > 0) sentiment = 'neutral';
    }

    // Get top mentioners by follower count
    const topMentioners = [...new Set(
      casts
        .sort((a, b) => (b.author.follower_count || 0) - (a.author.follower_count || 0))
        .slice(0, 5)
        .map(c => c.author.username)
    )];

    return {
      mentionCount: casts.length,
      recentMentions: recentCasts.slice(0, 10).map(c => ({
        author: c.author.username,
        text: c.text.slice(0, 200),
        timestamp: c.timestamp,
        hash: c.hash,
      })),
      sentiment,
      topMentioners,
    };
  } catch (error) {
    console.error('Farcaster sentiment fetch error:', error);
    return null;
  }
}

// ============ @bankr Mention Lookup ============

const BANKR_FID = 21152; // @bankr's FID

export async function checkBankrMentions(
  env: Env,
  tokenSymbol: string,
  tokenAddress?: string
): Promise<BankrMention | null> {
  if (!env.NEYNAR_API_KEY) {
    return null;
  }

  try {
    // Fetch @bankr's recent casts
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${BANKR_FID}&limit=100`,
      {
        headers: {
          'x-api-key': env.NEYNAR_API_KEY,
          'accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Neynar bankr fetch error: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      casts?: Array<{
        hash: string;
        text: string;
        timestamp: string;
      }>;
    };

    const casts = data.casts || [];

    // Search for mentions of the token
    const searchTerms = [
      tokenSymbol.toLowerCase(),
      `$${tokenSymbol.toLowerCase()}`,
      tokenAddress?.toLowerCase(),
    ].filter(Boolean);

    const mentions = casts.filter(cast => {
      const text = cast.text.toLowerCase();
      return searchTerms.some(term => term && text.includes(term));
    });

    if (mentions.length === 0) {
      return { found: false, mentions: [] };
    }

    // Analyze sentiment of bankr's mentions
    const analyzedMentions = mentions.map(m => {
      const text = m.text.toLowerCase();
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

      const positiveWords = ['buy', 'long', 'bullish', 'alpha', 'gem', 'opportunity', 'undervalued'];
      const negativeWords = ['sell', 'avoid', 'scam', 'rug', 'careful', 'warning', 'overvalued'];

      if (positiveWords.some(w => text.includes(w))) sentiment = 'positive';
      if (negativeWords.some(w => text.includes(w))) sentiment = 'negative';

      return {
        text: m.text.slice(0, 300),
        timestamp: m.timestamp,
        hash: m.hash,
        sentiment,
      };
    });

    return {
      found: true,
      mentions: analyzedMentions,
    };
  } catch (error) {
    console.error('Bankr mention check error:', error);
    return null;
  }
}

// ============ Contract Verification Check ============

export async function checkContractVerification(
  network: string,
  address: string,
  apiKey?: string
): Promise<ContractVerification | null> {
  // Use Etherscan V2 API (unified endpoint with chainid)
  const chainIds: Record<string, number> = {
    ethereum: 1,
    eth: 1,
    base: 8453,
    bsc: 56,
    binance: 56,
    arbitrum: 42161,
    optimism: 10,
    polygon: 137,
  };

  const chainId = chainIds[network.toLowerCase()];
  if (!chainId) {
    return null;
  }

  try {
    let url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}`;
    if (apiKey) {
      url += `&apikey=${apiKey}`;
    }

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json() as {
      status: string;
      result: Array<{
        SourceCode: string;
        ContractName: string;
        CompilerVersion: string;
        OptimizationUsed: string;
        Runs: string;
        EVMVersion: string;
        LicenseType: string;
      }>;
    };

    if (data.status !== '1' || !data.result?.[0]) {
      return { isVerified: false };
    }

    const result = data.result[0];
    const isVerified = !!result.SourceCode && result.SourceCode !== '';

    return {
      isVerified,
      contractName: result.ContractName || undefined,
      compiler: result.CompilerVersion || undefined,
      optimizationUsed: result.OptimizationUsed === '1',
      runs: result.Runs ? parseInt(result.Runs) : undefined,
      evmVersion: result.EVMVersion || undefined,
      license: result.LicenseType || undefined,
    };
  } catch (error) {
    console.error('Contract verification check error:', error);
    return null;
  }
}

// ============ Main Analysis Function ============

export async function generateComprehensiveReport(
  env: Env,
  tokenAddress: string,
  network: string = 'base'
): Promise<ComprehensiveTokenReport> {
  const timestamp = new Date().toISOString();
  const warnings: string[] = [];
  const positives: string[] = [];

  console.log(`Generating comprehensive report for ${tokenAddress} on ${network}`);

  // Etherscan V2 uses a single API key for all chains
  const getExplorerApiKey = (): string | undefined => {
    return env.ETHERSCAN_API_KEY;
  };

  // Run all analyses in parallel for speed
  const [
    geckoAnalysis,
    honeypot,
    verification,
  ] = await Promise.all([
    analyzeToken(network, tokenAddress),
    checkHoneypot(network, tokenAddress),
    checkContractVerification(network, tokenAddress, getExplorerApiKey()),
  ]);

  // Get token symbol for Farcaster searches
  const tokenSymbol = geckoAnalysis?.token?.symbol || '';

  // Get deployer address - try honeypot first, then Webacy, then Clanker, then Etherscan
  let deployerAddress = honeypot?.creatorAddress || honeypot?.ownerAddress;

  // If no deployer from honeypot, try Webacy (it includes creator in response)
  if (!deployerAddress) {
    deployerAddress = await getCreatorFromWebacy(env, tokenAddress, network) || undefined;
  }

  // Try Clanker - it has admin address for Clanker-launched tokens
  let clankerInfo = null;
  if (!deployerAddress) {
    clankerInfo = await getClankerInfo(env, tokenAddress);
    if (clankerInfo && clankerInfo.adminAddress) {
      // Clanker provides admin address which is the deployer
      deployerAddress = clankerInfo.adminAddress;
      console.log('Found deployer via Clanker admin:', deployerAddress);
    }
  }

  // Fallback to Etherscan lookup
  if (!deployerAddress) {
    deployerAddress = await getContractCreator(env, tokenAddress, network) || undefined;
  }

  // Run Farcaster-dependent queries, deployer intelligence, and whale analysis
  // Note: getWalletIntelligence will also fetch Clanker info, but we already have it if found above
  const [
    farcasterSentiment,
    bankrMentions,
    securityAnalysis,
    deployerIntel,
    whaleAnalysis,
    goplusSecurity,
    defiLlama,
  ] = await Promise.all([
    tokenSymbol ? getFarcasterSentiment(env, tokenSymbol, tokenAddress) : Promise.resolve(null),
    tokenSymbol ? checkBankrMentions(env, tokenSymbol, tokenAddress) : Promise.resolve(null),
    verification?.isVerified ? analyzeContract(network, tokenAddress, getExplorerApiKey()) : Promise.resolve(null),
    // Always try to get wallet intelligence - even without deployer, we might have Clanker info
    getWalletIntelligence(env, tokenAddress, deployerAddress || '0x0000000000000000000000000000000000000000', network),
    // Whale/holder concentration analysis from Alchemy
    getTokenHolderAnalysis(env, tokenAddress, network),
    // GoPlus Security (free API, additional security checks)
    getGoPlusTokenSecurity(env, tokenAddress, network),
    // DeFi Llama (TVL, protocol data, yields)
    getDefiLlamaAnalysis(env, tokenAddress, tokenSymbol, network),
  ]);

  // ============ Build Warnings ============

  // Honeypot warnings
  if (honeypot?.isHoneypot) {
    warnings.push(`🚨 HONEYPOT DETECTED: ${honeypot.honeypotReason || 'Cannot sell tokens'}`);
  }
  if (honeypot && honeypot.sellTax > 10) {
    warnings.push(`⚠️ High sell tax: ${honeypot.sellTax.toFixed(1)}%`);
  }
  if (honeypot && honeypot.buyTax > 10) {
    warnings.push(`⚠️ High buy tax: ${honeypot.buyTax.toFixed(1)}%`);
  }
  if (honeypot?.isMintable) {
    warnings.push('⚠️ Token is mintable - supply can be inflated');
  }
  if (honeypot?.canTakeBackOwnership) {
    warnings.push('🚨 Owner can reclaim ownership - major red flag');
  }

  // Verification warnings
  if (!verification?.isVerified) {
    warnings.push('⚠️ Contract source code NOT VERIFIED');
  }

  // Security warnings
  if (securityAnalysis) {
    const criticals = securityAnalysis.issues.filter(i => i.severity === 'critical');
    const highs = securityAnalysis.issues.filter(i => i.severity === 'high');
    if (criticals.length > 0) {
      warnings.push(`🚨 ${criticals.length} CRITICAL security issue(s) in contract`);
    }
    if (highs.length > 0) {
      warnings.push(`⚠️ ${highs.length} HIGH severity security issue(s)`);
    }
  }

  // Liquidity warnings from GeckoTerminal
  if (geckoAnalysis?.warnings) {
    warnings.push(...geckoAnalysis.warnings);
  }

  // Farcaster sentiment warnings
  if (farcasterSentiment?.sentiment === 'bearish') {
    warnings.push('📉 Bearish sentiment on Farcaster');
  }

  // Deployer intelligence warnings
  if (deployerIntel) {
    warnings.push(...deployerIntel.riskFactors);
  }

  // Whale/holder concentration warnings
  if (whaleAnalysis) {
    warnings.push(...whaleAnalysis.warnings);
    if (whaleAnalysis.riskLevel === 'critical') {
      warnings.push('🐋 CRITICAL: Extreme holder concentration detected');
    } else if (whaleAnalysis.riskLevel === 'high') {
      warnings.push('🐋 High holder concentration risk');
    }
  }

  // GoPlus Security warnings
  if (goplusSecurity) {
    for (const risk of goplusSecurity.risks) {
      if (risk.severity === 'CRITICAL' || risk.severity === 'HIGH') {
        warnings.push(`🛡️ GoPlus: ${risk.title} - ${risk.description}`);
      }
    }
    if (goplusSecurity.riskLevel === 'CRITICAL') {
      warnings.push('🛡️ GoPlus: CRITICAL security risk detected');
    }
  }

  // DeFi Llama warnings
  if (defiLlama) {
    if (!defiLlama.tokenPrice) {
      warnings.push('📊 DeFi Llama: Token not tracked - may be very new or low liquidity');
    }
  }

  // ============ Build Positives ============

  if (honeypot && !honeypot.isHoneypot && honeypot.simulationSuccess) {
    positives.push('✅ Not a honeypot - buy/sell simulation passed');
  }
  if (honeypot && honeypot.sellTax <= 5 && honeypot.buyTax <= 5) {
    positives.push(`✅ Low taxes: Buy ${honeypot.buyTax.toFixed(1)}% / Sell ${honeypot.sellTax.toFixed(1)}%`);
  }
  if (verification?.isVerified) {
    positives.push('✅ Contract source verified');
  }
  if (honeypot?.isOpenSource) {
    positives.push('✅ Open source contract');
  }
  if (securityAnalysis && securityAnalysis.score >= 80) {
    positives.push(`✅ Security score: ${securityAnalysis.score}/100`);
  }
  if (geckoAnalysis?.trending) {
    positives.push('🔥 Currently trending on GeckoTerminal');
  }
  if (farcasterSentiment?.sentiment === 'bullish') {
    positives.push('📈 Bullish sentiment on Farcaster');
  }
  if (bankrMentions?.found) {
    const positiveMentions = bankrMentions.mentions.filter(m => m.sentiment === 'positive');
    if (positiveMentions.length > 0) {
      positives.push(`💰 @bankr mentioned positively (${positiveMentions.length}x)`);
    }
  }
  if (honeypot?.holderCount && honeypot.holderCount > 100) {
    positives.push(`👥 ${honeypot.holderCount.toLocaleString()} holders`);
  }

  // Deployer intelligence positives
  if (deployerIntel) {
    positives.push(...deployerIntel.positiveFactors);
  }

  // Whale analysis positives
  if (whaleAnalysis) {
    if (whaleAnalysis.riskLevel === 'low') {
      positives.push('✅ Healthy holder distribution');
    }
    if (whaleAnalysis.totalHolders >= 100) {
      positives.push(`👥 ${whaleAnalysis.totalHolders.toLocaleString()} unique holders`);
    }
  }

  // GoPlus Security positives
  if (goplusSecurity) {
    if (goplusSecurity.riskLevel === 'LOW') {
      positives.push('🛡️ GoPlus: Low security risk');
    }
    if (goplusSecurity.security?.trust_list === '1') {
      positives.push('🛡️ GoPlus: On trust list');
    }
    if (goplusSecurity.warnings.length > 0) {
      // Add informational notes
      for (const warning of goplusSecurity.warnings.slice(0, 2)) {
        positives.push(`ℹ️ ${warning}`);
      }
    }
  }

  // DeFi Llama positives
  if (defiLlama) {
    if (defiLlama.protocols.length > 0) {
      const protocol = defiLlama.protocols[0];
      if (protocol.tvl && protocol.tvl > 1000000) {
        positives.push(`📊 DeFi Llama: Protocol TVL $${(protocol.tvl / 1e6).toFixed(2)}M`);
      }
      if (protocol.audit_links && protocol.audit_links.length > 0) {
        positives.push(`✅ DeFi Llama: ${protocol.audit_links.length} audit(s) on record`);
      }
    }
    if (defiLlama.yieldPools.length > 0) {
      const topPool = defiLlama.yieldPools[0];
      if (topPool.apy > 5) {
        positives.push(`💰 Yield available: ${topPool.apy.toFixed(1)}% APY on ${topPool.project}`);
      }
    }
  }

  // ============ Calculate Overall Score ============

  let score = 50; // Start neutral

  // Honeypot factors (-50 to +10)
  if (honeypot?.isHoneypot) score -= 50;
  else if (honeypot?.simulationSuccess) score += 10;
  if (honeypot && honeypot.sellTax > 20) score -= 20;
  else if (honeypot && honeypot.sellTax > 10) score -= 10;
  if (honeypot?.isMintable) score -= 10;
  if (honeypot?.canTakeBackOwnership) score -= 25;

  // Verification factors (-15 to +10)
  if (!verification?.isVerified) score -= 15;
  else score += 10;

  // Security factors (-30 to +10)
  if (securityAnalysis) {
    if (securityAnalysis.score >= 90) score += 10;
    else if (securityAnalysis.score >= 70) score += 5;
    else if (securityAnalysis.score < 50) score -= 20;
    else if (securityAnalysis.score < 30) score -= 30;
  }

  // Liquidity factors (-10 to +5)
  const totalLiquidity = geckoAnalysis?.topPools?.reduce(
    (sum, p) => sum + parseFloat(p.reserveUsd || '0'), 0
  ) || 0;
  if (totalLiquidity > 100000) score += 5;
  else if (totalLiquidity < 10000) score -= 10;

  // Sentiment factors (-5 to +5)
  if (farcasterSentiment?.sentiment === 'bullish') score += 5;
  if (farcasterSentiment?.sentiment === 'bearish') score -= 5;
  if (bankrMentions?.found) {
    const positiveMentions = bankrMentions.mentions.filter(m => m.sentiment === 'positive');
    const negativeMentions = bankrMentions.mentions.filter(m => m.sentiment === 'negative');
    score += positiveMentions.length * 3;
    score -= negativeMentions.length * 5;
  }

  // Deployer intelligence factors (-30 to +10)
  if (deployerIntel) {
    if (deployerIntel.overallRisk === 'critical') score -= 30;
    else if (deployerIntel.overallRisk === 'high') score -= 15;
    else if (deployerIntel.overallRisk === 'low') score += 10;

    // Bonus for Clanker-launched tokens
    if (deployerIntel.deployer.clankerInfo) {
      score += 5;
      if (deployerIntel.deployer.clankerInfo.isVerifiedBuilder) score += 10;
    }
  }

  // Whale/holder concentration factors (-20 to +5)
  if (whaleAnalysis) {
    if (whaleAnalysis.riskLevel === 'critical') score -= 20;
    else if (whaleAnalysis.riskLevel === 'high') score -= 10;
    else if (whaleAnalysis.riskLevel === 'low') score += 5;

    // Large holder count is positive
    if (whaleAnalysis.totalHolders >= 500) score += 5;
  }

  // GoPlus Security factors (-25 to +5)
  if (goplusSecurity) {
    if (goplusSecurity.riskLevel === 'CRITICAL') score -= 25;
    else if (goplusSecurity.riskLevel === 'HIGH') score -= 15;
    else if (goplusSecurity.riskLevel === 'MEDIUM') score -= 5;
    else if (goplusSecurity.riskLevel === 'LOW') score += 5;

    // Trust list bonus
    if (goplusSecurity.security?.trust_list === '1') score += 5;
  }

  // DeFi Llama factors (-5 to +5)
  if (defiLlama) {
    // Protocol presence is positive
    if (defiLlama.protocols.length > 0) {
      const protocol = defiLlama.protocols[0];
      if (protocol.tvl && protocol.tvl > 10000000) score += 5; // >$10M TVL
      else if (protocol.tvl && protocol.tvl > 1000000) score += 3; // >$1M TVL
      if (protocol.audit_links && protocol.audit_links.length > 0) score += 3;
    }
    // Token not tracked is slightly negative (may be very new)
    if (!defiLlama.tokenPrice) score -= 3;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let riskLevel: ComprehensiveTokenReport['riskLevel'] = 'unknown';
  if (honeypot?.isHoneypot) riskLevel = 'critical';
  else if (score >= 70) riskLevel = 'low';
  else if (score >= 50) riskLevel = 'medium';
  else if (score >= 30) riskLevel = 'high';
  else riskLevel = 'critical';

  // ============ Generate Summary ============

  let summary = '';
  const token = geckoAnalysis?.token;

  if (token) {
    const price = token.priceUsd ? `$${parseFloat(token.priceUsd).toFixed(8)}` : 'N/A';
    summary = `${token.name} (${token.symbol}) @ ${price}\n`;
  } else {
    summary = `Token ${tokenAddress.slice(0, 10)}...\n`;
  }

  summary += `Risk: ${riskLevel.toUpperCase()} | Score: ${score}/100\n`;

  if (warnings.length > 0) {
    summary += `\n⚠️ ${warnings.length} warning(s):\n`;
    summary += warnings.slice(0, 3).map(w => `• ${w}`).join('\n');
    if (warnings.length > 3) summary += `\n• ...and ${warnings.length - 3} more`;
  }

  if (positives.length > 0) {
    summary += `\n\n✅ ${positives.length} positive(s):\n`;
    summary += positives.slice(0, 3).map(p => `• ${p}`).join('\n');
  }

  // Track token for rug detection (async, don't block)
  const trackSymbol = geckoAnalysis?.token?.symbol || 'UNKNOWN';
  const trackName = geckoAnalysis?.token?.name || 'Unknown Token';
  const trackPrice = geckoAnalysis?.token?.priceUsd ? parseFloat(geckoAnalysis.token.priceUsd) : 0;
  trackAnalyzedToken(
    env,
    tokenAddress,
    trackSymbol,
    trackName,
    network,
    score,
    trackPrice,
    totalLiquidity
  ).catch(err => console.error('Token tracking error:', err));

  return {
    address: tokenAddress,
    network,
    timestamp,
    tokenInfo: geckoAnalysis?.token || null,
    pools: geckoAnalysis?.topPools || [],
    geckoAnalysis,
    honeypot,
    farcasterSentiment,
    bankrMentions,
    verification,
    securityAnalysis,
    deployerIntel,
    whaleAnalysis,
    goplusSecurity,
    defiLlama,
    overallScore: score,
    riskLevel,
    warnings,
    positives,
    summary,
  };
}

// ============ Format for Farcaster (Short) ============

export function formatReportShort(report: ComprehensiveTokenReport): string {
  const lines: string[] = [];
  const token = report.tokenInfo;

  // Header
  if (token) {
    const price = token.priceUsd ? `$${parseFloat(token.priceUsd).toFixed(6)}` : 'N/A';
    const change = token.priceChange24h
      ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}%`
      : '';
    lines.push(`🔍 ${token.symbol}: ${price} ${change}`);
  } else {
    lines.push(`🔍 ${report.address.slice(0, 10)}...`);
  }

  // Risk level
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
    unknown: '⚪',
  };
  lines.push(`${riskEmoji[report.riskLevel]} Risk: ${report.riskLevel.toUpperCase()} (${report.overallScore}/100)`);

  // Honeypot status
  if (report.honeypot) {
    if (report.honeypot.isHoneypot) {
      lines.push(`🚨 HONEYPOT: ${report.honeypot.honeypotReason || 'Cannot sell'}`);
    } else if (report.honeypot.simulationSuccess) {
      lines.push(`✅ Not honeypot | Tax: ${report.honeypot.buyTax.toFixed(0)}%/${report.honeypot.sellTax.toFixed(0)}%`);
    }
  }

  // Verification
  if (report.verification) {
    lines.push(report.verification.isVerified
      ? `✅ Verified: ${report.verification.contractName || 'Yes'}`
      : '⚠️ NOT VERIFIED');
  }

  // Security score
  if (report.securityAnalysis) {
    const secScore = report.securityAnalysis.score;
    const secEmoji = secScore >= 80 ? '✅' : secScore >= 50 ? '🟡' : '🔴';
    lines.push(`${secEmoji} Security: ${secScore}/100`);
  }

  // Farcaster sentiment
  if (report.farcasterSentiment && report.farcasterSentiment.mentionCount > 0) {
    const sentEmoji = {
      bullish: '📈',
      bearish: '📉',
      neutral: '➡️',
      unknown: '❓',
    };
    lines.push(`${sentEmoji[report.farcasterSentiment.sentiment]} FC: ${report.farcasterSentiment.mentionCount} mentions (${report.farcasterSentiment.sentiment})`);
  }

  // @bankr mention
  if (report.bankrMentions?.found) {
    const posCount = report.bankrMentions.mentions.filter(m => m.sentiment === 'positive').length;
    const negCount = report.bankrMentions.mentions.filter(m => m.sentiment === 'negative').length;
    if (posCount > 0) lines.push(`💰 @bankr: ${posCount} positive mention(s)`);
    if (negCount > 0) lines.push(`⚠️ @bankr: ${negCount} warning(s)`);
  }

  // Deployer intelligence
  if (report.deployerIntel) {
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };
    lines.push(`${riskEmoji[report.deployerIntel.overallRisk]} Deployer: ${report.deployerIntel.overallRisk.toUpperCase()}`);
    if (report.deployerIntel.deployer.clankerInfo?.deployerUsername) {
      lines.push(`🎯 @${report.deployerIntel.deployer.clankerInfo.deployerUsername} via Clanker`);
    }
  }

  // Whale analysis
  if (report.whaleAnalysis) {
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };
    lines.push(`${riskEmoji[report.whaleAnalysis.riskLevel]} 🐋 Whales: ${report.whaleAnalysis.riskLevel.toUpperCase()} (top10: ${report.whaleAnalysis.holderConcentration.toFixed(0)}%)`);
  }

  // GoPlus Security
  if (report.goplusSecurity) {
    const riskEmoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🟠',
      CRITICAL: '🔴',
    };
    lines.push(`${riskEmoji[report.goplusSecurity.riskLevel]} 🛡️ GoPlus: ${report.goplusSecurity.riskLevel} (${report.goplusSecurity.riskScore}/100)`);
  }

  // Top warning
  if (report.warnings.length > 0 && !report.honeypot?.isHoneypot) {
    lines.push('');
    lines.push(report.warnings[0]);
  }

  return lines.join('\n');
}

// ============ Format for Farcaster (Long - uses 10k limit) ============

export function formatReportLong(report: ComprehensiveTokenReport): string {
  const sections: string[] = [];
  const token = report.tokenInfo;

  // Header
  sections.push('═══════════════════════════════════');
  if (token) {
    const price = token.priceUsd ? `$${parseFloat(token.priceUsd).toFixed(8)}` : 'N/A';
    sections.push(`🔍 TOKEN ANALYSIS: ${token.name} (${token.symbol})`);
    sections.push(`Price: ${price}`);
    if (token.priceChange24h) {
      sections.push(`24h Change: ${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`);
    }
    if (token.fdvUsd) {
      sections.push(`FDV: $${(parseFloat(token.fdvUsd) / 1e6).toFixed(2)}M`);
    }
    if (token.volume24h) {
      sections.push(`24h Volume: $${(parseFloat(token.volume24h) / 1e3).toFixed(1)}K`);
    }
  } else {
    sections.push(`🔍 TOKEN ANALYSIS: ${report.address}`);
  }
  sections.push(`Network: ${report.network.toUpperCase()}`);
  sections.push('═══════════════════════════════════');

  // Overall Assessment
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
    unknown: '⚪',
  };
  sections.push('');
  sections.push(`${riskEmoji[report.riskLevel]} OVERALL ASSESSMENT`);
  sections.push(`Risk Level: ${report.riskLevel.toUpperCase()}`);
  sections.push(`Score: ${report.overallScore}/100`);

  // Honeypot Analysis
  if (report.honeypot) {
    sections.push('');
    sections.push('🍯 HONEYPOT CHECK');
    if (report.honeypot.isHoneypot) {
      sections.push(`🚨 WARNING: THIS IS A HONEYPOT`);
      sections.push(`Reason: ${report.honeypot.honeypotReason || 'Unable to sell tokens'}`);
    } else if (report.honeypot.simulationSuccess) {
      sections.push(`✅ Buy/Sell simulation: PASSED`);
      sections.push(`Buy Tax: ${report.honeypot.buyTax.toFixed(2)}%`);
      sections.push(`Sell Tax: ${report.honeypot.sellTax.toFixed(2)}%`);
      if (report.honeypot.transferTax > 0) {
        sections.push(`Transfer Tax: ${report.honeypot.transferTax.toFixed(2)}%`);
      }
    }
    if (report.honeypot.holderCount) {
      sections.push(`Holders: ${report.honeypot.holderCount.toLocaleString()}`);
    }
    sections.push(`Open Source: ${report.honeypot.isOpenSource ? 'Yes ✅' : 'No ⚠️'}`);
    sections.push(`Is Proxy: ${report.honeypot.isProxy ? 'Yes ⚠️' : 'No'}`);
    sections.push(`Mintable: ${report.honeypot.isMintable ? 'Yes ⚠️' : 'No ✅'}`);
    if (report.honeypot.canTakeBackOwnership) {
      sections.push(`🚨 Owner can reclaim ownership!`);
    }
  }

  // Contract Verification
  if (report.verification) {
    sections.push('');
    sections.push('📋 CONTRACT VERIFICATION');
    sections.push(`Verified: ${report.verification.isVerified ? 'Yes ✅' : 'NO ⚠️'}`);
    if (report.verification.contractName) {
      sections.push(`Contract: ${report.verification.contractName}`);
    }
    if (report.verification.compiler) {
      sections.push(`Compiler: ${report.verification.compiler}`);
    }
    if (report.verification.license) {
      sections.push(`License: ${report.verification.license}`);
    }
  }

  // Security Analysis
  if (report.securityAnalysis) {
    sections.push('');
    sections.push('🔒 SECURITY ANALYSIS');
    sections.push(`Score: ${report.securityAnalysis.score}/100`);

    if (report.securityAnalysis.issues.length > 0) {
      sections.push('');
      sections.push('Issues Found:');
      for (const issue of report.securityAnalysis.issues.slice(0, 5)) {
        const icon = issue.severity === 'critical' ? '🚨' :
                     issue.severity === 'high' ? '⚠️' : '⚡';
        sections.push(`${icon} [${issue.severity.toUpperCase()}] ${issue.name}`);
        sections.push(`   ${issue.description}`);
      }
    }

    if (report.securityAnalysis.gasOptimizations.length > 0) {
      sections.push('');
      sections.push('Gas Optimizations:');
      for (const opt of report.securityAnalysis.gasOptimizations.slice(0, 3)) {
        sections.push(`⛽ ${opt.name}: ${opt.description}`);
      }
    }
  }

  // Deployer Intelligence
  if (report.deployerIntel) {
    sections.push('');
    sections.push('🔍 DEPLOYER INTELLIGENCE');
    sections.push(`Address: ${report.deployerIntel.deployer.address.slice(0, 10)}...`);
    sections.push(`Risk: ${report.deployerIntel.overallRisk.toUpperCase()}`);

    if (report.deployerIntel.deployer.clankerInfo) {
      const c = report.deployerIntel.deployer.clankerInfo;
      sections.push('');
      sections.push('Clanker (Farcaster Launch):');
      if (c.deployerUsername) {
        sections.push(`• Deployer: @${c.deployerUsername} (FID: ${c.deployerFid})`);
      }
      if (c.deployerFollowers) {
        sections.push(`• Followers: ${c.deployerFollowers.toLocaleString()}`);
      }
      if (c.isVerifiedBuilder) {
        sections.push('• ✅ Verified Builder');
      }
      if (c.holders) {
        sections.push(`• Holders: ${c.holders.toLocaleString()}`);
      }
    }

    if (report.deployerIntel.deployer.webacyScore) {
      const w = report.deployerIntel.deployer.webacyScore;
      sections.push('');
      sections.push('Webacy Risk Analysis:');
      sections.push(`• Risk Score: ${w.riskScore}/100 (${w.riskLevel})`);
      if (w.sanctioned) sections.push('• ⚠️ SANCTIONED ADDRESS');
      if (w.rugPullHistory) sections.push('• ⚠️ Rug Pull History');
      if (w.mixerUsage) sections.push('• ⚠️ Mixer Usage Detected');
    }

    if (report.deployerIntel.deployer.history) {
      const h = report.deployerIntel.deployer.history;
      sections.push('');
      sections.push('Deployment History:');
      sections.push(`• Contracts Deployed: ${h.contractsDeployed}`);
      sections.push(`• Reputation: ${h.reputation}`);
    }

    sections.push('');
    sections.push(`Recommendation: ${report.deployerIntel.recommendation}`);
  }

  // Whale/Holder Analysis
  if (report.whaleAnalysis) {
    sections.push('');
    sections.push('🐋 WHALE ANALYSIS');
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };
    sections.push(`${riskEmoji[report.whaleAnalysis.riskLevel]} Risk Level: ${report.whaleAnalysis.riskLevel.toUpperCase()}`);
    sections.push(`Total Holders: ${report.whaleAnalysis.totalHolders.toLocaleString()}`);
    sections.push(`Top 10 Concentration: ${report.whaleAnalysis.holderConcentration.toFixed(1)}%`);
    sections.push(`Whale Count (>1%): ${report.whaleAnalysis.whaleCount}`);

    if (report.whaleAnalysis.topHolders.length > 0) {
      sections.push('');
      sections.push('Top Holders:');
      for (let i = 0; i < Math.min(5, report.whaleAnalysis.topHolders.length); i++) {
        const holder = report.whaleAnalysis.topHolders[i];
        const addr = `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`;
        sections.push(`${i + 1}. ${addr}: ${holder.percentageOfSupply.toFixed(2)}%`);
      }
    }
  }

  // Liquidity & Pools
  if (report.pools.length > 0) {
    sections.push('');
    sections.push('💧 LIQUIDITY');
    const totalLiquidity = report.pools.reduce(
      (sum, p) => sum + parseFloat(p.reserveUsd || '0'), 0
    );
    sections.push(`Total Liquidity: $${totalLiquidity.toLocaleString()}`);
    sections.push('');
    sections.push('Top Pools:');
    for (const pool of report.pools.slice(0, 3)) {
      sections.push(`• ${pool.name} on ${pool.dex}`);
      if (pool.reserveUsd) {
        sections.push(`  Liquidity: $${parseFloat(pool.reserveUsd).toLocaleString()}`);
      }
      if (pool.volume24h) {
        sections.push(`  24h Volume: $${parseFloat(pool.volume24h).toLocaleString()}`);
      }
    }
  }

  // Farcaster Sentiment
  if (report.farcasterSentiment && report.farcasterSentiment.mentionCount > 0) {
    sections.push('');
    sections.push('📱 FARCASTER SENTIMENT');
    sections.push(`Mentions (7d): ${report.farcasterSentiment.mentionCount}`);
    sections.push(`Sentiment: ${report.farcasterSentiment.sentiment.toUpperCase()}`);

    if (report.farcasterSentiment.topMentioners.length > 0) {
      sections.push(`Top Mentioners: @${report.farcasterSentiment.topMentioners.join(', @')}`);
    }

    if (report.farcasterSentiment.recentMentions.length > 0) {
      sections.push('');
      sections.push('Recent Mentions:');
      for (const mention of report.farcasterSentiment.recentMentions.slice(0, 3)) {
        sections.push(`• @${mention.author}: "${mention.text.slice(0, 100)}..."`);
      }
    }
  }

  // @bankr Mentions
  if (report.bankrMentions?.found) {
    sections.push('');
    sections.push('💰 @BANKR MENTIONS');
    for (const mention of report.bankrMentions.mentions) {
      const sentimentIcon = mention.sentiment === 'positive' ? '📈' :
                           mention.sentiment === 'negative' ? '📉' : '➡️';
      sections.push(`${sentimentIcon} "${mention.text.slice(0, 150)}..."`);
    }
  }

  // GoPlus Security Analysis
  if (report.goplusSecurity) {
    sections.push('');
    sections.push('🛡️ GOPLUS SECURITY');
    const riskEmoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🟠',
      CRITICAL: '🔴',
    };
    sections.push(`${riskEmoji[report.goplusSecurity.riskLevel]} Risk Level: ${report.goplusSecurity.riskLevel}`);
    sections.push(`Security Score: ${report.goplusSecurity.riskScore}/100`);

    if (report.goplusSecurity.security) {
      const sec = report.goplusSecurity.security;
      sections.push(`Open Source: ${sec.is_open_source === '1' ? 'Yes ✅' : 'No ⚠️'}`);
      sections.push(`Honeypot: ${sec.is_honeypot === '1' ? 'YES 🚨' : 'No ✅'}`);
      sections.push(`Mintable: ${sec.is_mintable === '1' ? 'Yes ⚠️' : 'No ✅'}`);

      const buyTax = parseFloat(sec.buy_tax || '0') * 100;
      const sellTax = parseFloat(sec.sell_tax || '0') * 100;
      sections.push(`Taxes: Buy ${buyTax.toFixed(1)}% / Sell ${sellTax.toFixed(1)}%`);
    }

    if (report.goplusSecurity.risks.length > 0) {
      sections.push('');
      sections.push('Risk Factors:');
      for (const risk of report.goplusSecurity.risks.slice(0, 5)) {
        const severityEmoji = {
          LOW: '⚪',
          MEDIUM: '🟡',
          HIGH: '🟠',
          CRITICAL: '🔴',
        };
        sections.push(`${severityEmoji[risk.severity]} ${risk.title}: ${risk.description}`);
      }
    }
  }

  // DeFi Llama Analysis
  if (report.defiLlama) {
    sections.push('');
    sections.push('📊 DEFI LLAMA DATA');

    if (report.defiLlama.tokenPrice) {
      sections.push(`Price: $${report.defiLlama.tokenPrice.price.toFixed(report.defiLlama.tokenPrice.price < 0.01 ? 8 : 4)}`);
    }

    if (report.defiLlama.protocols.length > 0) {
      sections.push('');
      sections.push('Protocol Data:');
      for (const protocol of report.defiLlama.protocols) {
        sections.push(`• ${protocol.name} (${protocol.symbol || 'N/A'})`);
        if (protocol.tvl) sections.push(`  TVL: $${(protocol.tvl / 1e6).toFixed(2)}M`);
        if (protocol.category) sections.push(`  Category: ${protocol.category}`);
      }
    }

    if (report.defiLlama.yieldPools.length > 0) {
      sections.push('');
      sections.push('Yield Opportunities:');
      for (const pool of report.defiLlama.yieldPools.slice(0, 3)) {
        sections.push(`• ${pool.project} on ${pool.chain}: ${pool.apy.toFixed(2)}% APY`);
      }
    }

    if (report.defiLlama.chainTVL) {
      sections.push('');
      sections.push(`${report.defiLlama.chain.toUpperCase()} Chain TVL: $${(report.defiLlama.chainTVL / 1e9).toFixed(2)}B`);
    }

    if (report.defiLlama.insights.length > 0) {
      sections.push('');
      sections.push('Insights:');
      for (const insight of report.defiLlama.insights.slice(0, 3)) {
        sections.push(`• ${insight}`);
      }
    }
  }

  // Summary of Warnings and Positives
  if (report.warnings.length > 0) {
    sections.push('');
    sections.push('⚠️ WARNINGS');
    for (const warning of report.warnings) {
      sections.push(`• ${warning}`);
    }
  }

  if (report.positives.length > 0) {
    sections.push('');
    sections.push('✅ POSITIVES');
    for (const positive of report.positives) {
      sections.push(`• ${positive}`);
    }
  }

  // Footer
  sections.push('');
  sections.push('═══════════════════════════════════');
  sections.push(`Report generated: ${new Date(report.timestamp).toLocaleString()}`);
  sections.push('DYOR - This is not financial advice');
  sections.push('═══════════════════════════════════');

  return sections.join('\n');
}
