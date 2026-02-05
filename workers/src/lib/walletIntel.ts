/**
 * Wallet Intelligence Module
 * Provides deployer reputation, wallet risk scores, and builder identification
 *
 * Sources:
 * - Webacy: Wallet risk scoring and threat detection
 * - Etherscan: Deployer history and contract patterns
 * - Clanker.world: Farcaster-native token deployer info
 * - Alchemy: Token portfolio and contract deployment history
 */

import { Env } from './types';
import { getDeployerPortfolio, DeployerPortfolio } from './alchemy';
import { getTalentAnalysis, TalentAnalysis, isKnownBuilder } from './talentprotocol';

// ============================================================================
// Types
// ============================================================================

export interface WebacyRiskScore {
  address: string;
  riskScore: number; // 0-100, higher = riskier
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  sanctioned: boolean;
  mixerUsage: boolean;
  rugPullHistory: boolean;
  approvalRisks: number;
  lastActivity?: string;
}

export interface DeployerHistory {
  address: string;
  contractsDeployed: number;
  verifiedContracts: number;
  ruggedProjects: string[];
  successfulProjects: string[];
  firstDeployment?: string;
  totalValueLocked?: string;
  reputation: 'unknown' | 'new' | 'established' | 'trusted' | 'suspicious';
}

export interface ClankerTokenInfo {
  address: string;
  name: string;
  symbol: string;
  deployerFid?: number;
  deployerUsername?: string;
  deployerFollowers?: number;
  adminAddress?: string; // The admin wallet address (deployer)
  castHash?: string;
  launchDate?: string;
  marketCap?: string;
  holders?: number;
  isVerifiedBuilder?: boolean;
}

export interface WalletIntelligence {
  deployer: {
    address: string;
    webacyScore?: WebacyRiskScore;
    history?: DeployerHistory;
    clankerInfo?: ClankerTokenInfo;
    portfolio?: DeployerPortfolio;
    talentScore?: TalentAnalysis;
  };
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  positiveFactors: string[];
  recommendation: string;
}

// ============================================================================
// Webacy Integration
// ============================================================================

/**
 * Get wallet/token risk score from Webacy API
 * Webacy provides threat detection, sanction screening, and risk scoring
 * Docs: https://docs.webacy.com/api-reference/authentication
 */
export async function getWebacyRiskScore(
  env: Env,
  address: string,
  chain: string = 'base'
): Promise<WebacyRiskScore | null> {
  const apiKey = env.WEBACY_API_KEY;

  if (!apiKey) {
    console.log('Webacy: API key not configured, skipping risk check');
    return null;
  }

  try {
    // Webacy chain codes: eth, bsc, pol, arb, opt, base
    const chainCodes: Record<string, string> = {
      ethereum: 'eth',
      eth: 'eth',
      base: 'base',
      arbitrum: 'arb',
      optimism: 'opt',
      polygon: 'pol',
      bsc: 'bsc',
    };

    const chainCode = chainCodes[chain.toLowerCase()] || 'base';

    // Webacy API: GET /addresses/{address}?chain={chain}
    // Auth: x-api-key header
    const response = await fetch(
      `https://api.webacy.com/addresses/${address}?chain=${chainCode}`,
      {
        headers: {
          'x-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webacy: API error', response.status, errorText);
      return null;
    }

    // Webacy response structure
    interface WebacyTag {
      key: string;
      name: string;
      severity: number;
      description: string;
      context?: {
        creator_address?: string;
        owner_address?: string;
        [key: string]: unknown;
      };
    }

    interface WebacyIssue {
      score: number;
      tags: WebacyTag[];
    }

    const data = await response.json() as {
      overallRisk: number;
      count: number;
      medium: number;
      high: number;
      issues: WebacyIssue[];
    };

    // overallRisk is 0-100, lower is better
    const riskScore = Math.round(data.overallRisk);
    let riskLevel: WebacyRiskScore['riskLevel'] = 'low';

    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 25) riskLevel = 'medium';

    // Extract flags from tags
    const flags: string[] = [];
    let sanctioned = false;
    let mixerUsage = false;
    let rugPullHistory = false;

    for (const issue of data.issues || []) {
      for (const tag of issue.tags || []) {
        flags.push(tag.name);

        // Check for specific risk indicators
        if (tag.key === 'sanctioned' || tag.key === 'ofac_sanctioned') {
          sanctioned = true;
        }
        if (tag.key === 'mixer_usage' || tag.key === 'tumbler') {
          mixerUsage = true;
        }
        if (tag.key === 'rug_pull' || tag.key === 'rugpull_history') {
          rugPullHistory = true;
        }
      }
    }

    console.log('Webacy: Risk score', riskScore, 'for', address, '- issues:', data.count);

    return {
      address,
      riskScore,
      riskLevel,
      flags,
      sanctioned,
      mixerUsage,
      rugPullHistory,
      approvalRisks: data.medium + data.high,
    };
  } catch (error) {
    console.error('Webacy: Failed to get risk score:', error);
    return null;
  }
}

/**
 * Get creator address from Webacy response
 * Webacy includes creator_address in tag context
 */
export async function getCreatorFromWebacy(
  env: Env,
  tokenAddress: string,
  chain: string = 'base'
): Promise<string | null> {
  const apiKey = env.WEBACY_API_KEY;
  if (!apiKey) return null;

  try {
    const chainCodes: Record<string, string> = {
      ethereum: 'eth', eth: 'eth', base: 'base',
      arbitrum: 'arb', optimism: 'opt', polygon: 'pol', bsc: 'bsc',
    };
    const chainCode = chainCodes[chain.toLowerCase()] || 'base';

    const response = await fetch(
      `https://api.webacy.com/addresses/${tokenAddress}?chain=${chainCode}`,
      { headers: { 'x-api-key': apiKey } }
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      issues?: Array<{
        tags?: Array<{
          context?: {
            creator_address?: string;
            owner_address?: string;
          };
        }>;
      }>;
    };

    // Find creator_address in any tag context
    for (const issue of data.issues || []) {
      for (const tag of issue.tags || []) {
        if (tag.context?.creator_address) {
          return tag.context.creator_address;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Contract Creator Lookup (Etherscan)
// ============================================================================

/**
 * Get the contract creator address from block explorer
 * Falls back to getting first transaction to the contract
 */
export async function getContractCreator(
  env: Env,
  contractAddress: string,
  chain: string = 'base'
): Promise<string | null> {
  const apiKey = env.ETHERSCAN_API_KEY;

  try {
    // Use chain-specific API for Base (no V2 key required for basic queries)
    const chainApis: Record<string, string> = {
      ethereum: 'https://api.etherscan.io/api',
      eth: 'https://api.etherscan.io/api',
      base: 'https://api.basescan.org/api',
      arbitrum: 'https://api.arbiscan.io/api',
      optimism: 'https://api-optimistic.etherscan.io/api',
      polygon: 'https://api.polygonscan.com/api',
    };

    const baseUrl = chainApis[chain.toLowerCase()] || chainApis.base;

    // Try getting the first internal tx to find creator
    let url = `${baseUrl}?module=account&action=txlistinternal&address=${contractAddress}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc`;
    if (apiKey) url += `&apikey=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Explorer: API error', response.status);
      return null;
    }

    const data = await response.json() as {
      status: string;
      message?: string;
      result?: Array<{
        from: string;
        to: string;
        type?: string;
      }> | string;
    };

    // Check if result is an array (success) or string (error message)
    if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
      // The 'from' of a 'create' type tx is the creator
      const createTx = data.result.find(tx => tx.type === 'create' || tx.type === 'create2');
      if (createTx) {
        console.log('Found contract creator via internal tx:', createTx.from);
        return createTx.from;
      }
    }

    // Fallback: try normal tx list to find deployment tx
    let txUrl = `${baseUrl}?module=account&action=txlist&address=${contractAddress}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc`;
    if (apiKey) txUrl += `&apikey=${apiKey}`;

    const txResponse = await fetch(txUrl);
    if (txResponse.ok) {
      const txData = await txResponse.json() as {
        status: string;
        result?: Array<{ from: string; to: string }> | string;
      };

      if (txData.status === '1' && Array.isArray(txData.result) && txData.result.length > 0) {
        // First tx 'from' is often the deployer
        console.log('Found potential creator via first tx:', txData.result[0].from);
        return txData.result[0].from;
      }
    }

    return null;
  } catch (error) {
    console.error('Explorer: Failed to get contract creator:', error);
    return null;
  }
}

// ============================================================================
// Deployer History (Etherscan)
// ============================================================================

/**
 * Get deployer's contract deployment history from Etherscan
 * Analyzes patterns to determine reputation
 */
export async function getDeployerHistory(
  env: Env,
  deployerAddress: string,
  chain: string = 'base'
): Promise<DeployerHistory | null> {
  const apiKey = env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    console.log('Etherscan: API key not configured');
    return null;
  }

  try {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      eth: 1,
      base: 8453,
      arbitrum: 42161,
      optimism: 10,
      polygon: 137,
    };

    const chainId = chainIds[chain.toLowerCase()] || 8453;

    // Get internal transactions (contract creations)
    const response = await fetch(
      `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlistinternal&address=${deployerAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`
    );

    if (!response.ok) {
      console.error('Etherscan: API error', response.status);
      return null;
    }

    const data = await response.json() as {
      status: string;
      result: Array<{
        contractAddress?: string;
        type?: string;
        timeStamp?: string;
        isError?: string;
      }>;
    };

    // Also get normal transactions to find contract deployments
    const txResponse = await fetch(
      `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${deployerAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`
    );

    const txData = await txResponse.json() as {
      status: string;
      result: Array<{
        to: string;
        contractAddress?: string;
        timeStamp?: string;
        isError?: string;
        input?: string;
      }>;
    };

    // Count contract deployments (transactions with empty 'to' field)
    const deployments = (txData.result || []).filter(
      tx => tx.to === '' && tx.contractAddress
    );

    const contractsDeployed = deployments.length;
    let firstDeployment: string | undefined;

    if (deployments.length > 0 && deployments[0].timeStamp) {
      firstDeployment = new Date(parseInt(deployments[0].timeStamp) * 1000).toISOString();
    }

    // Determine reputation based on history
    let reputation: DeployerHistory['reputation'] = 'unknown';

    if (contractsDeployed === 0) {
      reputation = 'unknown';
    } else if (contractsDeployed === 1) {
      reputation = 'new';
    } else if (contractsDeployed >= 5) {
      reputation = 'established';
    } else if (contractsDeployed >= 10) {
      reputation = 'trusted';
    }

    // Check for verified contracts (would need additional calls per contract)
    // For now, we'll estimate based on deployment count
    const verifiedContracts = Math.floor(contractsDeployed * 0.5); // Estimate

    return {
      address: deployerAddress,
      contractsDeployed,
      verifiedContracts,
      ruggedProjects: [], // Would need external database
      successfulProjects: [], // Would need external database
      firstDeployment,
      reputation,
    };
  } catch (error) {
    console.error('Etherscan: Failed to get deployer history:', error);
    return null;
  }
}

// ============================================================================
// Clanker.world Integration
// ============================================================================

/**
 * Get token info from Clanker.world API
 * Clanker is a Farcaster-native token launcher, so deployer info includes FID
 */
export async function getClankerInfo(
  env: Env,
  tokenAddress: string
): Promise<ClankerTokenInfo | null> {
  const apiKey = env.CLANKER_API_KEY;

  try {
    // Clanker API endpoint - use get-clanker-by-address for direct lookup
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Add API key if available
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(
      `https://www.clanker.world/api/get-clanker-by-address?address=${tokenAddress}`,
      { headers }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Token not found on Clanker - not a Clanker-launched token
        return null;
      }
      console.error('Clanker: API error', response.status);
      return null;
    }

    // Clanker API response structure (wrapped in data object)
    // Note: API returns 200 with {error: "Token not found"} for non-Clanker tokens
    const responseData = await response.json() as {
      error?: string;
      data?: {
        contract_address?: string;
        name?: string;
        symbol?: string;
        requestor_fid?: number;
        admin?: string;
        cast_hash?: string;
        created_at?: string;
        starting_market_cap?: number;
        tags?: {
          verified?: boolean;
          champagne?: boolean;
        };
        social_context?: {
          interface?: string;
          platform?: string;
          id?: string;
        };
      };
    };

    const data = responseData.data;
    if (!data) {
      return null;
    }

    console.log('Clanker: Found token', data.symbol, 'deployed by FID', data.requestor_fid);

    return {
      address: data.contract_address || tokenAddress,
      name: data.name || 'Unknown',
      symbol: data.symbol || '???',
      deployerFid: data.requestor_fid,
      deployerUsername: undefined, // Not in this endpoint - would need Neynar lookup
      deployerFollowers: undefined,
      adminAddress: data.admin, // The admin wallet address (deployer)
      castHash: data.cast_hash,
      launchDate: data.created_at,
      marketCap: data.starting_market_cap?.toString(),
      holders: undefined, // Not in this endpoint
      isVerifiedBuilder: data.tags?.verified,
    };
  } catch (error) {
    console.error('Clanker: Failed to get token info:', error);
    return null;
  }
}

/**
 * Search Clanker for tokens by deployer FID
 */
export async function getClankerTokensByDeployer(
  env: Env,
  deployerFid: number
): Promise<ClankerTokenInfo[]> {
  const apiKey = env.CLANKER_API_KEY;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(
      `https://www.clanker.world/api/tokens?requestor_fid=${deployerFid}`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    // Clanker API returns { data: [...] } structure
    const responseData = await response.json() as {
      data?: Array<{
        contract_address?: string;
        name?: string;
        symbol?: string;
        requestor_fid?: number;
        starting_market_cap?: number;
        tags?: {
          verified?: boolean;
        };
      }>;
    };

    return (responseData.data || []).map(t => ({
      address: t.contract_address || '',
      name: t.name || 'Unknown',
      symbol: t.symbol || '???',
      deployerFid: t.requestor_fid,
      deployerUsername: undefined,
      marketCap: t.starting_market_cap?.toString(),
      holders: undefined,
      isVerifiedBuilder: t.tags?.verified,
    }));
  } catch (error) {
    console.error('Clanker: Failed to get deployer tokens:', error);
    return [];
  }
}

// ============================================================================
// Combined Intelligence
// ============================================================================

/**
 * Get comprehensive wallet intelligence for a token deployer
 * Combines Webacy risk scoring, Etherscan history, and Clanker info
 */
export async function getWalletIntelligence(
  env: Env,
  tokenAddress: string,
  deployerAddress: string,
  chain: string = 'base'
): Promise<WalletIntelligence> {
  // Fetch all intelligence sources in parallel
  const [webacyScore, deployerHistory, clankerInfo, portfolio, talentScore] = await Promise.all([
    getWebacyRiskScore(env, deployerAddress, chain),
    getDeployerHistory(env, deployerAddress, chain),
    getClankerInfo(env, tokenAddress),
    getDeployerPortfolio(env, deployerAddress, chain),
    getTalentAnalysis(env, deployerAddress),
  ]);

  const riskFactors: string[] = [];
  const positiveFactors: string[] = [];

  // Analyze Webacy results
  if (webacyScore) {
    if (webacyScore.sanctioned) {
      riskFactors.push('⚠️ SANCTIONED ADDRESS - Do not interact');
    }
    if (webacyScore.rugPullHistory) {
      riskFactors.push('🚨 Deployer has rug pull history');
    }
    if (webacyScore.mixerUsage) {
      riskFactors.push('⚠️ Deployer has used mixers/tumblers');
    }
    if (webacyScore.riskLevel === 'critical') {
      riskFactors.push('🔴 Critical risk score from Webacy');
    } else if (webacyScore.riskLevel === 'high') {
      riskFactors.push('🟠 High risk score from Webacy');
    } else if (webacyScore.riskLevel === 'low') {
      positiveFactors.push('✅ Low risk score from Webacy');
    }
  }

  // Analyze deployer history
  if (deployerHistory) {
    if (deployerHistory.contractsDeployed === 0) {
      riskFactors.push('⚠️ No deployment history - new deployer');
    } else if (deployerHistory.contractsDeployed === 1) {
      riskFactors.push('⚠️ First contract from this deployer');
    } else if (deployerHistory.reputation === 'established') {
      positiveFactors.push(`✅ Established deployer (${deployerHistory.contractsDeployed} contracts)`);
    } else if (deployerHistory.reputation === 'trusted') {
      positiveFactors.push(`✅ Trusted deployer (${deployerHistory.contractsDeployed}+ contracts)`);
    }
  }

  // Analyze Clanker info
  if (clankerInfo) {
    positiveFactors.push('✅ Launched via Clanker (Farcaster-native)');

    if (clankerInfo.isVerifiedBuilder) {
      positiveFactors.push('✅ Verified builder on Clanker');
    }

    if (clankerInfo.deployerFollowers && clankerInfo.deployerFollowers > 1000) {
      positiveFactors.push(`✅ Deployer has ${clankerInfo.deployerFollowers.toLocaleString()} followers`);
    } else if (clankerInfo.deployerFollowers && clankerInfo.deployerFollowers < 100) {
      riskFactors.push(`⚠️ Deployer has only ${clankerInfo.deployerFollowers} followers`);
    }

    if (clankerInfo.holders && clankerInfo.holders > 1000) {
      positiveFactors.push(`✅ ${clankerInfo.holders.toLocaleString()} holders`);
    }
  }

  // Analyze Talent Protocol builder score
  if (talentScore && talentScore.isBuilder) {
    if (talentScore.reputation === 'RENOWNED') {
      positiveFactors.push(`✅ RENOWNED builder (Talent Score: ${talentScore.builderScore}/100)`);
    } else if (talentScore.reputation === 'ESTABLISHED') {
      positiveFactors.push(`✅ Established builder (Talent Score: ${talentScore.builderScore}/100)`);
    } else if (talentScore.reputation === 'EMERGING') {
      positiveFactors.push(`✅ Emerging builder (Talent Score: ${talentScore.builderScore}/100)`);
    } else if (talentScore.reputation === 'NEW') {
      positiveFactors.push(`📝 New builder on Talent Protocol (Score: ${talentScore.builderScore}/100)`);
    }

    if (talentScore.passport?.human_checkmark) {
      positiveFactors.push('✅ Human-verified identity on Talent Protocol');
    }

    if (talentScore.scoreBreakdown) {
      if (talentScore.scoreBreakdown.skills_score >= 60) {
        positiveFactors.push(`✅ Verified technical skills (${talentScore.scoreBreakdown.skills_score})`);
      }
      if (talentScore.scoreBreakdown.activity_score >= 60) {
        positiveFactors.push(`✅ Strong on-chain activity (${talentScore.scoreBreakdown.activity_score})`);
      }
    }

    if (talentScore.credentials.length >= 3) {
      positiveFactors.push(`✅ ${talentScore.credentials.length} verified credentials`);
    }
  }

  // Analyze Alchemy portfolio data
  if (portfolio) {
    // Check deployer token holdings
    if (portfolio.tokenBalances.length > 0) {
      positiveFactors.push(`📊 Deployer holds ${portfolio.tokenBalances.length} token(s)`);
    }

    // Add risk indicators from portfolio analysis
    for (const indicator of portfolio.riskIndicators) {
      if (indicator.includes('No prior') || indicator.includes('First contract')) {
        riskFactors.push(`⚠️ ${indicator}`);
      } else if (indicator.includes('Experienced') || indicator.includes('contracts)')) {
        positiveFactors.push(`✅ ${indicator}`);
      } else if (indicator.includes('obscure')) {
        riskFactors.push(`⚠️ ${indicator}`);
      }
    }

    // Check contract deployment count
    if (portfolio.contractsDeployed.length >= 5) {
      positiveFactors.push(`✅ Deployed ${portfolio.contractsDeployed.length}+ contracts`);
    }
  }

  // Calculate overall risk
  let overallRisk: WalletIntelligence['overallRisk'] = 'medium';

  if (webacyScore?.sanctioned || webacyScore?.rugPullHistory) {
    overallRisk = 'critical';
  } else if (webacyScore?.riskLevel === 'critical' || riskFactors.length >= 3) {
    overallRisk = 'critical';
  } else if (webacyScore?.riskLevel === 'high' || riskFactors.length >= 2) {
    overallRisk = 'high';
  } else if (positiveFactors.length > riskFactors.length && riskFactors.length === 0) {
    overallRisk = 'low';
  }

  // Generate recommendation
  let recommendation = '';

  if (overallRisk === 'critical') {
    recommendation = '🚫 AVOID - Critical risk factors detected. Do not invest.';
  } else if (overallRisk === 'high') {
    recommendation = '⚠️ HIGH RISK - Multiple concerns. Extreme caution advised.';
  } else if (overallRisk === 'medium') {
    recommendation = '⚡ MODERATE RISK - Some concerns. Do your own research.';
  } else {
    recommendation = '✅ LOWER RISK - Positive indicators. Standard caution still applies.';
  }

  return {
    deployer: {
      address: deployerAddress,
      webacyScore: webacyScore || undefined,
      history: deployerHistory || undefined,
      clankerInfo: clankerInfo || undefined,
      portfolio: portfolio || undefined,
      talentScore: talentScore || undefined,
    },
    overallRisk,
    riskFactors,
    positiveFactors,
    recommendation,
  };
}

/**
 * Format wallet intelligence for display in a report
 */
export function formatWalletIntelligence(intel: WalletIntelligence): string {
  const lines: string[] = [];

  lines.push('## 🔍 Deployer Intelligence');
  lines.push('');
  lines.push(`**Address:** \`${intel.deployer.address}\``);
  lines.push(`**Overall Risk:** ${intel.overallRisk.toUpperCase()}`);
  lines.push('');

  // Clanker info
  if (intel.deployer.clankerInfo) {
    const c = intel.deployer.clankerInfo;
    lines.push('### Clanker (Farcaster Launch)');
    if (c.deployerUsername) {
      lines.push(`- Deployer: @${c.deployerUsername} (FID: ${c.deployerFid})`);
    }
    if (c.deployerFollowers) {
      lines.push(`- Followers: ${c.deployerFollowers.toLocaleString()}`);
    }
    if (c.isVerifiedBuilder) {
      lines.push('- ✅ Verified Builder');
    }
    if (c.holders) {
      lines.push(`- Holders: ${c.holders.toLocaleString()}`);
    }
    lines.push('');
  }

  // Talent Protocol builder score
  if (intel.deployer.talentScore && intel.deployer.talentScore.isBuilder) {
    const t = intel.deployer.talentScore;
    lines.push('### Talent Protocol Builder Score');
    lines.push(`- Builder Score: ${t.builderScore}/100 (${t.reputation})`);
    if (t.passport?.human_checkmark) {
      lines.push('- ✅ Human-verified identity');
    }
    if (t.scoreBreakdown) {
      lines.push(`- Activity: ${t.scoreBreakdown.activity_score} | Identity: ${t.scoreBreakdown.identity_score} | Skills: ${t.scoreBreakdown.skills_score}`);
    }
    if (t.socials.length > 0) {
      const socialNames = t.socials.map(s => s.source).join(', ');
      lines.push(`- Connected: ${socialNames}`);
    }
    if (t.credentials.length > 0) {
      lines.push(`- ${t.credentials.length} verified credential(s)`);
    }
    lines.push('');
  }

  // Webacy score
  if (intel.deployer.webacyScore) {
    const w = intel.deployer.webacyScore;
    lines.push('### Webacy Risk Analysis');
    lines.push(`- Risk Score: ${w.riskScore}/100 (${w.riskLevel})`);
    if (w.sanctioned) lines.push('- ⚠️ SANCTIONED');
    if (w.rugPullHistory) lines.push('- ⚠️ Rug Pull History');
    if (w.mixerUsage) lines.push('- ⚠️ Mixer Usage Detected');
    lines.push('');
  }

  // Deployer history
  if (intel.deployer.history) {
    const h = intel.deployer.history;
    lines.push('### Deployment History');
    lines.push(`- Contracts Deployed: ${h.contractsDeployed}`);
    lines.push(`- Reputation: ${h.reputation}`);
    if (h.firstDeployment) {
      lines.push(`- First Deployment: ${h.firstDeployment.split('T')[0]}`);
    }
    lines.push('');
  }

  // Risk factors
  if (intel.riskFactors.length > 0) {
    lines.push('### ⚠️ Risk Factors');
    intel.riskFactors.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  // Positive factors
  if (intel.positiveFactors.length > 0) {
    lines.push('### ✅ Positive Factors');
    intel.positiveFactors.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  lines.push(`**Recommendation:** ${intel.recommendation}`);

  return lines.join('\n');
}
