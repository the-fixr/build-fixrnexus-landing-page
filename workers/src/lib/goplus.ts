// GoPlus Security API Integration
// Free API - No API key required
// Documentation: https://docs.gopluslabs.io/reference/api-overview

import { Env } from './types';

// Chain IDs for GoPlus API
const CHAIN_IDS: Record<string, string> = {
  ethereum: '1',
  base: '8453',
  bsc: '56',
  polygon: '137',
  arbitrum: '42161',
  optimism: '10',
  avalanche: '43114',
  fantom: '250',
  cronos: '25',
  gnosis: '100',
  celo: '42220',
  moonbeam: '1284',
  moonriver: '1285',
  harmony: '1666600000',
  heco: '128',
  okx: '66',
  kcc: '321',
  linea: '59144',
  scroll: '534352',
  zksync: '324',
  mantle: '5000',
  manta: '169',
  blast: '81457',
  mode: '34443',
};

export interface GoPlusTokenSecurity {
  // Token info
  token_name: string;
  token_symbol: string;
  total_supply: string;
  holder_count: string;

  // Contract properties
  is_open_source: string; // "1" = yes, "0" = no
  is_proxy: string;
  is_honeypot: string;

  // Owner capabilities (major red flags)
  owner_address: string;
  owner_balance: string;
  owner_percent: string;
  can_take_back_ownership: string;
  owner_change_balance: string;
  hidden_owner: string;

  // Minting/burning
  is_mintable: string;

  // Trading risks
  buy_tax: string;
  sell_tax: string;
  cannot_buy: string;
  cannot_sell_all: string;
  slippage_modifiable: string;
  transfer_pausable: string;
  trading_cooldown: string;

  // Anti-whale
  is_anti_whale: string;
  anti_whale_modifiable: string;

  // Blacklist/whitelist
  is_blacklisted: string;
  is_whitelisted: string;

  // LP info
  lp_holder_count: string;
  lp_total_supply: string;
  lp_holders?: Array<{
    address: string;
    tag: string;
    is_contract: number;
    balance: string;
    percent: string;
    is_locked: number;
    locked_detail?: Array<{
      amount: string;
      end_time: string;
      opt_time: string;
    }>;
  }>;

  // Top holders
  holders?: Array<{
    address: string;
    tag: string;
    is_contract: number;
    balance: string;
    percent: string;
    is_locked: number;
  }>;

  // External links
  creator_address: string;
  creator_balance: string;
  creator_percent: string;

  // Trust sources
  is_true_token: string;
  is_airdrop_scam: string;
  trust_list: string;
  other_potential_risks?: string;
  note?: string;
}

export interface GoPlusSecurityAnalysis {
  tokenAddress: string;
  chain: string;
  chainId: string;
  security: GoPlusTokenSecurity | null;
  riskScore: number; // 0-100, higher = more risky
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risks: GoPlusRiskItem[];
  warnings: string[];
  timestamp: string;
}

export interface GoPlusRiskItem {
  category: 'HONEYPOT' | 'TAX' | 'OWNERSHIP' | 'TRADING' | 'CONTRACT' | 'HOLDER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
}

// Get token security from GoPlus
export async function getGoPlusTokenSecurity(
  env: Env,
  tokenAddress: string,
  network: string = 'base'
): Promise<GoPlusSecurityAnalysis | null> {
  const chainId = CHAIN_IDS[network.toLowerCase()];
  if (!chainId) {
    console.log(`GoPlus: Unsupported network: ${network}`);
    return null;
  }

  try {
    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${tokenAddress.toLowerCase()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`GoPlus API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      code: number;
      message: string;
      result: Record<string, GoPlusTokenSecurity>;
    };

    if (data.code !== 1) {
      console.error(`GoPlus API returned error: ${data.message}`);
      return null;
    }

    const security = data.result[tokenAddress.toLowerCase()];
    if (!security) {
      console.log(`GoPlus: No security data found for ${tokenAddress}`);
      return null;
    }

    // Analyze risks
    const { riskScore, riskLevel, risks, warnings } = analyzeGoPlusRisks(security);

    return {
      tokenAddress,
      chain: network,
      chainId,
      security,
      riskScore,
      riskLevel,
      risks,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('GoPlus API error:', error);
    return null;
  }
}

// Analyze risks from GoPlus data
function analyzeGoPlusRisks(security: GoPlusTokenSecurity): {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risks: GoPlusRiskItem[];
  warnings: string[];
} {
  const risks: GoPlusRiskItem[] = [];
  const warnings: string[] = [];
  let riskScore = 0;

  // CRITICAL: Honeypot detection
  if (security.is_honeypot === '1') {
    risks.push({
      category: 'HONEYPOT',
      severity: 'CRITICAL',
      title: 'Honeypot Detected',
      description: 'This token is a honeypot - you will not be able to sell it',
    });
    riskScore += 50;
  }

  // CRITICAL: Cannot sell
  if (security.cannot_sell_all === '1') {
    risks.push({
      category: 'TRADING',
      severity: 'CRITICAL',
      title: 'Cannot Sell All',
      description: 'Token holders cannot sell all of their tokens',
    });
    riskScore += 40;
  }

  // CRITICAL: Cannot buy
  if (security.cannot_buy === '1') {
    risks.push({
      category: 'TRADING',
      severity: 'CRITICAL',
      title: 'Trading Disabled',
      description: 'Token buying is currently disabled',
    });
    riskScore += 40;
  }

  // HIGH: Buy/sell taxes
  const buyTax = parseFloat(security.buy_tax || '0');
  const sellTax = parseFloat(security.sell_tax || '0');

  if (sellTax > 0.5) { // >50% sell tax
    risks.push({
      category: 'TAX',
      severity: 'CRITICAL',
      title: 'Extreme Sell Tax',
      description: `Sell tax is ${(sellTax * 100).toFixed(1)}%`,
    });
    riskScore += 40;
  } else if (sellTax > 0.1) { // >10% sell tax
    risks.push({
      category: 'TAX',
      severity: 'HIGH',
      title: 'High Sell Tax',
      description: `Sell tax is ${(sellTax * 100).toFixed(1)}%`,
    });
    riskScore += 20;
  } else if (sellTax > 0.05) { // >5% sell tax
    risks.push({
      category: 'TAX',
      severity: 'MEDIUM',
      title: 'Moderate Sell Tax',
      description: `Sell tax is ${(sellTax * 100).toFixed(1)}%`,
    });
    riskScore += 10;
  }

  if (buyTax > 0.1) {
    risks.push({
      category: 'TAX',
      severity: 'HIGH',
      title: 'High Buy Tax',
      description: `Buy tax is ${(buyTax * 100).toFixed(1)}%`,
    });
    riskScore += 15;
  }

  // HIGH: Owner can modify taxes
  if (security.slippage_modifiable === '1') {
    risks.push({
      category: 'OWNERSHIP',
      severity: 'HIGH',
      title: 'Modifiable Taxes',
      description: 'Owner can modify buy/sell taxes at any time',
    });
    riskScore += 15;
  }

  // HIGH: Transfer pausable
  if (security.transfer_pausable === '1') {
    risks.push({
      category: 'TRADING',
      severity: 'HIGH',
      title: 'Pausable Transfers',
      description: 'Token transfers can be paused by owner',
    });
    riskScore += 15;
  }

  // HIGH: Owner can take back ownership
  if (security.can_take_back_ownership === '1') {
    risks.push({
      category: 'OWNERSHIP',
      severity: 'HIGH',
      title: 'Recoverable Ownership',
      description: 'Ownership can be reclaimed even after renouncing',
    });
    riskScore += 15;
  }

  // HIGH: Hidden owner
  if (security.hidden_owner === '1') {
    risks.push({
      category: 'OWNERSHIP',
      severity: 'HIGH',
      title: 'Hidden Owner',
      description: 'Contract has a hidden owner mechanism',
    });
    riskScore += 15;
  }

  // HIGH: Owner can change balances
  if (security.owner_change_balance === '1') {
    risks.push({
      category: 'OWNERSHIP',
      severity: 'CRITICAL',
      title: 'Balance Manipulation',
      description: 'Owner can directly modify token balances',
    });
    riskScore += 35;
  }

  // MEDIUM: Mintable
  if (security.is_mintable === '1') {
    risks.push({
      category: 'CONTRACT',
      severity: 'MEDIUM',
      title: 'Mintable Token',
      description: 'New tokens can be minted, diluting holders',
    });
    riskScore += 10;
  }

  // MEDIUM: Not open source
  if (security.is_open_source === '0') {
    risks.push({
      category: 'CONTRACT',
      severity: 'MEDIUM',
      title: 'Unverified Contract',
      description: 'Contract source code is not verified',
    });
    riskScore += 10;
  }

  // MEDIUM: Proxy contract
  if (security.is_proxy === '1') {
    warnings.push('Contract is a proxy - implementation can be upgraded');
    riskScore += 5;
  }

  // MEDIUM: Blacklist function
  if (security.is_blacklisted === '1') {
    risks.push({
      category: 'TRADING',
      severity: 'MEDIUM',
      title: 'Blacklist Function',
      description: 'Token has blacklist functionality that can block addresses',
    });
    riskScore += 10;
  }

  // MEDIUM: Whitelist function
  if (security.is_whitelisted === '1') {
    warnings.push('Token has whitelist functionality');
    riskScore += 5;
  }

  // MEDIUM: Trading cooldown
  if (security.trading_cooldown === '1') {
    warnings.push('Token has trading cooldown restrictions');
    riskScore += 5;
  }

  // MEDIUM: Anti-whale that can be modified
  if (security.is_anti_whale === '1' && security.anti_whale_modifiable === '1') {
    warnings.push('Anti-whale limits can be modified by owner');
    riskScore += 5;
  }

  // MEDIUM: High owner concentration
  const ownerPercent = parseFloat(security.owner_percent || '0');
  if (ownerPercent > 0.1) { // >10%
    risks.push({
      category: 'HOLDER',
      severity: ownerPercent > 0.5 ? 'HIGH' : 'MEDIUM',
      title: 'High Owner Holdings',
      description: `Owner holds ${(ownerPercent * 100).toFixed(2)}% of supply`,
    });
    riskScore += ownerPercent > 0.5 ? 15 : 8;
  }

  // LOW: Airdrop scam
  if (security.is_airdrop_scam === '1') {
    risks.push({
      category: 'CONTRACT',
      severity: 'HIGH',
      title: 'Airdrop Scam',
      description: 'Token is flagged as an airdrop scam',
    });
    riskScore += 25;
  }

  // Trust list bonus
  if (security.trust_list === '1') {
    warnings.push('Token is on a trust list');
    riskScore = Math.max(0, riskScore - 10);
  }

  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (riskScore >= 50) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 30) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 15) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return { riskScore: Math.min(100, riskScore), riskLevel, risks, warnings };
}

// Format GoPlus analysis for display
export function formatGoPlusAnalysis(analysis: GoPlusSecurityAnalysis): string {
  const lines: string[] = [];

  lines.push(`## GoPlus Security Analysis`);
  lines.push('');

  // Risk summary
  const riskEmoji = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🟠',
    CRITICAL: '🔴',
  }[analysis.riskLevel];

  lines.push(`**Risk Level:** ${riskEmoji} ${analysis.riskLevel} (Score: ${analysis.riskScore}/100)`);
  lines.push('');

  if (analysis.security) {
    // Token info
    lines.push(`**Token:** ${analysis.security.token_name} (${analysis.security.token_symbol})`);
    lines.push(`**Holders:** ${parseInt(analysis.security.holder_count || '0').toLocaleString()}`);
    lines.push('');

    // Quick status
    const status: string[] = [];
    status.push(analysis.security.is_open_source === '1' ? '✅ Verified' : '❌ Unverified');
    status.push(analysis.security.is_honeypot === '1' ? '🍯 HONEYPOT' : '✅ Not Honeypot');
    status.push(analysis.security.is_mintable === '1' ? '⚠️ Mintable' : '✅ Not Mintable');
    lines.push(`**Contract:** ${status.join(' | ')}`);

    // Taxes
    const buyTax = parseFloat(analysis.security.buy_tax || '0') * 100;
    const sellTax = parseFloat(analysis.security.sell_tax || '0') * 100;
    lines.push(`**Taxes:** Buy ${buyTax.toFixed(1)}% | Sell ${sellTax.toFixed(1)}%`);
    lines.push('');
  }

  // Risks
  if (analysis.risks.length > 0) {
    lines.push('### Risk Factors');
    for (const risk of analysis.risks) {
      const severityEmoji = {
        LOW: '⚪',
        MEDIUM: '🟡',
        HIGH: '🟠',
        CRITICAL: '🔴',
      }[risk.severity];
      lines.push(`- ${severityEmoji} **${risk.title}**: ${risk.description}`);
    }
    lines.push('');
  }

  // Warnings
  if (analysis.warnings.length > 0) {
    lines.push('### Notes');
    for (const warning of analysis.warnings) {
      lines.push(`- ℹ️ ${warning}`);
    }
    lines.push('');
  }

  // LP info
  if (analysis.security?.lp_holders && analysis.security.lp_holders.length > 0) {
    lines.push('### Liquidity Providers');
    const topLP = analysis.security.lp_holders.slice(0, 3);
    for (const lp of topLP) {
      const locked = lp.is_locked === 1 ? '🔒' : '';
      const tag = lp.tag ? ` (${lp.tag})` : '';
      lines.push(`- ${lp.address.slice(0, 10)}...${tag}: ${(parseFloat(lp.percent) * 100).toFixed(2)}% ${locked}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
