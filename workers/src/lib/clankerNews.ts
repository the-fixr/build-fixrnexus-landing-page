// Clanker News Integration
// Uses ERC-8004 authentication and x402 payment protocol

import { createWalletClient, http, keccak256, toBytes } from 'viem';
import { mainnet, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from './types';
import { hasPostedContent, recordPostedContent } from './dailypost';

const CLANKER_NEWS_URL = 'https://news.clanker.ai';
const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const;
const CHAIN_ID = 1; // Ethereum mainnet where Fixr is registered
const FIXR_AGENT_ID = '22820';
const FIXR_WALLET = '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4';

// USDC on Base for x402 payments
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const BASE_CHAIN_ID = 8453;

// EIP-712 domain for ERC-8004 authentication
const ERC8004_DOMAIN = {
  name: 'ERC8004AgentRegistry',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: ERC8004_REGISTRY,
} as const;

// EIP-712 types for authentication (AgentRequest, not AgentAuth)
const AUTH_TYPES = {
  AgentRequest: [
    { name: 'agentId', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'method', type: 'string' },
    { name: 'path', type: 'string' },
    { name: 'bodyHash', type: 'bytes32' },
  ],
} as const;

// EIP-712 domain for USDC transfer authorization
const USDC_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: BASE_CHAIN_ID,
  verifyingContract: USDC_BASE,
} as const;

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
} as const;

interface ClankerPostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

// Hash a string to bytes32 using keccak256
function hashToBytes32(data: string): `0x${string}` {
  return keccak256(toBytes(data));
}

// Generate random bytes32 nonce
function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return keccak256(bytes);
}

// Get wallet client for signing
function getWalletClient(env: Env) {
  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured');
  }

  // Handle keys with or without 0x prefix
  const key = env.WALLET_PRIVATE_KEY.startsWith('0x')
    ? env.WALLET_PRIVATE_KEY
    : `0x${env.WALLET_PRIVATE_KEY}`;

  const account = privateKeyToAccount(key as `0x${string}`);

  return {
    client: createWalletClient({
      account,
      chain: mainnet,
      transport: http('https://eth.llamarpc.com'),
    }),
    account,
  };
}

export async function postToClankerNews(
  env: Env,
  title: string,
  url: string,
  comment?: string,
  options?: { skipDedup?: boolean }
): Promise<ClankerPostResult> {
  try {
    // Check for duplicate content
    const contentKey = `${title}|${url}`;
    if (!options?.skipDedup) {
      const isDuplicate = await hasPostedContent(env, 'clanker_news', contentKey);
      if (isDuplicate) {
        console.log('[ClankerNews] Skipping duplicate content');
        return { success: false, error: 'Duplicate content already posted today' };
      }
    }

    const { client, account } = getWalletClient(env);

    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ url, title, comment: comment || undefined });
    const bodyHash = hashToBytes32(body);

    // Create auth message
    const authMessage = {
      agentId: BigInt(FIXR_AGENT_ID),
      timestamp: BigInt(timestamp),
      method: 'POST',
      path: '/submit',
      bodyHash,
    };

    // Sign with EIP-712
    const signature = await client.signTypedData({
      domain: ERC8004_DOMAIN,
      types: AUTH_TYPES,
      primaryType: 'AgentRequest',
      message: authMessage,
    });

    // Create authorization header in correct format:
    // ERC-8004 {chainId}:{registry}:{agentId}:{timestamp}:{signature}
    const authHeader = `ERC-8004 ${CHAIN_ID}:${ERC8004_REGISTRY}:${FIXR_AGENT_ID}:${timestamp}:${signature}`;

    // First request (will get 402 Payment Required)
    const firstResponse = await fetch(`${CLANKER_NEWS_URL}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body,
    });

    // If successful without payment (shouldn't happen but handle it)
    if (firstResponse.ok) {
      const result = await firstResponse.json() as { id?: string };
      await recordPostedContent(env, 'clanker_news', contentKey, result.id);
      return {
        success: true,
        postId: result.id,
        url: `${CLANKER_NEWS_URL}/post/${result.id}`,
      };
    }

    // Handle 402 Payment Required
    if (firstResponse.status === 402) {
      const paymentRequired = firstResponse.headers.get('PAYMENT-REQUIRED');
      if (!paymentRequired) {
        return { success: false, error: '402 received but no PAYMENT-REQUIRED header' };
      }

      // Parse payment requirements
      const requirements = JSON.parse(atob(paymentRequired));
      const accepted = requirements.accepts[0];

      // Create payment signature (EIP-3009 transferWithAuthorization)
      const nonce = randomNonce();
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const paymentSig = await client.signTypedData({
        domain: USDC_DOMAIN,
        types: TRANSFER_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: {
          from: account.address,
          to: accepted.payTo as `0x${string}`,
          value: BigInt(accepted.amount),
          validAfter: 0n,
          validBefore,
          nonce,
        },
      });

      // Build payment payload
      const paymentPayload = {
        x402Version: 2,
        resource: requirements.resource,
        accepted,
        payload: {
          signature: paymentSig,
          authorization: {
            from: account.address,
            to: accepted.payTo,
            value: accepted.amount,
            validAfter: '0',
            validBefore: String(validBefore),
            nonce,
          },
        },
      };

      const paymentHeader = btoa(JSON.stringify(paymentPayload));

      // Retry with payment
      const finalResponse = await fetch(`${CLANKER_NEWS_URL}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'PAYMENT-SIGNATURE': paymentHeader,
        },
        body,
      });

      if (finalResponse.ok) {
        const result = await finalResponse.json() as { id?: string };
        await recordPostedContent(env, 'clanker_news', contentKey, result.id);
        return {
          success: true,
          postId: result.id,
          url: `${CLANKER_NEWS_URL}/post/${result.id}`,
        };
      }

      const errorText = await finalResponse.text();
      return {
        success: false,
        error: `Payment failed: HTTP ${finalResponse.status}: ${errorText}`,
      };
    }

    const errorText = await firstResponse.text();
    return {
      success: false,
      error: `HTTP ${firstResponse.status}: ${errorText}`,
    };

  } catch (error) {
    console.error('[ClankerNews] Error posting:', error);
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
    chainId: CHAIN_ID,
    walletAddress: FIXR_WALLET,
  };
}
