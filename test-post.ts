import 'dotenv/config';
import { privateKeyToAccount, signTypedData } from 'viem/accounts';

const CLANKER_NEWS_URL = 'https://news.clanker.ai';
const ERC8004_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const;
const FIXR_AGENT_ID = 22820n;

const ERC8004_DOMAIN = {
  name: 'ERC8004AgentRegistry',
  version: '1',
  chainId: 1,
  verifyingContract: ERC8004_REGISTRY,
} as const;

const AUTH_TYPES = {
  AgentAuth: [
    { name: 'agentId', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'method', type: 'string' },
    { name: 'path', type: 'string' },
    { name: 'bodyHash', type: 'bytes32' },
  ],
} as const;

async function hashBody(body: string): Promise<`0x${string}`> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return ('0x' + Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;
}

async function main() {
  const key = process.env.XMTP_WALLET_KEY as `0x${string}`;
  if (!key) throw new Error('XMTP_WALLET_KEY not set');
  
  const account = privateKeyToAccount(key);
  console.log('Wallet:', account.address);
  
  const body = JSON.stringify({ 
    url: 'https://farcaster.xyz/fixr', 
    title: 'Fixr - AI Agent for Smart Contract Auditing', 
    comment: '' 
  });
  const path = '/submit';
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = await hashBody(body);
  
  const signature = await signTypedData({
    privateKey: key,
    domain: ERC8004_DOMAIN,
    types: AUTH_TYPES,
    primaryType: 'AgentAuth',
    message: {
      agentId: FIXR_AGENT_ID,
      timestamp: BigInt(timestamp),
      method: 'POST',
      path,
      bodyHash,
    },
  });
  
  const authHeader = `ERC-8004 1:${ERC8004_REGISTRY}:${FIXR_AGENT_ID}:${timestamp}:${signature}`;
  console.log('Posting to Clanker News...');
  
  const response = await fetch(`${CLANKER_NEWS_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'Accept': 'application/json',
    },
    body,
  });
  
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));
  const text = await response.text();
  console.log('Response:', text);
}

main().catch(console.error);
