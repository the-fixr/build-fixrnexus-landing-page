/**
 * Fixr Security Analysis for Solidity Smart Contracts
 * Analyzes contracts for common vulnerabilities and gas optimizations
 *
 * Fixr is a security researcher - finds bugs, doesn't create them.
 */

import { Env } from './types';

// Common vulnerability patterns to check
const VULNERABILITY_PATTERNS = {
  reentrancy: {
    name: 'Reentrancy',
    severity: 'critical',
    patterns: [
      /\.call\{.*value.*\}\s*\(/,
      /\.call\.value\(/,
      /\.transfer\(/,
      /\.send\(/,
    ],
    check: (code: string) => {
      // Check for external calls before state changes
      const hasExternalCall = VULNERABILITY_PATTERNS.reentrancy.patterns.some((p) =>
        p.test(code)
      );
      const hasStateAfterCall =
        hasExternalCall && /\.call[\s\S]*?=\s*(?!.*\bcall\b)/m.test(code);
      return hasExternalCall;
    },
    description: 'External call before state update - classic reentrancy vector',
    fix: 'Use checks-effects-interactions pattern or ReentrancyGuard',
  },
  uncheckedCall: {
    name: 'Unchecked External Call',
    severity: 'high',
    patterns: [/\.call\{[^}]*\}\([^)]*\);(?!\s*require)/],
    check: (code: string) =>
      /\.call\{[^}]*\}\([^)]*\)\s*;/.test(code) &&
      !/\(bool\s+\w+,?\s*\)?\s*=/.test(code),
    description: 'External call return value not checked',
    fix: 'Check return value: (bool success, ) = addr.call{...}(...); require(success);',
  },
  txOrigin: {
    name: 'tx.origin Authentication',
    severity: 'high',
    patterns: [/tx\.origin/],
    check: (code: string) =>
      /require\s*\([^)]*tx\.origin/.test(code) ||
      /if\s*\([^)]*tx\.origin/.test(code),
    description: 'Using tx.origin for auth is vulnerable to phishing',
    fix: 'Use msg.sender instead of tx.origin for authentication',
  },
  unsafeDelegate: {
    name: 'Unsafe Delegatecall',
    severity: 'critical',
    patterns: [/\.delegatecall\(/],
    check: (code: string) => /\.delegatecall\(/.test(code),
    description: 'delegatecall can be dangerous if target is user-controlled',
    fix: 'Ensure delegatecall target is trusted and immutable',
  },
  integerOverflow: {
    name: 'Potential Integer Overflow',
    severity: 'medium',
    patterns: [/\+\+|\+=|--|-=/],
    check: (code: string) => {
      // Check for arithmetic without SafeMath or unchecked blocks (pre-0.8)
      const hasPragma08 = /pragma\s+solidity\s+[\^~>=]*0\.[89]/.test(code);
      const hasUnchecked = /unchecked\s*\{/.test(code);
      const hasArithmetic = /[\+\-\*]/.test(code);
      return !hasPragma08 && hasArithmetic && !code.includes('SafeMath');
    },
    description: 'Arithmetic operations without overflow protection (pre-0.8)',
    fix: 'Use Solidity 0.8+ or OpenZeppelin SafeMath',
  },
  selfDestruct: {
    name: 'Selfdestruct Present',
    severity: 'high',
    patterns: [/selfdestruct\s*\(/, /suicide\s*\(/],
    check: (code: string) =>
      /selfdestruct\s*\(/.test(code) || /suicide\s*\(/.test(code),
    description: 'selfdestruct can permanently destroy the contract',
    fix: 'Consider if selfdestruct is necessary; add strict access controls',
  },
  accessControl: {
    name: 'Missing Access Control',
    severity: 'high',
    patterns: [/function\s+\w+\s*\([^)]*\)\s+external(?!\s+view|\s+pure)/],
    check: (code: string) => {
      // Look for external/public state-changing functions without modifiers
      const externalFns = code.match(
        /function\s+(\w+)\s*\([^)]*\)\s+(external|public)(?!\s+view|\s+pure)[^{]*/g
      );
      if (!externalFns) return false;
      return externalFns.some(
        (fn) =>
          !fn.includes('onlyOwner') &&
          !fn.includes('onlyRole') &&
          !fn.includes('modifier') &&
          !fn.includes('require') &&
          !fn.includes('_msgSender')
      );
    },
    description: 'State-changing function may lack access control',
    fix: 'Add onlyOwner or role-based access control modifier',
  },
  frontRunning: {
    name: 'Frontrunning Vulnerable',
    severity: 'medium',
    patterns: [/block\.timestamp/, /block\.number/],
    check: (code: string) =>
      /block\.timestamp/.test(code) || /blockhash\s*\(/.test(code),
    description: 'Using block values for randomness/timing is frontrunnable',
    fix: 'Use commit-reveal scheme or Chainlink VRF for randomness',
  },
  flashLoan: {
    name: 'Flash Loan Attack Vector',
    severity: 'medium',
    patterns: [/balanceOf\s*\([^)]*\)/, /getReserves\s*\(/],
    check: (code: string) =>
      /balanceOf\s*\([^)]*\)\s*[<>=]/.test(code) &&
      !/require\s*\([^)]*msg\.value/.test(code),
    description: 'Balance checks may be manipulable via flash loans',
    fix: 'Use time-weighted averages or multi-block checks for price/balance',
  },
  privateData: {
    name: 'Private Data Exposure',
    severity: 'low',
    patterns: [/private\s+\w+\s+\w+\s*=/],
    check: (code: string) =>
      /private\s+(string|bytes|uint|address)\s+\w+\s*=/.test(code),
    description: 'Private variables are readable on-chain',
    fix: 'Never store sensitive data on-chain, even as private',
  },
};

// Gas optimization patterns
const GAS_PATTERNS = {
  storageLoop: {
    name: 'Storage Read in Loop',
    savings: 'high',
    check: (code: string) => /for\s*\([^)]+\)\s*\{[\s\S]*?storage[\s\S]*?\}/.test(code),
    description: 'Reading storage in a loop is expensive',
    fix: 'Cache storage values in memory before the loop',
  },
  shortStrings: {
    name: 'Long Error Strings',
    savings: 'low',
    check: (code: string) => /require\s*\([^,]+,\s*"[^"]{32,}"/.test(code),
    description: 'Error strings > 32 bytes cost extra gas',
    fix: 'Use custom errors (Solidity 0.8.4+) or shorter messages',
  },
  postIncrement: {
    name: 'Post-increment in Loop',
    savings: 'low',
    check: (code: string) => /for\s*\([^)]*\w+\+\+\s*\)/.test(code),
    description: 'i++ costs more gas than ++i',
    fix: 'Use ++i instead of i++ in for loops',
  },
  packStorage: {
    name: 'Unoptimized Storage Layout',
    savings: 'medium',
    check: (code: string) => {
      // Check for non-packed struct/state variables
      const hasMultipleSmall = (code.match(/uint8|uint16|uint32|bool/g) || []).length > 2;
      const hasSpreadVars = /uint256[\s\S]{0,50}uint8[\s\S]{0,50}uint256/.test(code);
      return hasSpreadVars;
    },
    description: 'State variables may not be optimally packed',
    fix: 'Order variables by size to pack into fewer storage slots',
  },
  zeroCheck: {
    name: 'Zero Address Check',
    savings: 'low',
    check: (code: string) =>
      /require\s*\(\s*\w+\s*!=\s*address\s*\(\s*0\s*\)/.test(code),
    description: 'Old-style zero address check',
    fix: 'Use custom error or assembly for gas-efficient zero checks',
  },
};

export interface SecurityIssue {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  fix: string;
  line?: number;
}

export interface GasOptimization {
  name: string;
  savings: 'high' | 'medium' | 'low';
  description: string;
  fix: string;
}

export interface ContractSecurityAnalysis {
  address?: string;
  name?: string;
  compiler?: string;
  issues: SecurityIssue[];
  gasOptimizations: GasOptimization[];
  score: number; // 0-100
  summary: string;
  recommendations: string[];
}

/**
 * Fetch verified contract source from Etherscan/Basescan
 */
export async function fetchContractSource(
  network: string,
  address: string,
  apiKey?: string
): Promise<{ source: string; name: string; compiler: string } | null> {
  const explorers: Record<string, string> = {
    ethereum: 'https://api.etherscan.io/api',
    base: 'https://api.basescan.org/api',
    arbitrum: 'https://api.arbiscan.io/api',
    optimism: 'https://api-optimistic.etherscan.io/api',
    polygon: 'https://api.polygonscan.com/api',
  };

  const baseUrl = explorers[network.toLowerCase()] || explorers.base;

  try {
    let url = `${baseUrl}?module=contract&action=getsourcecode&address=${address}`;
    if (apiKey) {
      url += `&apikey=${apiKey}`;
    }

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status: string;
      result: Array<{
        SourceCode: string;
        ContractName: string;
        CompilerVersion: string;
      }>;
    };

    if (data.status !== '1' || !data.result?.[0]?.SourceCode) {
      return null;
    }

    const result = data.result[0];
    let source = result.SourceCode;

    // Handle JSON-formatted source (multi-file contracts)
    if (source.startsWith('{{')) {
      try {
        const parsed = JSON.parse(source.slice(1, -1));
        source = Object.values(parsed.sources || {})
          .map((s: unknown) => (s as { content: string }).content)
          .join('\n');
      } catch {
        // Keep as-is if parsing fails
      }
    } else if (source.startsWith('{')) {
      try {
        const parsed = JSON.parse(source);
        source = Object.values(parsed.sources || parsed)
          .map((s: unknown) =>
            typeof s === 'string' ? s : (s as { content: string }).content
          )
          .join('\n');
      } catch {
        // Keep as-is
      }
    }

    return {
      source,
      name: result.ContractName,
      compiler: result.CompilerVersion,
    };
  } catch (error) {
    console.error('Failed to fetch contract source:', error);
    return null;
  }
}

/**
 * Analyze Solidity source code for security issues
 */
export function analyzeSource(source: string): {
  issues: SecurityIssue[];
  gasOptimizations: GasOptimization[];
} {
  const issues: SecurityIssue[] = [];
  const gasOptimizations: GasOptimization[] = [];

  // Check each vulnerability pattern
  for (const [key, vuln] of Object.entries(VULNERABILITY_PATTERNS)) {
    if (vuln.check(source)) {
      issues.push({
        name: vuln.name,
        severity: vuln.severity as SecurityIssue['severity'],
        description: vuln.description,
        fix: vuln.fix,
      });
    }
  }

  // Check gas optimizations
  for (const [key, opt] of Object.entries(GAS_PATTERNS)) {
    if (opt.check(source)) {
      gasOptimizations.push({
        name: opt.name,
        savings: opt.savings as GasOptimization['savings'],
        description: opt.description,
        fix: opt.fix,
      });
    }
  }

  return { issues, gasOptimizations };
}

/**
 * Calculate security score based on issues found
 */
function calculateScore(issues: SecurityIssue[]): number {
  let score = 100;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        score -= 25;
        break;
      case 'high':
        score -= 15;
        break;
      case 'medium':
        score -= 8;
        break;
      case 'low':
        score -= 3;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  return Math.max(0, score);
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  issues: SecurityIssue[],
  gasOpts: GasOptimization[]
): string[] {
  const recs: string[] = [];

  const criticals = issues.filter((i) => i.severity === 'critical');
  const highs = issues.filter((i) => i.severity === 'high');

  if (criticals.length > 0) {
    recs.push(`🚨 ${criticals.length} CRITICAL issue(s) found - DO NOT deploy without fixing`);
  }

  if (highs.length > 0) {
    recs.push(`⚠️ ${highs.length} HIGH severity issue(s) need attention`);
  }

  if (issues.some((i) => i.name === 'Reentrancy')) {
    recs.push('Consider using OpenZeppelin ReentrancyGuard');
  }

  if (issues.some((i) => i.name === 'Missing Access Control')) {
    recs.push('Add Ownable or AccessControl from OpenZeppelin');
  }

  if (gasOpts.length > 3) {
    recs.push('Multiple gas optimizations possible - review for production');
  }

  if (issues.length === 0 && gasOpts.length === 0) {
    recs.push('No major issues detected - still recommend professional audit');
  }

  return recs;
}

/**
 * Perform full security analysis on a contract
 */
export async function analyzeContract(
  network: string,
  address: string,
  apiKey?: string
): Promise<ContractSecurityAnalysis> {
  // Fetch source code
  const contractData = await fetchContractSource(network, address, apiKey);

  if (!contractData) {
    return {
      address,
      issues: [],
      gasOptimizations: [],
      score: 0,
      summary: 'Contract source not verified or not found',
      recommendations: ['Verify contract source on block explorer for analysis'],
    };
  }

  // Analyze the source
  const { issues, gasOptimizations } = analyzeSource(contractData.source);

  // Calculate score
  const score = calculateScore(issues);

  // Generate recommendations
  const recommendations = generateRecommendations(issues, gasOptimizations);

  // Build summary
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;

  let summary = `${contractData.name}: `;
  if (criticalCount > 0) {
    summary += `🚨 ${criticalCount} critical, `;
  }
  if (highCount > 0) {
    summary += `⚠️ ${highCount} high, `;
  }
  if (mediumCount > 0) {
    summary += `${mediumCount} medium, `;
  }
  summary += `Score: ${score}/100`;

  if (score >= 90) {
    summary += ' ✅';
  } else if (score >= 70) {
    summary += ' 🟡';
  } else if (score >= 50) {
    summary += ' 🟠';
  } else {
    summary += ' 🔴';
  }

  return {
    address,
    name: contractData.name,
    compiler: contractData.compiler,
    issues,
    gasOptimizations,
    score,
    summary,
    recommendations,
  };
}

/**
 * Analyze raw Solidity code (for when user pastes code directly)
 */
export async function analyzeRawCode(
  env: Env,
  code: string
): Promise<ContractSecurityAnalysis> {
  const { issues, gasOptimizations } = analyzeSource(code);
  const score = calculateScore(issues);
  const recommendations = generateRecommendations(issues, gasOptimizations);

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const highCount = issues.filter((i) => i.severity === 'high').length;

  let summary = 'Code analysis: ';
  if (criticalCount > 0) {
    summary += `🚨 ${criticalCount} critical, `;
  }
  if (highCount > 0) {
    summary += `⚠️ ${highCount} high, `;
  }
  summary += `Score: ${score}/100`;

  return {
    issues,
    gasOptimizations,
    score,
    summary,
    recommendations,
  };
}

/**
 * Format security analysis for Farcaster (short)
 */
export function formatSecurityAnalysisShort(analysis: ContractSecurityAnalysis): string {
  const lines: string[] = [];

  if (analysis.name) {
    lines.push(`🔍 ${analysis.name}`);
  }

  lines.push(analysis.summary);

  // Top issues
  const topIssues = analysis.issues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 2);

  if (topIssues.length > 0) {
    lines.push('');
    topIssues.forEach((issue) => {
      const icon = issue.severity === 'critical' ? '🚨' : '⚠️';
      lines.push(`${icon} ${issue.name}`);
    });
  }

  // Top gas optimization
  if (analysis.gasOptimizations.length > 0 && analysis.issues.length < 3) {
    const topGas = analysis.gasOptimizations[0];
    lines.push(`⛽ ${topGas.name}`);
  }

  // One recommendation
  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push(analysis.recommendations[0]);
  }

  return lines.join('\n');
}

/**
 * Quick security check for common red flags (without source)
 */
export async function quickSecurityCheck(
  network: string,
  address: string
): Promise<{ safe: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  // This would integrate with APIs like:
  // - GoPlus Security API
  // - Token Sniffer
  // - Honeypot.is
  // For now, just return basic result

  return {
    safe: warnings.length === 0,
    warnings,
  };
}
