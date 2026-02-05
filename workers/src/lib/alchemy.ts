/**
 * Alchemy API Integration
 * Provides NFT analysis, token balances, whale tracking, and enhanced on-chain data
 *
 * Features:
 * - NFT Collection Analysis: Floor price, holders, sales history, metadata
 * - Deployer Portfolio: Token holdings, other contracts deployed
 * - Whale Tracking: Top holders, large transfers, concentration risk
 * - Enhanced Token Data: Metadata, holder counts, transfer patterns
 */

import { Env } from './types';

// ============================================================================
// Types
// ============================================================================

export interface NFTCollectionAnalysis {
  contractAddress: string;
  name: string;
  symbol?: string;
  totalSupply?: number;
  floorPrice?: {
    marketplace: string;
    price: number;
    currency: string;
    priceUsd?: number;
  };
  owners?: number;
  bannerImageUrl?: string;
  imageUrl?: string;
  description?: string;
  externalUrl?: string;
  twitterUsername?: string;
  discordUrl?: string;
  // Sales data
  salesVolume24h?: number;
  salesCount24h?: number;
  averagePrice24h?: number;
  // Risk indicators
  washTradingScore?: number;
  holderConcentration?: number;
  isVerified?: boolean;
}

export interface NFTHolderInfo {
  ownerAddress: string;
  tokenCount: number;
  percentageOwned: number;
}

export interface TokenBalance {
  contractAddress: string;
  name?: string;
  symbol?: string;
  balance: string;
  balanceFormatted?: string;
  decimals?: number;
  logo?: string;
  priceUsd?: number;
  valueUsd?: number;
}

export interface DeployerPortfolio {
  address: string;
  tokenBalances: TokenBalance[];
  nftCount: number;
  totalValueUsd: number;
  contractsDeployed: string[];
  riskIndicators: string[];
}

export interface WhaleInfo {
  address: string;
  balance: string;
  balanceFormatted: string;
  percentageOfSupply: number;
  isContract: boolean;
  label?: string;
}

export interface TokenHolderAnalysis {
  contractAddress: string;
  totalHolders: number;
  topHolders: WhaleInfo[];
  holderConcentration: number; // % held by top 10
  whaleCount: number; // holders with >1% supply
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
}

export interface TransferEvent {
  from: string;
  to: string;
  value: string;
  valueFormatted?: string;
  blockNumber: number;
  transactionHash: string;
  timestamp?: string;
}

export interface WhaleAlert {
  type: 'large_transfer' | 'new_whale' | 'whale_exit';
  transfer: TransferEvent;
  significance: 'medium' | 'high' | 'critical';
  description: string;
}

// ============================================================================
// Alchemy API Helpers
// ============================================================================

function getAlchemyBaseUrl(chain: string): string {
  const chainUrls: Record<string, string> = {
    ethereum: 'https://eth-mainnet.g.alchemy.com',
    eth: 'https://eth-mainnet.g.alchemy.com',
    base: 'https://base-mainnet.g.alchemy.com',
    arbitrum: 'https://arb-mainnet.g.alchemy.com',
    optimism: 'https://opt-mainnet.g.alchemy.com',
    polygon: 'https://polygon-mainnet.g.alchemy.com',
  };
  return chainUrls[chain.toLowerCase()] || chainUrls.base;
}

async function alchemyRequest(
  env: Env,
  chain: string,
  method: string,
  params: unknown[],
  version: 'v2' | 'v3' = 'v2'
): Promise<unknown> {
  const apiKey = env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.log('Alchemy: API key not configured');
    return null;
  }

  const baseUrl = getAlchemyBaseUrl(chain);
  const url = `${baseUrl}/${version}/${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      console.error('Alchemy: API error', response.status);
      return null;
    }

    const data = await response.json() as { result?: unknown; error?: { message: string } };
    if (data.error) {
      console.error('Alchemy: RPC error', data.error.message);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error('Alchemy: Request failed', error);
    return null;
  }
}

async function alchemyNFTRequest(
  env: Env,
  chain: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const apiKey = env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.log('Alchemy: API key not configured');
    return null;
  }

  const baseUrl = getAlchemyBaseUrl(chain);
  const queryString = new URLSearchParams(params).toString();
  const url = `${baseUrl}/nft/v3/${apiKey}/${endpoint}${queryString ? '?' + queryString : ''}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('Alchemy NFT: API error', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Alchemy NFT: Request failed', error);
    return null;
  }
}

// ============================================================================
// NFT Collection Analysis
// ============================================================================

/**
 * Get comprehensive NFT collection analysis
 */
export async function getNFTCollectionAnalysis(
  env: Env,
  contractAddress: string,
  chain: string = 'base'
): Promise<NFTCollectionAnalysis | null> {
  const apiKey = env.ALCHEMY_API_KEY;
  if (!apiKey) return null;

  try {
    // Fetch collection metadata
    const metadata = await alchemyNFTRequest(env, chain, 'getContractMetadata', {
      contractAddress,
    }) as {
      contractMetadata?: {
        name?: string;
        symbol?: string;
        totalSupply?: string;
        tokenType?: string;
        openSeaMetadata?: {
          floorPrice?: number;
          collectionName?: string;
          collectionSlug?: string;
          safelistRequestStatus?: string;
          imageUrl?: string;
          description?: string;
          externalUrl?: string;
          twitterUsername?: string;
          discordUrl?: string;
          bannerImageUrl?: string;
        };
      };
    } | null;

    if (!metadata?.contractMetadata) {
      return null;
    }

    const cm = metadata.contractMetadata;
    const osm = cm.openSeaMetadata || {};

    // Get floor price from OpenSea metadata if available
    let floorPrice = undefined;
    if (osm.floorPrice && osm.floorPrice > 0) {
      floorPrice = {
        marketplace: 'OpenSea',
        price: osm.floorPrice,
        currency: 'ETH',
      };
    }

    // Get holder count
    const owners = await getNFTOwnerCount(env, contractAddress, chain);

    // Get top holders for concentration analysis
    const topHolders = await getNFTTopHolders(env, contractAddress, chain, 10);
    const holderConcentration = topHolders.reduce((sum, h) => sum + h.percentageOwned, 0);

    return {
      contractAddress,
      name: cm.name || osm.collectionName || 'Unknown',
      symbol: cm.symbol,
      totalSupply: cm.totalSupply ? parseInt(cm.totalSupply) : undefined,
      floorPrice,
      owners,
      bannerImageUrl: osm.bannerImageUrl,
      imageUrl: osm.imageUrl,
      description: osm.description,
      externalUrl: osm.externalUrl,
      twitterUsername: osm.twitterUsername,
      discordUrl: osm.discordUrl,
      holderConcentration,
      isVerified: osm.safelistRequestStatus === 'verified',
    };
  } catch (error) {
    console.error('Alchemy: NFT collection analysis failed', error);
    return null;
  }
}

/**
 * Get NFT owner count
 */
async function getNFTOwnerCount(
  env: Env,
  contractAddress: string,
  chain: string
): Promise<number | undefined> {
  try {
    const result = await alchemyNFTRequest(env, chain, 'getOwnersForContract', {
      contractAddress,
      withTokenBalances: 'false',
    }) as { owners?: string[] } | null;

    return result?.owners?.length;
  } catch {
    return undefined;
  }
}

/**
 * Get top NFT holders
 */
export async function getNFTTopHolders(
  env: Env,
  contractAddress: string,
  chain: string = 'base',
  limit: number = 10
): Promise<NFTHolderInfo[]> {
  try {
    const result = await alchemyNFTRequest(env, chain, 'getOwnersForContract', {
      contractAddress,
      withTokenBalances: 'true',
    }) as {
      owners?: Array<{
        ownerAddress: string;
        tokenBalances: Array<{ balance: string }>;
      }>;
    } | null;

    if (!result?.owners) return [];

    // Calculate total supply from balances
    const totalSupply = result.owners.reduce((sum, owner) => {
      return sum + owner.tokenBalances.reduce((s, tb) => s + parseInt(tb.balance || '0'), 0);
    }, 0);

    // Sort by token count and return top holders
    const sorted = result.owners
      .map(owner => {
        const tokenCount = owner.tokenBalances.reduce(
          (s, tb) => s + parseInt(tb.balance || '0'),
          0
        );
        return {
          ownerAddress: owner.ownerAddress,
          tokenCount,
          percentageOwned: totalSupply > 0 ? (tokenCount / totalSupply) * 100 : 0,
        };
      })
      .sort((a, b) => b.tokenCount - a.tokenCount)
      .slice(0, limit);

    return sorted;
  } catch (error) {
    console.error('Alchemy: Failed to get NFT top holders', error);
    return [];
  }
}

// ============================================================================
// Token Holder Analysis (Whale Tracking)
// ============================================================================

// Known burn addresses
const BURN_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0xdead000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000001',
]);

// Known DEX factory addresses on Base
const DEX_FACTORIES: Record<string, string> = {
  '0x8909dc15e40173ff4699343b6eb8132c65e18ec6': 'Uniswap V3',
  '0x33128a8fc17869897dce68ed026d694621f6fdfd': 'Uniswap V3',
  '0x420dd381b31aef6683db6b902084cb0ffece40da': 'Aerodrome',
  '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f': 'Uniswap V2',
  '0x02f9e29c830db69f73a84bce8302e1360f79e56e': 'BaseSwap',
};

// Known router addresses (not pools but often hold tokens)
const KNOWN_CONTRACTS: Record<string, string> = {
  '0x2626664c2603336e57b271c5c0b26f421741e481': 'Uniswap Router',
  '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24': 'Aerodrome Router',
  '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43': 'Aerodrome Voter',
  '0x3a63171dd9bebb5eb9e5c6e6d0e0b8758e20e50f': 'Aerodrome Gauge',
};

/**
 * Check if an address is a contract
 */
async function isContractAddress(
  env: Env,
  address: string,
  chain: string
): Promise<boolean> {
  try {
    const code = await alchemyRequest(env, chain, 'eth_getCode', [address, 'latest']) as string | null;
    return code !== null && code !== '0x' && code !== '0x0';
  } catch {
    return false;
  }
}

/**
 * Try to identify if a contract is an LP pool
 * Checks for common LP patterns (Uniswap V2/V3, Aerodrome)
 */
async function identifyPoolContract(
  env: Env,
  address: string,
  chain: string
): Promise<{ isPool: boolean; dex?: string; token0?: string; token1?: string }> {
  try {
    // Try calling token0() - common in Uniswap V2/Aerodrome style pools
    const token0Result = await alchemyRequest(env, chain, 'eth_call', [{
      to: address,
      data: '0x0dfe1681', // token0()
    }, 'latest']) as string | null;

    if (token0Result && token0Result !== '0x' && token0Result.length >= 66) {
      // This is likely a pool! Try to get token1 too
      const token1Result = await alchemyRequest(env, chain, 'eth_call', [{
        to: address,
        data: '0xd21220a7', // token1()
      }, 'latest']) as string | null;

      // Try to identify the DEX by checking factory()
      const factoryResult = await alchemyRequest(env, chain, 'eth_call', [{
        to: address,
        data: '0xc45a0155', // factory()
      }, 'latest']) as string | null;

      let dex = 'Unknown LP';
      if (factoryResult && factoryResult.length >= 66) {
        const factoryAddress = '0x' + factoryResult.slice(26).toLowerCase();
        dex = DEX_FACTORIES[factoryAddress] || 'LP Pool';
      }

      return {
        isPool: true,
        dex,
        token0: token0Result ? '0x' + token0Result.slice(26) : undefined,
        token1: token1Result ? '0x' + token1Result.slice(26) : undefined,
      };
    }

    return { isPool: false };
  } catch {
    return { isPool: false };
  }
}

/**
 * Get label for a known address
 */
function getAddressLabel(address: string): string | undefined {
  const lower = address.toLowerCase();

  if (BURN_ADDRESSES.has(lower)) {
    return 'Burn Address';
  }

  if (KNOWN_CONTRACTS[lower]) {
    return KNOWN_CONTRACTS[lower];
  }

  return undefined;
}

/**
 * Get token holder analysis with whale detection
 * Identifies LPs, burn addresses, and actual whales
 */
export async function getTokenHolderAnalysis(
  env: Env,
  contractAddress: string,
  chain: string = 'base'
): Promise<TokenHolderAnalysis | null> {
  const apiKey = env.ALCHEMY_API_KEY;
  if (!apiKey) return null;

  try {
    const transfers = await getRecentTransfers(env, contractAddress, chain, 1000);
    if (!transfers || transfers.length === 0) {
      return null;
    }

    // Build holder map from transfers
    const holderBalances = new Map<string, bigint>();

    for (const transfer of transfers) {
      const value = BigInt(transfer.value || '0');

      // Decrease sender balance
      if (transfer.from !== '0x0000000000000000000000000000000000000000') {
        const current = holderBalances.get(transfer.from.toLowerCase()) || BigInt(0);
        holderBalances.set(transfer.from.toLowerCase(), current - value);
      }

      // Increase receiver balance
      if (transfer.to !== '0x0000000000000000000000000000000000000000') {
        const current = holderBalances.get(transfer.to.toLowerCase()) || BigInt(0);
        holderBalances.set(transfer.to.toLowerCase(), current + value);
      }
    }

    // Filter out zero/negative balances and sort
    const positiveHolders = Array.from(holderBalances.entries())
      .filter(([, balance]) => balance > BigInt(0))
      .sort((a, b) => (b[1] > a[1] ? 1 : -1));

    // Calculate total supply from positive balances
    const totalSupply = positiveHolders.reduce((sum, [, bal]) => sum + bal, BigInt(0));

    // Get top 30 holders and identify their types
    const topHoldersRaw = positiveHolders.slice(0, 30);

    // Check top holders for contract status and LP identification in parallel
    const holderChecks = await Promise.all(
      topHoldersRaw.map(async ([address, balance]) => {
        const percentage = totalSupply > BigInt(0)
          ? Number((balance * BigInt(10000)) / totalSupply) / 100
          : 0;

        // Check for known addresses first
        const knownLabel = getAddressLabel(address);
        if (knownLabel) {
          return {
            address,
            balance: balance.toString(),
            balanceFormatted: formatTokenBalance(balance.toString(), 18),
            percentageOfSupply: percentage,
            isContract: true,
            label: knownLabel,
            isExcludedFromWhaleCalc: true,
          };
        }

        // Check if it's a contract
        const isContract = await isContractAddress(env, address, chain);

        if (isContract) {
          // Try to identify if it's an LP pool
          const poolInfo = await identifyPoolContract(env, address, chain);

          if (poolInfo.isPool) {
            return {
              address,
              balance: balance.toString(),
              balanceFormatted: formatTokenBalance(balance.toString(), 18),
              percentageOfSupply: percentage,
              isContract: true,
              label: poolInfo.dex || 'LP Pool',
              isExcludedFromWhaleCalc: true,
            };
          }

          // It's a contract but not identified as an LP
          // If it holds > 20% of supply, it's likely infrastructure (LP, staking, bridge, vault)
          // and should be excluded from whale calculations
          const isLikelyInfrastructure = percentage >= 20;
          const label = isLikelyInfrastructure ? 'Large Contract (likely LP/Staking)' : 'Contract';

          return {
            address,
            balance: balance.toString(),
            balanceFormatted: formatTokenBalance(balance.toString(), 18),
            percentageOfSupply: percentage,
            isContract: true,
            label,
            isExcludedFromWhaleCalc: isLikelyInfrastructure,
          };
        }

        // Regular wallet
        return {
          address,
          balance: balance.toString(),
          balanceFormatted: formatTokenBalance(balance.toString(), 18),
          percentageOfSupply: percentage,
          isContract: false,
          label: undefined,
          isExcludedFromWhaleCalc: false,
        };
      })
    );

    // Separate whales from excluded addresses
    const topHolders: WhaleInfo[] = holderChecks.slice(0, 20).map(h => ({
      address: h.address,
      balance: h.balance,
      balanceFormatted: h.balanceFormatted,
      percentageOfSupply: h.percentageOfSupply,
      isContract: h.isContract,
      label: h.label,
    }));

    // Calculate metrics EXCLUDING LPs and burn addresses
    const actualWhales = holderChecks.filter(h => !h.isExcludedFromWhaleCalc);
    const excludedHolders = holderChecks.filter(h => h.isExcludedFromWhaleCalc);

    // Calculate concentration among actual holders (excluding LP/burn)
    const actualTop10 = actualWhales.slice(0, 10);
    const actualTop10Concentration = actualTop10.reduce((sum, h) => sum + h.percentageOfSupply, 0);
    const actualWhaleCount = actualWhales.filter(h => h.percentageOfSupply >= 1).length;

    // Calculate LP/contract and burn percentages
    const lpAndContractPercentage = excludedHolders
      .filter(h =>
        h.label?.includes('LP') ||
        h.label?.includes('Pool') ||
        h.label?.includes('Aerodrome') ||
        h.label?.includes('Uniswap') ||
        h.label?.includes('Large Contract')
      )
      .reduce((sum, h) => sum + h.percentageOfSupply, 0);
    const burnPercentage = excludedHolders
      .filter(h => h.label === 'Burn Address')
      .reduce((sum, h) => sum + h.percentageOfSupply, 0);

    // Determine risk level based on ACTUAL whale concentration
    let riskLevel: TokenHolderAnalysis['riskLevel'] = 'low';
    const warnings: string[] = [];

    // Add informational notes about LP/contracts and burns
    if (lpAndContractPercentage > 0) {
      warnings.push(`💧 ${lpAndContractPercentage.toFixed(1)}% in LP/staking contracts`);
    }
    if (burnPercentage > 0) {
      warnings.push(`🔥 ${burnPercentage.toFixed(1)}% burned`);
    }

    // Now evaluate actual whale risk
    if (actualTop10Concentration >= 80) {
      riskLevel = 'critical';
      warnings.push(`⚠️ Top 10 wallets control ${actualTop10Concentration.toFixed(1)}% of circulating supply`);
    } else if (actualTop10Concentration >= 60) {
      riskLevel = 'high';
      warnings.push(`⚠️ High concentration: Top 10 wallets hold ${actualTop10Concentration.toFixed(1)}%`);
    } else if (actualTop10Concentration >= 40) {
      riskLevel = 'medium';
    }

    if (actualWhaleCount >= 5) {
      warnings.push(`🐋 ${actualWhaleCount} wallets hold >1% each`);
    }

    // Check for single dominant whale (excluding LP/burn)
    if (actualWhales[0]?.percentageOfSupply >= 50) {
      riskLevel = 'critical';
      warnings.push(`⚠️ Single wallet holds ${actualWhales[0].percentageOfSupply.toFixed(1)}% of circulating supply`);
    } else if (actualWhales[0]?.percentageOfSupply >= 25) {
      if (riskLevel === 'low') riskLevel = 'medium';
      warnings.push(`⚠️ Largest wallet holds ${actualWhales[0].percentageOfSupply.toFixed(1)}%`);
    }

    return {
      contractAddress,
      totalHolders: positiveHolders.length,
      topHolders,
      holderConcentration: actualTop10Concentration, // Now reflects actual whale concentration
      whaleCount: actualWhaleCount,
      riskLevel,
      warnings,
    };
  } catch (error) {
    console.error('Alchemy: Token holder analysis failed', error);
    return null;
  }
}

/**
 * Get recent token transfers
 */
export async function getRecentTransfers(
  env: Env,
  contractAddress: string,
  chain: string = 'base',
  maxCount: number = 100
): Promise<TransferEvent[]> {
  try {
    const result = await alchemyRequest(env, chain, 'alchemy_getAssetTransfers', [{
      fromBlock: '0x0',
      toBlock: 'latest',
      contractAddresses: [contractAddress],
      category: ['erc20'],
      maxCount: `0x${maxCount.toString(16)}`,
      order: 'desc',
      withMetadata: true,
    }]) as {
      transfers?: Array<{
        from: string;
        to: string;
        value?: number;
        rawContract?: { value?: string };
        blockNum: string;
        hash: string;
        metadata?: { blockTimestamp?: string };
      }>;
    } | null;

    if (!result?.transfers) return [];

    return result.transfers.map(t => ({
      from: t.from,
      to: t.to,
      value: t.rawContract?.value || '0',
      blockNumber: parseInt(t.blockNum, 16),
      transactionHash: t.hash,
      timestamp: t.metadata?.blockTimestamp,
    }));
  } catch (error) {
    console.error('Alchemy: Failed to get transfers', error);
    return [];
  }
}

/**
 * Detect whale alerts from recent transfers
 */
export async function detectWhaleAlerts(
  env: Env,
  contractAddress: string,
  chain: string = 'base',
  thresholdPercentage: number = 1
): Promise<WhaleAlert[]> {
  const transfers = await getRecentTransfers(env, contractAddress, chain, 50);
  if (transfers.length === 0) return [];

  // Get holder analysis for context
  const holderAnalysis = await getTokenHolderAnalysis(env, contractAddress, chain);
  if (!holderAnalysis) return [];

  const alerts: WhaleAlert[] = [];

  for (const transfer of transfers) {
    const transferValue = BigInt(transfer.value || '0');

    // Find if this transfer represents a significant percentage
    // This is approximate since we don't have exact total supply
    const topHolderBalance = BigInt(holderAnalysis.topHolders[0]?.balance || '0');
    if (topHolderBalance === BigInt(0)) continue;

    const estimatedPercentage = Number((transferValue * BigInt(100)) / topHolderBalance);

    if (estimatedPercentage >= thresholdPercentage) {
      let significance: WhaleAlert['significance'] = 'medium';
      if (estimatedPercentage >= 10) significance = 'critical';
      else if (estimatedPercentage >= 5) significance = 'high';

      alerts.push({
        type: 'large_transfer',
        transfer,
        significance,
        description: `Large transfer: ~${estimatedPercentage.toFixed(1)}% of top holder balance`,
      });
    }
  }

  return alerts.slice(0, 10); // Return top 10 alerts
}

// ============================================================================
// Deployer Portfolio Analysis
// ============================================================================

/**
 * Get deployer's token portfolio and contract history
 */
export async function getDeployerPortfolio(
  env: Env,
  deployerAddress: string,
  chain: string = 'base'
): Promise<DeployerPortfolio | null> {
  const apiKey = env.ALCHEMY_API_KEY;
  if (!apiKey) return null;

  try {
    // Get token balances
    const balances = await alchemyRequest(env, chain, 'alchemy_getTokenBalances', [
      deployerAddress,
      'erc20',
    ]) as {
      tokenBalances?: Array<{
        contractAddress: string;
        tokenBalance: string;
      }>;
    } | null;

    const tokenBalances: TokenBalance[] = [];
    let totalValueUsd = 0;

    if (balances?.tokenBalances) {
      // Get metadata for each token with balance
      for (const tb of balances.tokenBalances) {
        if (tb.tokenBalance === '0x0' || tb.tokenBalance === '0x') continue;

        const balance = BigInt(tb.tokenBalance);
        if (balance === BigInt(0)) continue;

        // Get token metadata
        const metadata = await alchemyRequest(env, chain, 'alchemy_getTokenMetadata', [
          tb.contractAddress,
        ]) as {
          name?: string;
          symbol?: string;
          decimals?: number;
          logo?: string;
        } | null;

        const decimals = metadata?.decimals || 18;
        const balanceFormatted = formatTokenBalance(balance.toString(), decimals);

        tokenBalances.push({
          contractAddress: tb.contractAddress,
          name: metadata?.name,
          symbol: metadata?.symbol,
          balance: balance.toString(),
          balanceFormatted,
          decimals,
          logo: metadata?.logo,
        });
      }
    }

    // Get contracts deployed by this address
    const contractsDeployed = await getContractsDeployedBy(env, deployerAddress, chain);

    // Risk indicators
    const riskIndicators: string[] = [];

    if (contractsDeployed.length === 0) {
      riskIndicators.push('No prior contracts deployed');
    } else if (contractsDeployed.length === 1) {
      riskIndicators.push('First contract from this deployer');
    } else if (contractsDeployed.length >= 10) {
      riskIndicators.push(`Experienced deployer (${contractsDeployed.length} contracts)`);
    }

    // Check for suspicious token holdings
    const lowValueTokenCount = tokenBalances.filter(t =>
      !t.symbol || t.symbol.length > 10
    ).length;
    if (lowValueTokenCount > 5) {
      riskIndicators.push('Holds many obscure tokens');
    }

    return {
      address: deployerAddress,
      tokenBalances: tokenBalances.slice(0, 20), // Limit to top 20
      nftCount: 0, // Would need separate NFT query
      totalValueUsd,
      contractsDeployed,
      riskIndicators,
    };
  } catch (error) {
    console.error('Alchemy: Deployer portfolio analysis failed', error);
    return null;
  }
}

/**
 * Get contracts deployed by an address
 */
async function getContractsDeployedBy(
  env: Env,
  deployerAddress: string,
  chain: string
): Promise<string[]> {
  try {
    // Get transactions from this address where 'to' is null (contract creation)
    const result = await alchemyRequest(env, chain, 'alchemy_getAssetTransfers', [{
      fromAddress: deployerAddress,
      fromBlock: '0x0',
      toBlock: 'latest',
      category: ['external'],
      maxCount: '0x64', // 100
      excludeZeroValue: false,
    }]) as {
      transfers?: Array<{
        to: string | null;
        hash: string;
      }>;
    } | null;

    if (!result?.transfers) return [];

    // Filter for contract creations (to is null) and get contract addresses
    // Note: We'd need to fetch receipts to get the actual contract addresses
    const contractCreations = result.transfers.filter(t => t.to === null);

    return contractCreations.map(t => t.hash); // Return tx hashes for now
  } catch {
    return [];
  }
}

// ============================================================================
// Enhanced Token Metadata
// ============================================================================

/**
 * Get enhanced token metadata from Alchemy
 */
export async function getTokenMetadata(
  env: Env,
  contractAddress: string,
  chain: string = 'base'
): Promise<{
  name?: string;
  symbol?: string;
  decimals?: number;
  logo?: string;
  totalSupply?: string;
} | null> {
  try {
    const metadata = await alchemyRequest(env, chain, 'alchemy_getTokenMetadata', [
      contractAddress,
    ]) as {
      name?: string;
      symbol?: string;
      decimals?: number;
      logo?: string;
    } | null;

    if (!metadata) return null;

    // Get total supply
    const supplyResult = await alchemyRequest(env, chain, 'eth_call', [{
      to: contractAddress,
      data: '0x18160ddd', // totalSupply()
    }, 'latest']) as string | null;

    return {
      ...metadata,
      totalSupply: supplyResult || undefined,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatTokenBalance(balanceWei: string, decimals: number): string {
  try {
    const balance = BigInt(balanceWei);
    const divisor = BigInt(10 ** decimals);
    const whole = balance / divisor;
    const fraction = balance % divisor;

    if (fraction === BigInt(0)) {
      return whole.toLocaleString();
    }

    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole.toLocaleString()}.${fractionStr}`;
  } catch {
    return balanceWei;
  }
}

// ============================================================================
// Formatted Output
// ============================================================================

/**
 * Format NFT collection analysis for display
 */
export function formatNFTAnalysis(analysis: NFTCollectionAnalysis): string {
  const lines: string[] = [];

  lines.push(`## NFT: ${analysis.name}`);
  if (analysis.symbol) lines.push(`Symbol: ${analysis.symbol}`);
  lines.push('');

  if (analysis.floorPrice) {
    lines.push(`**Floor Price:** ${analysis.floorPrice.price} ${analysis.floorPrice.currency}`);
  }

  if (analysis.totalSupply) {
    lines.push(`**Total Supply:** ${analysis.totalSupply.toLocaleString()}`);
  }

  if (analysis.owners) {
    lines.push(`**Unique Owners:** ${analysis.owners.toLocaleString()}`);
  }

  if (analysis.holderConcentration) {
    const concEmoji = analysis.holderConcentration >= 50 ? '⚠️' : '✅';
    lines.push(`${concEmoji} **Top 10 Concentration:** ${analysis.holderConcentration.toFixed(1)}%`);
  }

  lines.push('');

  if (analysis.isVerified) {
    lines.push('✅ Verified on OpenSea');
  }

  if (analysis.twitterUsername) {
    lines.push(`Twitter: @${analysis.twitterUsername}`);
  }

  if (analysis.discordUrl) {
    lines.push(`Discord: ${analysis.discordUrl}`);
  }

  return lines.join('\n');
}

/**
 * Format token holder analysis for display
 */
export function formatHolderAnalysis(analysis: TokenHolderAnalysis): string {
  const lines: string[] = [];

  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  lines.push('## 🐋 Whale Analysis');
  lines.push('');
  lines.push(`${riskEmoji[analysis.riskLevel]} **Risk Level:** ${analysis.riskLevel.toUpperCase()}`);
  lines.push(`**Total Holders:** ${analysis.totalHolders.toLocaleString()}`);
  lines.push(`**Top 10 Concentration:** ${analysis.holderConcentration.toFixed(1)}%`);
  lines.push(`**Whale Count (>1%):** ${analysis.whaleCount}`);
  lines.push('');

  if (analysis.warnings.length > 0) {
    lines.push('### ⚠️ Warnings');
    analysis.warnings.forEach(w => lines.push(`- ${w}`));
    lines.push('');
  }

  lines.push('### Top Holders');
  for (let i = 0; i < Math.min(5, analysis.topHolders.length); i++) {
    const holder = analysis.topHolders[i];
    const addr = `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`;
    lines.push(`${i + 1}. ${addr}: ${holder.percentageOfSupply.toFixed(2)}%`);
  }

  return lines.join('\n');
}
