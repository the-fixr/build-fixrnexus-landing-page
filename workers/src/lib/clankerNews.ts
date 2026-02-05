// Clanker News Integration
// Uses ERC-8004 authentication and x402 payment protocol

import { Env } from './types';

const CLANKER_NEWS_URL = 'https://news.clanker.ai';
const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const FIXR_AGENT_ID = '22820';

// EIP-712 domain for ERC-8004 authentication
const ERC8004_DOMAIN = {
  name: 'ERC8004AgentRegistry',
  version: '1',
  chainId: 1,
  verifyingContract: ERC8004_REGISTRY,
};

// EIP-712 types for authentication
const AUTH_TYPES = {
  AgentAuth: [
    { name: 'agentId', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'method', type: 'string' },
    { name: 'path', type: 'string' },
    { name: 'bodyHash', type: 'bytes32' },
  ],
};

// EIP-712 domain for USDC transfer authorization (Base chain)
const USDC_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453, // Base
  verifyingContract: USDC_BASE,
};

// EIP-3009 types for transfer authorization
const TRANSFER_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

interface ClankerPostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

// Hash a string to bytes32 using SHA-256
async function hashToBytes32(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return '0x' + Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Create EIP-712 typed data hash
function createTypedDataHash(domain: any, types: any, primaryType: string, message: any): string {
  // Simplified - in production would use proper EIP-712 hashing
  // For now, we'll use the worker's signing capabilities
  return JSON.stringify({ domain, types, primaryType, message });
}

// Sign EIP-712 message using the agent's private key
async function signTypedData(env: Env, typedData: string): Promise<string> {
  // Note: This requires the private key to be available in env
  // In a real implementation, you'd use viem or ethers to sign
  // For Cloudflare Workers, we may need to use a signing service

  // Placeholder - actual signing would need crypto library
  throw new Error('EIP-712 signing not yet implemented for Cloudflare Workers');
}

export async function postToClankerNews(
  env: Env,
  title: string,
  url: string,
  comment?: string
): Promise<ClankerPostResult> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ url, title, comment });
    const bodyHash = await hashToBytes32(body);

    // Create auth message
    const authMessage = {
      agentId: BigInt(FIXR_AGENT_ID),
      timestamp: BigInt(timestamp),
      method: 'POST',
      path: '/submit',
      bodyHash,
    };

    // For now, return info about what's needed
    // Full implementation requires EIP-712 signing which needs crypto libs
    return {
      success: false,
      error: 'Clanker News posting requires EIP-712 signing setup. Agent ID: ' + FIXR_AGENT_ID,
    };

    // TODO: Full implementation
    // 1. Sign auth message with EIP-712
    // 2. Make POST request to /submit
    // 3. Handle 402 response with payment signature
    // 4. Retry with payment header

  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

export async function getClankerNewsFeed(): Promise<any[]> {
  try {
    const response = await fetch(`${CLANKER_NEWS_URL}/`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Clanker News feed:', error);
    return [];
  }
}

export function getAgentId(): string {
  return FIXR_AGENT_ID;
}

export function getAgentRegistryInfo() {
  return {
    agentId: FIXR_AGENT_ID,
    registry: ERC8004_REGISTRY,
    chainId: 1,
    walletAddress: '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4',
  };
}
