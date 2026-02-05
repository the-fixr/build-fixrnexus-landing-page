// Bankr API Client
// Integrates with Bankr's Agent API for crypto trading
// Uses API key authentication (not x402)

import { Env } from './types';

const BANKR_API_URL = 'https://api.bankr.bot';

export interface BankrJobResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  response?: string;
  transactions?: Array<{
    hash: string;
    chain: string;
    status: string;
  }>;
  error?: string;
}

export interface BankrBalanceResponse {
  success: boolean;
  balances?: Array<{
    chain: string;
    token: string;
    symbol: string;
    balance: string;
    usdValue?: number;
  }>;
  error?: string;
}

export interface BankrTradeResult {
  success: boolean;
  jobId?: string;
  response?: string;
  txHash?: string;
  error?: string;
}

/**
 * Check if Bankr API is configured
 */
export function isBankrConfigured(env: Env): boolean {
  return !!(env as Record<string, string>).BANKR_API_KEY;
}

/**
 * Make authenticated request to Bankr API
 */
async function bankrFetch(
  env: Env,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = (env as Record<string, string>).BANKR_API_KEY;

  if (!apiKey) {
    throw new Error('BANKR_API_KEY not configured');
  }

  return fetch(`${BANKR_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options.headers,
    },
  });
}

/**
 * Send a prompt to Bankr and get a job ID
 * Use pollJob() to check status
 */
export async function sendPrompt(
  env: Env,
  prompt: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const response = await bankrFetch(env, '/agent/prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Bankr prompt error:', response.status, error);
      return { success: false, error: `API error ${response.status}: ${error}` };
    }

    const data = await response.json() as { jobId?: string; id?: string };
    return { success: true, jobId: data.jobId || data.id };
  } catch (error) {
    console.error('Bankr sendPrompt error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Poll job status
 */
export async function getJobStatus(
  env: Env,
  jobId: string
): Promise<BankrJobResponse> {
  try {
    const response = await bankrFetch(env, `/agent/job/${jobId}`);

    if (!response.ok) {
      const error = await response.text();
      return { jobId, status: 'failed', error: `API error ${response.status}: ${error}` };
    }

    const data = await response.json() as BankrJobResponse;
    return { jobId, ...data };
  } catch (error) {
    return { jobId, status: 'failed', error: String(error) };
  }
}

/**
 * Send prompt and wait for completion (with timeout)
 */
export async function promptAndWait(
  env: Env,
  prompt: string,
  options: {
    maxWaitMs?: number;
    pollIntervalMs?: number;
  } = {}
): Promise<BankrTradeResult> {
  const { maxWaitMs = 60000, pollIntervalMs = 2000 } = options;

  // Send the prompt
  const sendResult = await sendPrompt(env, prompt);
  if (!sendResult.success || !sendResult.jobId) {
    return { success: false, error: sendResult.error || 'Failed to send prompt' };
  }

  const jobId = sendResult.jobId;
  const startTime = Date.now();

  // Poll for completion
  while (Date.now() - startTime < maxWaitMs) {
    const status = await getJobStatus(env, jobId);

    if (status.status === 'completed') {
      return {
        success: true,
        jobId,
        response: status.response,
        txHash: status.transactions?.[0]?.hash,
      };
    }

    if (status.status === 'failed') {
      return {
        success: false,
        jobId,
        error: status.error || 'Job failed',
      };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    jobId,
    error: `Timeout after ${maxWaitMs}ms`,
  };
}

/**
 * Get wallet balances via prompt
 * Note: Bankr doesn't have a direct balances endpoint, so we query via prompt
 */
export async function getBalances(env: Env): Promise<BankrBalanceResponse> {
  const result = await promptAndWait(env, 'show my wallet balances on all chains', {
    maxWaitMs: 30000,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Return the raw response - parsing would require knowing Bankr's response format
  return {
    success: true,
    balances: [],
    // Include raw response for now
  };
}

/**
 * Execute a buy trade
 */
export async function buyToken(
  env: Env,
  params: {
    token: string;
    contractAddress?: string;
    amountETH: number;
    chain?: string;
  }
): Promise<BankrTradeResult> {
  const { token, contractAddress, amountETH, chain = 'base' } = params;

  let prompt = `buy ${amountETH} ETH of $${token}`;
  if (contractAddress) {
    prompt += ` ${contractAddress}`;
  }
  if (chain !== 'base') {
    prompt += ` on ${chain}`;
  }

  console.log(`Bankr: Executing trade - ${prompt}`);
  return promptAndWait(env, prompt);
}

/**
 * Execute a sell trade
 */
export async function sellToken(
  env: Env,
  params: {
    token: string;
    contractAddress?: string;
    percentage?: number; // e.g., 100 for all, 50 for half
    chain?: string;
  }
): Promise<BankrTradeResult> {
  const { token, contractAddress, percentage = 100, chain = 'base' } = params;

  let prompt = `sell ${percentage}% of $${token}`;
  if (contractAddress) {
    prompt += ` ${contractAddress}`;
  }
  if (chain !== 'base') {
    prompt += ` on ${chain}`;
  }

  console.log(`Bankr: Executing trade - ${prompt}`);
  return promptAndWait(env, prompt);
}

/**
 * Get token price
 */
export async function getPrice(
  env: Env,
  token: string,
  chain = 'base'
): Promise<{ success: boolean; price?: number; error?: string }> {
  const result = await promptAndWait(env, `price of $${token} on ${chain}`, {
    maxWaitMs: 15000,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Parse price from response
  const priceMatch = result.response?.match(/\$?([\d,.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined;

  return { success: true, price };
}

/**
 * Bridge tokens between chains
 */
export async function bridgeTokens(
  env: Env,
  params: {
    token: string;
    amount: number;
    fromChain: string;
    toChain: string;
  }
): Promise<BankrTradeResult> {
  const { token, amount, fromChain, toChain } = params;
  const prompt = `bridge ${amount} ${token} from ${fromChain} to ${toChain}`;

  console.log(`Bankr: Bridging - ${prompt}`);
  return promptAndWait(env, prompt, { maxWaitMs: 120000 }); // Bridges take longer
}

// ============ Token Deployment ============

export interface TokenDeployResult {
  success: boolean;
  jobId?: string;
  response?: string;
  contractAddress?: string;
  chain: string;
  txHash?: string;
  error?: string;
}

export interface MultiChainDeployResult {
  success: boolean;
  deployments: TokenDeployResult[];
  errors: string[];
}

/**
 * Deploy a token on a single chain
 * Bankr deploys on bonding curve (Raydium for Solana, Uniswap for EVM)
 */
export async function deployToken(
  env: Env,
  params: {
    name: string;
    symbol: string;
    chain: 'base' | 'solana' | 'ethereum' | 'polygon';
    description?: string;
    imageUrl?: string;
  }
): Promise<TokenDeployResult> {
  const { name, symbol, chain, description, imageUrl } = params;

  let prompt = `deploy token $${symbol} named "${name}" on ${chain}`;
  if (description) {
    prompt += ` with description "${description}"`;
  }
  if (imageUrl) {
    prompt += ` with image ${imageUrl}`;
  }

  console.log(`Bankr: Deploying token - ${prompt}`);

  const result = await promptAndWait(env, prompt, { maxWaitMs: 180000 }); // Deployments take longer

  // Try to extract contract address from response
  let contractAddress: string | undefined;
  if (result.response) {
    // Look for contract address patterns
    const evmMatch = result.response.match(/0x[a-fA-F0-9]{40}/);
    const solMatch = result.response.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/); // Solana address
    contractAddress = evmMatch?.[0] || (chain === 'solana' ? solMatch?.[0] : undefined);
  }

  return {
    success: result.success,
    jobId: result.jobId,
    response: result.response,
    contractAddress,
    chain,
    txHash: result.txHash,
    error: result.error,
  };
}

/**
 * Deploy a token on multiple chains simultaneously
 * Launches in parallel on Base and Solana (or other supported chains)
 */
export async function deployTokenMultiChain(
  env: Env,
  params: {
    name: string;
    symbol: string;
    chains: Array<'base' | 'solana' | 'ethereum' | 'polygon'>;
    description?: string;
    imageUrl?: string;
  }
): Promise<MultiChainDeployResult> {
  const { name, symbol, chains, description, imageUrl } = params;

  console.log(`Bankr: Multi-chain deploy of $${symbol} on ${chains.join(', ')}`);

  // Launch deployments in parallel
  const deployPromises = chains.map(chain =>
    deployToken(env, { name, symbol, chain, description, imageUrl })
  );

  const results = await Promise.allSettled(deployPromises);

  const deployments: TokenDeployResult[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deployments.push(result.value);
      if (!result.value.success) {
        errors.push(`${chains[index]}: ${result.value.error}`);
      }
    } else {
      errors.push(`${chains[index]}: ${result.reason}`);
      deployments.push({
        success: false,
        chain: chains[index],
        error: String(result.reason),
      });
    }
  });

  return {
    success: deployments.some(d => d.success),
    deployments,
    errors,
  };
}

// ============ $FIXR Token Launch ============

export const FIXR_TOKEN_CONFIG = {
  name: 'Fixr',
  symbol: 'FIXR',
  description: "Fix'n shit. Autonomous AI agent building across chains. Ship code, deploy contracts, debug your mess.",
  chains: ['base', 'solana'] as const,
  // Token image - should be uploaded to IPFS or hosted URL before launch
  imageUrl: '', // Set before launch
  // Social links for token metadata
  links: {
    website: 'https://fixr.nexus',
    twitter: 'https://x.com/Fixr21718',
    farcaster: 'https://warpcast.com/fixr',
    github: 'https://github.com/the-fixr',
  },
};

export interface FixrLaunchResult {
  success: boolean;
  launched: boolean;
  deployments: {
    base?: TokenDeployResult;
    solana?: TokenDeployResult;
  };
  contracts: {
    base?: string;
    solana?: string;
  };
  errors: string[];
  timestamp: string;
}

/**
 * Launch $FIXR token on Base and Solana simultaneously
 * This is a special one-time deployment for the FIXR token
 */
export async function launchFixrToken(
  env: Env,
  options: {
    imageUrl?: string;
    dryRun?: boolean; // If true, just validate without deploying
  } = {}
): Promise<FixrLaunchResult> {
  const { imageUrl, dryRun = false } = options;
  const timestamp = new Date().toISOString();

  console.log(`🚀 FIXR Token Launch initiated at ${timestamp}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE DEPLOYMENT'}`);

  // Validate image URL is set
  const finalImageUrl = imageUrl || FIXR_TOKEN_CONFIG.imageUrl;
  if (!finalImageUrl && !dryRun) {
    return {
      success: false,
      launched: false,
      deployments: {},
      contracts: {},
      errors: ['Image URL is required for token launch. Set imageUrl in request or FIXR_TOKEN_CONFIG.'],
      timestamp,
    };
  }

  // Dry run - just return what would happen
  if (dryRun) {
    return {
      success: true,
      launched: false,
      deployments: {},
      contracts: {},
      errors: [],
      timestamp,
    };
  }

  // Deploy to both chains in parallel
  const [baseResult, solanaResult] = await Promise.allSettled([
    deployToken(env, {
      name: FIXR_TOKEN_CONFIG.name,
      symbol: FIXR_TOKEN_CONFIG.symbol,
      chain: 'base',
      description: FIXR_TOKEN_CONFIG.description,
      imageUrl: finalImageUrl,
    }),
    deployToken(env, {
      name: FIXR_TOKEN_CONFIG.name,
      symbol: FIXR_TOKEN_CONFIG.symbol,
      chain: 'solana',
      description: FIXR_TOKEN_CONFIG.description,
      imageUrl: finalImageUrl,
    }),
  ]);

  const errors: string[] = [];
  const deployments: FixrLaunchResult['deployments'] = {};
  const contracts: FixrLaunchResult['contracts'] = {};

  // Process Base result
  if (baseResult.status === 'fulfilled') {
    deployments.base = baseResult.value;
    if (baseResult.value.success && baseResult.value.contractAddress) {
      contracts.base = baseResult.value.contractAddress;
      console.log(`✅ FIXR deployed on Base: ${baseResult.value.contractAddress}`);
    } else {
      errors.push(`Base: ${baseResult.value.error || 'Unknown error'}`);
    }
  } else {
    errors.push(`Base: ${baseResult.reason}`);
  }

  // Process Solana result
  if (solanaResult.status === 'fulfilled') {
    deployments.solana = solanaResult.value;
    if (solanaResult.value.success && solanaResult.value.contractAddress) {
      contracts.solana = solanaResult.value.contractAddress;
      console.log(`✅ FIXR deployed on Solana: ${solanaResult.value.contractAddress}`);
    } else {
      errors.push(`Solana: ${solanaResult.value.error || 'Unknown error'}`);
    }
  } else {
    errors.push(`Solana: ${solanaResult.reason}`);
  }

  const success = Object.keys(contracts).length > 0;

  if (success) {
    console.log(`🎉 FIXR Token Launch complete!`);
    console.log(`   Base: ${contracts.base || 'Failed'}`);
    console.log(`   Solana: ${contracts.solana || 'Failed'}`);
  } else {
    console.error(`❌ FIXR Token Launch failed:`, errors);
  }

  return {
    success,
    launched: success,
    deployments,
    contracts,
    errors,
    timestamp,
  };
}

/**
 * Get token info (price, liquidity, holders)
 */
export async function getTokenInfo(
  env: Env,
  params: {
    token: string;
    contractAddress?: string;
    chain?: string;
  }
): Promise<{ success: boolean; info?: string; error?: string }> {
  const { token, contractAddress, chain = 'base' } = params;

  let prompt = `info on $${token}`;
  if (contractAddress) {
    prompt += ` ${contractAddress}`;
  }
  prompt += ` on ${chain}`;

  const result = await promptAndWait(env, prompt, { maxWaitMs: 30000 });

  return {
    success: result.success,
    info: result.response,
    error: result.error,
  };
}
