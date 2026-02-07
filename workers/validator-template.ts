/**
 * FEEDS Oracle Validator Worker
 * Cloudflare Worker that fetches data and submits to oracle contracts
 */

import { ethers } from 'ethers';

interface Env {
  VALIDATOR_PRIVATE_KEY: string;
  RPC_URL: string; // Base RPC
  ORACLE_REGISTRY_ADDRESS: string;
  API_BASE_URL: string; // Your Next.js app URL (e.g., https://feeds.review or http://localhost:3000)
  GECKOTERMINAL_API_KEY?: string;
  OPENWEATHER_API_KEY?: string;
  NEYNAR_API_KEY?: string;
}

interface OracleConfig {
  address: string;
  type: 'price' | 'farcaster' | 'weather' | 'custom';
  updateFrequency: number;
  dataSource: {
    primary: string;
    apiEndpoint?: string;
  };
  targetToken?: string;
}

// Price Oracle ABI (simplified)
const PRICE_ORACLE_ABI = [
  'function submitPrice(uint256 _price, uint8 _decimals) external',
  'function needsUpdate() external view returns (bool)',
  'function getLatestPrice() external view returns (uint256 price, uint256 timestamp, uint8 decimals)',
];

// Farcaster Oracle ABI (simplified)
const FARCASTER_ORACLE_ABI = [
  'function submitMetrics(uint256 _mentions24h, int256 _sentimentScore, uint256 _engagementRate, uint256 _uniqueUsers, uint256 _totalEngagement, uint256 _topCastFid) external',
  'function needsUpdate() external view returns (bool)',
  'function targetToken() external view returns (string)',
  'function getLatestMetrics() external view returns (tuple(uint256 mentions24h, int256 sentimentScore, uint256 engagementRate, uint256 uniqueUsers, uint256 totalEngagement, uint256 topCastFid, uint256 timestamp))',
];

// Oracle Registry ABI (simplified)
const ORACLE_REGISTRY_ABI = [
  'function getAllOracles() external view returns (address[] memory)',
  'function getOracle(address) external view returns (tuple(address oracleAddress, address creator, string name, string oracleType, uint256 updateFrequency, uint8 consensusThreshold, bool isActive, uint256 createdAt, uint256 lastUpdate))',
  'function recordUpdate(address _oracleAddress) external',
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle different routes
    if (url.pathname === '/validate' && request.method === 'POST') {
      return handleValidation(request, env);
    }

    if (url.pathname === '/trigger' && request.method === 'POST') {
      return handleTrigger(request, env);
    }

    if (url.pathname === '/cron') {
      return handleCronTrigger(env);
    }

    if (url.pathname === '/health') {
      return handleHealthCheck(env);
    }

    if (url.pathname === '/status') {
      return handleDetailedStatus(env);
    }

    // TEMPORARY: Drain wallet endpoint - remove after use
    if (url.pathname === '/drain') {
      const provider = new ethers.JsonRpcProvider(env.RPC_URL);
      const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY, provider);
      const bal = await provider.getBalance(wallet.address);
      if (bal === BigInt(0)) {
        return new Response(JSON.stringify({ error: 'Wallet empty', address: wallet.address }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const feeData = await provider.getFeeData();
      // Use maxFeePerGas for EIP-1559, add 20% buffer
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || BigInt(1000000000);
      const gasBuffer = (gasPrice * BigInt(120)) / BigInt(100); // 20% buffer
      const gasCost = BigInt(21000) * gasBuffer;
      if (bal <= gasCost) {
        return new Response(JSON.stringify({
          error: 'Balance too low for gas',
          balance: ethers.formatEther(bal),
          gasCost: ethers.formatEther(gasCost),
          address: wallet.address
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const amountToSend = bal - gasCost;
      const tx = await wallet.sendTransaction({
        to: '0x7c3B6f7863fac4E9d2415b9BD286E22aeb264df4',
        value: amountToSend,
      });
      const receipt = await tx.wait();
      return new Response(JSON.stringify({
        success: true,
        from: wallet.address,
        amount: ethers.formatEther(amountToSend),
        txHash: tx.hash,
        block: receipt?.blockNumber,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('FEEDS Validator Worker', { status: 200 });
  },

  // Scheduled trigger (runs every minute)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processScheduledValidation(env));
  },
};

/**
 * Health check endpoint
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  try {
    // Basic health check - just verify we have required config
    const hasPrivateKey = !!env.VALIDATOR_PRIVATE_KEY;
    const hasRPC = !!env.RPC_URL;
    const hasRegistry = !!env.ORACLE_REGISTRY_ADDRESS;

    // Get validator address if private key exists
    let validatorAddress = 'not_configured';
    if (hasPrivateKey && env.VALIDATOR_PRIVATE_KEY.startsWith('0x')) {
      try {
        const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY);
        validatorAddress = wallet.address;
      } catch (e) {
        validatorAddress = 'invalid_key';
      }
    }

    const health = {
      status: hasPrivateKey && hasRPC && hasRegistry ? 'healthy' : 'degraded',
      validator: validatorAddress,
      configured: {
        privateKey: hasPrivateKey,
        rpc: hasRPC,
        registry: hasRegistry
      },
      timestamp: Date.now()
    };

    return new Response(JSON.stringify(health), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
}

/**
 * Detailed status endpoint (requires RPC calls)
 */
async function handleDetailedStatus(env: Env): Promise<Response> {
  try {
    if (!env.VALIDATOR_PRIVATE_KEY) {
      return new Response(JSON.stringify({
        status: 'unhealthy',
        error: 'Private key not configured',
        timestamp: Date.now()
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    const provider = new ethers.JsonRpcProvider(env.RPC_URL);
    const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY, provider);

    const registry = new ethers.Contract(
      env.ORACLE_REGISTRY_ADDRESS,
      ORACLE_REGISTRY_ABI,
      wallet
    );

    const blockNumber = await provider.getBlockNumber();
    const balance = await provider.getBalance(wallet.address);
    const oracleAddresses = await registry.getAllOracles();

    const status = {
      status: 'healthy',
      validator: {
        address: wallet.address,
        balance: ethers.formatEther(balance),
        hasEnoughGas: parseFloat(ethers.formatEther(balance)) >= 0.0005 // ~$1.50 at $3k ETH, enough for ~5-10 submissions
      },
      network: {
        chainId: 8453,
        blockNumber,
        rpcUrl: env.RPC_URL.includes('mainnet') ? 'mainnet.base.org' : 'custom'
      },
      registry: {
        address: env.ORACLE_REGISTRY_ADDRESS,
        totalOracles: oracleAddresses.length
      },
      timestamp: Date.now()
    };

    return new Response(JSON.stringify(status), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
}

/**
 * Manual validation trigger
 */
async function handleValidation(request: Request, env: Env): Promise<Response> {
  try {
    const { oracleAddress } = await request.json();

    if (!oracleAddress) {
      return new Response('Missing oracleAddress', { status: 400 });
    }

    const result = await validateOracle(oracleAddress, env);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Immediate trigger endpoint (called from API when user manually triggers update)
 */
async function handleTrigger(request: Request, env: Env): Promise<Response> {
  try {
    const { oracleAddress } = await request.json();

    if (!oracleAddress || !ethers.isAddress(oracleAddress)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid oracle address'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Use existing validateOracle function to fetch data and submit
    const result = await validateOracle(oracleAddress, env);

    // Get validator address for response
    const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY);

    return new Response(JSON.stringify({
      success: true,
      oracleAddress,
      validator: wallet.address,
      priceSubmitted: result.value ? ethers.parseUnits(result.value.toString(), result.decimals || 8).toString() : undefined,
      formattedPrice: result.value?.toString(),
      timestamp: new Date().toISOString(),
      txHash: result.txHash,
      type: result.type,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Trigger error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * Cron trigger endpoint
 */
async function handleCronTrigger(env: Env): Promise<Response> {
  try {
    await processScheduledValidation(env);
    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Process all oracles that need validation
 */
async function processScheduledValidation(env: Env): Promise<void> {
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY, provider);

  const registry = new ethers.Contract(
    env.ORACLE_REGISTRY_ADDRESS,
    ORACLE_REGISTRY_ABI,
    wallet
  );

  // Get all oracles
  const oracleAddresses = await registry.getAllOracles();

  console.log(`Processing ${oracleAddresses.length} oracles`);

  // Validate each oracle
  for (const oracleAddress of oracleAddresses) {
    try {
      const oracleInfo = await registry.getOracle(oracleAddress);

      if (!oracleInfo.isActive) {
        continue;
      }

      // Check if update is needed
      const oracleAbi = oracleInfo.oracleType === 'farcaster' ? FARCASTER_ORACLE_ABI : PRICE_ORACLE_ABI;
      const oracle = new ethers.Contract(oracleAddress, oracleAbi, wallet);
      const needsUpdate = await oracle.needsUpdate();

      if (needsUpdate) {
        await validateOracle(oracleAddress, env, oracleInfo.oracleType);
      }
    } catch (error) {
      console.error(`Error processing oracle ${oracleAddress}:`, error);
    }
  }
}

/**
 * Fetch oracle metadata from API (includes target token)
 */
async function fetchOracleMetadata(oracleAddress: string, env: Env): Promise<any> {
  const metadataUrl = `${env.API_BASE_URL}/api/v1/oracle-metadata/${oracleAddress}`;

  const response = await fetch(metadataUrl);

  if (!response.ok) {
    console.warn(`Failed to fetch metadata for ${oracleAddress}: ${response.status}`);
    return null; // Fallback to no metadata
  }

  const data = await response.json();
  return data.oracle;
}

/**
 * Validate a specific oracle
 */
async function validateOracle(oracleAddress: string, env: Env, oracleType?: string): Promise<any> {
  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const wallet = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY, provider);

  const registry = new ethers.Contract(
    env.ORACLE_REGISTRY_ADDRESS,
    ORACLE_REGISTRY_ABI,
    wallet
  );

  // Get oracle info from registry
  const oracleInfo = await registry.getOracle(oracleAddress);

  // Fetch additional metadata from API (includes target token)
  const metadata = await fetchOracleMetadata(oracleAddress, env);

  // Merge metadata with registry info
  const enrichedOracleInfo = {
    ...oracleInfo,
    targetToken: metadata?.targetToken,
    dataSource: metadata?.dataSource,
  };
  const type = oracleType || enrichedOracleInfo.oracleType;

  // Handle different oracle types
  if (type === 'farcaster') {
    return await validateFarcasterOracle(oracleAddress, enrichedOracleInfo, env, wallet, registry);
  } else if (type === 'price') {
    return await validatePriceOracle(oracleAddress, enrichedOracleInfo, env, wallet, registry);
  } else if (type === 'weather') {
    return await validateWeatherOracle(oracleAddress, enrichedOracleInfo, env, wallet, registry);
  } else {
    throw new Error('Unsupported oracle type: ' + type);
  }
}

/**
 * Validate a Farcaster oracle
 */
async function validateFarcasterOracle(
  oracleAddress: string,
  oracleInfo: any,
  env: Env,
  wallet: ethers.Wallet,
  registry: ethers.Contract
): Promise<any> {
  const oracle = new ethers.Contract(oracleAddress, FARCASTER_ORACLE_ABI, wallet);

  // Get target token from contract
  const targetToken = await oracle.targetToken();

  // Fetch Farcaster metrics
  const metrics = await fetchFarcasterMetrics(targetToken, env);

  // Submit metrics to oracle
  const tx = await oracle.submitMetrics(
    metrics.mentions24h,
    metrics.sentimentScore,
    metrics.engagementRate,
    metrics.uniqueUsers,
    metrics.totalEngagement,
    metrics.topCastFid
  );

  await tx.wait();

  // Record update in registry
  await registry.recordUpdate(oracleAddress);

  return {
    success: true,
    oracleAddress,
    type: 'farcaster',
    targetToken,
    metrics,
    timestamp: Date.now(),
    txHash: tx.hash,
  };
}

/**
 * Validate a price oracle
 */
async function validatePriceOracle(
  oracleAddress: string,
  oracleInfo: any,
  env: Env,
  wallet: ethers.Wallet,
  registry: ethers.Contract
): Promise<any> {
  // Fetch price data with token address from oracleInfo
  const tokenAddress = oracleInfo.targetToken;
  if (!tokenAddress) {
    throw new Error('No target token address configured for this price oracle');
  }

  const priceData = await fetchPriceData(tokenAddress, env);

  // Submit to oracle contract
  const oracle = new ethers.Contract(oracleAddress, PRICE_ORACLE_ABI, wallet);

  const tx = await oracle.submitPrice(
    ethers.parseUnits(priceData.value.toString(), priceData.decimals),
    priceData.decimals
  );

  await tx.wait();

  // Record update in registry
  await registry.recordUpdate(oracleAddress);

  return {
    success: true,
    oracleAddress,
    type: 'price',
    tokenAddress,
    value: priceData.value,
    timestamp: Date.now(),
    txHash: tx.hash,
  };
}

/**
 * Validate a weather oracle
 */
async function validateWeatherOracle(
  oracleAddress: string,
  oracleInfo: any,
  env: Env,
  wallet: ethers.Wallet,
  registry: ethers.Contract
): Promise<any> {
  // Fetch weather data
  const weatherData = await fetchWeatherData(oracleInfo, env);

  // Submit to oracle contract
  const oracle = new ethers.Contract(oracleAddress, PRICE_ORACLE_ABI, wallet);

  const tx = await oracle.submitPrice(
    ethers.parseUnits(weatherData.value.toString(), weatherData.decimals),
    weatherData.decimals
  );

  await tx.wait();

  // Record update in registry
  await registry.recordUpdate(oracleAddress);

  return {
    success: true,
    oracleAddress,
    type: 'weather',
    value: weatherData.value,
    timestamp: Date.now(),
    txHash: tx.hash,
  };
}

/**
 * Fetch price data from GeckoTerminal
 * @param tokenAddress - Token contract address on Base (e.g., "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed")
 */
async function fetchPriceData(tokenAddress: string, env: Env): Promise<any> {
  // Normalize address (lowercase)
  const normalizedAddress = tokenAddress.toLowerCase();

  // GeckoTerminal API: Get token price on Base network
  // Format: /api/v2/simple/networks/{network}/token_price/{addresses}
  const response = await fetch(
    `https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/${normalizedAddress}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch price data from GeckoTerminal: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract price from response
  // Response format: { data: { attributes: { token_prices: { "0x...": "123.45" } } } }
  const tokenPrices = data.data?.attributes?.token_prices || {};
  const priceString = tokenPrices[normalizedAddress];

  if (!priceString) {
    throw new Error(`No price data found for token ${tokenAddress} on Base`);
  }

  const price = parseFloat(priceString);

  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid price data for token ${tokenAddress}: ${priceString}`);
  }

  return {
    value: price,
    decimals: 8,
    source: 'geckoterminal',
    tokenAddress: normalizedAddress,
  };
}

/**
 * Fetch weather data from OpenWeatherMap
 */
async function fetchWeatherData(oracleInfo: any, env: Env): Promise<any> {
  if (!env.OPENWEATHER_API_KEY) {
    throw new Error('OpenWeather API key not configured');
  }

  // Example: Weather for a specific location
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${env.OPENWEATHER_API_KEY}&units=metric`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const data = await response.json();

  // Return temperature as the value
  const temp = data.main.temp;

  return {
    value: Math.round(temp * 100), // Store as integer (e.g., 25.50°C = 2550)
    decimals: 2,
    source: 'openweathermap',
  };
}

/**
 * Fetch Farcaster metrics from Neynar API
 */
async function fetchFarcasterMetrics(targetToken: string, env: Env): Promise<any> {
  if (!env.NEYNAR_API_KEY) {
    throw new Error('Neynar API key not configured');
  }

  // Remove $ if present and normalize
  const cleanToken = targetToken.replace('$', '').toUpperCase();
  const searchQuery = `$${cleanToken}`;

  console.log(`Fetching Farcaster metrics for ${searchQuery}`);

  // Search for casts mentioning the token
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(searchQuery)}&limit=100`,
    {
      headers: {
        'accept': 'application/json',
        'api_key': env.NEYNAR_API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const casts = data.result?.casts || [];

  console.log(`Found ${casts.length} casts for ${searchQuery}`);

  // Calculate metrics
  const now = Date.now();
  const twentyFourHoursAgo = now - 86400000; // 24 hours in ms

  // Filter casts from last 24 hours
  const recentCasts = casts.filter((cast: any) => {
    const castTime = new Date(cast.timestamp).getTime();
    return castTime >= twentyFourHoursAgo;
  });

  const mentions24h = recentCasts.length;

  // Count unique users
  const uniqueUserFids = new Set(casts.map((cast: any) => cast.author.fid));
  const uniqueUsers = uniqueUserFids.size;

  // Calculate total engagement
  let totalEngagement = 0;
  for (const cast of casts) {
    const likes = cast.reactions?.likes_count || 0;
    const recasts = cast.reactions?.recasts_count || 0;
    const replies = cast.replies?.count || 0;
    totalEngagement += likes + recasts + replies;
  }

  // Calculate engagement rate (engagement per cast, in basis points)
  const engagementRate = casts.length > 0
    ? Math.floor((totalEngagement / casts.length) * 10000)
    : 0;

  // Calculate sentiment score
  const sentimentScore = calculateSentiment(casts);

  // Find top performing cast (highest engagement)
  let topCast = casts[0];
  let maxEngagement = 0;

  for (const cast of casts) {
    const likes = cast.reactions?.likes_count || 0;
    const recasts = cast.reactions?.recasts_count || 0;
    const replies = cast.replies?.count || 0;
    const engagement = likes + recasts + replies;

    if (engagement > maxEngagement) {
      maxEngagement = engagement;
      topCast = cast;
    }
  }

  const topCastFid = topCast?.author?.fid || 0;

  return {
    mentions24h,
    sentimentScore,
    engagementRate,
    uniqueUsers,
    totalEngagement,
    topCastFid,
  };
}

/**
 * Calculate sentiment score from casts
 * Returns score from -10000 to +10000 (basis points)
 */
function calculateSentiment(casts: any[]): number {
  const positiveWords = [
    'bullish', 'bull', 'moon', 'mooning', 'gem', 'based', 'lfg', 'lets go',
    'pump', 'pumping', 'green', 'up', 'buy', 'buying', 'long', 'calls',
    'growth', 'gains', 'winning', 'alpha', 'send', 'sending', 'love',
    'amazing', 'great', 'awesome', 'fire', '🔥', '🚀', '📈', '💎', '✅',
  ];

  const negativeWords = [
    'bearish', 'bear', 'dump', 'dumping', 'scam', 'rug', 'rugged', 'dead',
    'rip', 'sell', 'selling', 'short', 'puts', 'loss', 'losses', 'down',
    'red', 'crash', 'crashing', 'hate', 'terrible', 'awful', 'bad',
    '📉', '💀', '❌', '⚠️', '🚨',
  ];

  let score = 0;
  let totalWords = 0;

  for (const cast of casts) {
    const text = cast.text?.toLowerCase() || '';

    // Count positive words
    for (const word of positiveWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * 100; // Each positive word = +100 points
        totalWords += matches.length;
      }
    }

    // Count negative words
    for (const word of negativeWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score -= matches.length * 100; // Each negative word = -100 points
        totalWords += matches.length;
      }
    }
  }

  // If no sentiment words found, return neutral (0)
  if (totalWords === 0) {
    return 0;
  }

  // Normalize to -10000 to +10000 range based on word density
  // More aggressive scaling for stronger signals
  const normalizedScore = Math.floor((score / casts.length) * 50);

  // Clamp to -10000 to +10000 range
  return Math.max(-10000, Math.min(10000, normalizedScore));
}
