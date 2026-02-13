/**
 * On-chain transaction utilities for Fixr
 * Handles Base network transactions like Farcaster Pro purchases
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatUnits } from 'viem';
import { base, arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from './types';

// GMX Contract addresses on Arbitrum
const GMX_EXCHANGE_ROUTER = '0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41' as const;
const GMX_DATA_STORE = '0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8' as const;
const FIXR_FEE_RECEIVER = '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4' as const;

// GMX Market addresses on Arbitrum (for claiming fees)
const GMX_MARKETS = [
  '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336', // ETH-USD
  '0x47c031236e19d024b42f8AE6780E44A573170703', // BTC-USD
  '0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407', // ARB-USD
  '0x7f1fa204bb700853D36994DA19F830b6Ad18455C', // LINK-USD
] as const;

// Tokens for claiming fees
const GMX_TOKENS = [
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', // WBTC
] as const;

// GMX ABIs
const GMX_EXCHANGE_ROUTER_ABI = parseAbi([
  'function setUiFeeFactor(uint256 uiFeeFactor) external payable',
  'function claimUiFees(address[] memory markets, address[] memory tokens, address receiver) external payable returns (uint256[])',
]);

const GMX_DATA_STORE_ABI = parseAbi([
  'function getUint(bytes32 key) view returns (uint256)',
]);

// Key for MAX_UI_FEE_FACTOR: keccak256(abi.encode("MAX_UI_FEE_FACTOR"))
const MAX_UI_FEE_FACTOR_KEY = '0xab045c9d202ad7ee7dd9fa7ab3c082d9835872721eaf03397e59b961fe399329' as `0x${string}`;

// Contract addresses on Base
const TIER_REGISTRY = '0x00000000fc84484d585C3cF48d213424DFDE43FD' as const;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Fixr's FID
const FIXR_FID = 2574393;

// TierRegistry ABI (minimal for what we need)
const TIER_REGISTRY_ABI = parseAbi([
  'function price(uint256 tier, uint256 forDays) view returns (uint256)',
  'function purchaseTier(uint256 fid, uint256 tier, uint256 forDays) external',
]);

// ERC20 ABI for USDC
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

export interface PurchaseResult {
  success: boolean;
  txHash?: string;
  error?: string;
  cost?: string;
}

/**
 * Get public client for reading from Base
 */
function getPublicClient(env: Env) {
  const rpcUrl = env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

/**
 * Get wallet client for signing transactions
 */
function getWalletClient(env: Env) {
  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured');
  }

  // Clean and ensure private key has 0x prefix
  let cleanKey = env.WALLET_PRIVATE_KEY.trim();
  if (!cleanKey.startsWith('0x')) {
    cleanKey = `0x${cleanKey}`;
  }

  // Validate key length (should be 66 chars with 0x prefix for 32 bytes)
  if (cleanKey.length !== 66) {
    throw new Error(`Invalid private key length: ${cleanKey.length} (expected 66)`);
  }

  const rpcUrl = env.BASE_RPC_URL || 'https://mainnet.base.org';
  const account = privateKeyToAccount(cleanKey as `0x${string}`);

  return {
    client: createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl),
    }),
    account,
  };
}

/**
 * Get the price for Farcaster Pro subscription
 * @param days Number of days to subscribe (365 for a year)
 */
export async function getFarcasterProPrice(env: Env, days: number = 365): Promise<{ priceUSDC: string; priceRaw: bigint }> {
  const publicClient = getPublicClient(env);

  const price = await publicClient.readContract({
    address: TIER_REGISTRY,
    abi: TIER_REGISTRY_ABI,
    functionName: 'price',
    args: [1n, BigInt(days)], // tier 1 = Pro
  });

  return {
    priceUSDC: formatUnits(price, 6), // USDC has 6 decimals
    priceRaw: price,
  };
}

/**
 * Check USDC balance and allowance for the wallet
 */
export async function checkUSDCBalance(env: Env): Promise<{
  balance: string;
  allowance: string;
  balanceRaw: bigint;
  allowanceRaw: bigint;
}> {
  const publicClient = getPublicClient(env);
  const { account } = getWalletClient(env);

  const [balance, allowance] = await Promise.all([
    publicClient.readContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.readContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, TIER_REGISTRY],
    }),
  ]);

  return {
    balance: formatUnits(balance, 6),
    allowance: formatUnits(allowance, 6),
    balanceRaw: balance,
    allowanceRaw: allowance,
  };
}

/**
 * Approve USDC spending for TierRegistry
 */
export async function approveUSDC(env: Env, amount: bigint): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const publicClient = getPublicClient(env);
    const { client, account } = getWalletClient(env);

    console.log(`Approving ${formatUnits(amount, 6)} USDC for TierRegistry...`);

    const hash = await client.writeContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [TIER_REGISTRY, amount],
    });

    console.log('Approval tx submitted:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('USDC approval confirmed');
      return { success: true, txHash: hash };
    } else {
      return { success: false, error: 'Approval transaction failed' };
    }
  } catch (error) {
    console.error('USDC approval error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Purchase Farcaster Pro subscription
 * @param days Number of days (365 for annual, minimum is typically 30)
 * @param fid FID to purchase for (defaults to Fixr's FID)
 */
export async function purchaseFarcasterPro(
  env: Env,
  days: number = 365,
  fid: number = FIXR_FID
): Promise<PurchaseResult> {
  try {
    const publicClient = getPublicClient(env);
    const { client, account } = getWalletClient(env);

    // Get the price
    const { priceUSDC, priceRaw } = await getFarcasterProPrice(env, days);
    console.log(`Farcaster Pro price for ${days} days: $${priceUSDC} USDC`);

    // Check balance and allowance
    const { balanceRaw, allowanceRaw } = await checkUSDCBalance(env);

    if (balanceRaw < priceRaw) {
      return {
        success: false,
        error: `Insufficient USDC balance. Need ${priceUSDC}, have ${formatUnits(balanceRaw, 6)}`,
        cost: priceUSDC,
      };
    }

    // Approve if needed
    if (allowanceRaw < priceRaw) {
      console.log('Insufficient allowance, approving USDC...');
      const approvalResult = await approveUSDC(env, priceRaw);
      if (!approvalResult.success) {
        return { success: false, error: `Approval failed: ${approvalResult.error}` };
      }
    }

    // Purchase Pro subscription
    console.log(`Purchasing Farcaster Pro for FID ${fid} (${days} days)...`);

    const hash = await client.writeContract({
      address: TIER_REGISTRY,
      abi: TIER_REGISTRY_ABI,
      functionName: 'purchaseTier',
      args: [BigInt(fid), 1n, BigInt(days)], // tier 1 = Pro
    });

    console.log('Purchase tx submitted:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('Farcaster Pro purchase confirmed!');
      return {
        success: true,
        txHash: hash,
        cost: priceUSDC,
      };
    } else {
      return { success: false, error: 'Purchase transaction failed' };
    }
  } catch (error) {
    console.error('Farcaster Pro purchase error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get wallet address from private key
 */
export function getWalletAddress(env: Env): string | null {
  if (!env.WALLET_PRIVATE_KEY) {
    return null;
  }
  const account = privateKeyToAccount(env.WALLET_PRIVATE_KEY as `0x${string}`);
  return account.address;
}

/**
 * Transfer USDC to another address using private key wallet
 */
export async function transferUSDC(
  env: Env,
  to: string,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const publicClient = getPublicClient(env);
    const { client } = getWalletClient(env);

    // Convert amount to USDC units (6 decimals)
    const amountRaw = BigInt(Math.floor(amount * 1_000_000));

    console.log(`Transferring ${amount} USDC to ${to}...`);

    const hash = await client.writeContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to as `0x${string}`, amountRaw],
    });

    console.log('Transfer tx submitted:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('USDC transfer confirmed!');
      return { success: true, txHash: hash };
    } else {
      return { success: false, error: 'Transfer transaction failed' };
    }
  } catch (error) {
    console.error('USDC transfer error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Transfer USDC using Neynar's managed wallet
 * Uses Neynar's sendFungiblesToUsers API
 */
export async function transferUSDCViaNeynar(
  env: Env,
  recipientFid: number,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (!env.NEYNAR_API_KEY || !env.NEYNAR_WALLET_ID) {
    return { success: false, error: 'Neynar wallet not configured' };
  }

  try {
    console.log(`Sending ${amount} USDC to FID ${recipientFid} via Neynar wallet...`);

    const response = await fetch('https://api.neynar.com/v2/farcaster/fungible/send', {
      method: 'POST',
      headers: {
        'x-api-key': env.NEYNAR_API_KEY,
        'x-wallet-id': env.NEYNAR_WALLET_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network: 'base',
        fungible_contract_address: USDC_BASE,
        recipients: [
          {
            fid: recipientFid,
            amount: amount, // Keep as number
          },
        ],
      }),
    });

    const data = await response.json() as { success?: boolean; message?: string; error?: string; details?: unknown };

    if (!response.ok) {
      console.error('Neynar transfer failed:', response.status, JSON.stringify(data));
      return {
        success: false,
        error: `${response.status}: ${data.message || data.error || JSON.stringify(data)}`,
      };
    }

    console.log('Neynar USDC transfer successful');
    return { success: true };
  } catch (error) {
    console.error('Neynar transfer error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Transfer any ERC20 token to another address
 */
export async function transferERC20(
  env: Env,
  tokenAddress: string,
  to: string,
  amount: string,
  decimals: number = 18
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const publicClient = getPublicClient(env);
    const { client } = getWalletClient(env);

    // Convert amount to token units
    const amountRaw = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));

    console.log(`Transferring ${amount} tokens (${tokenAddress}) to ${to}...`);

    const hash = await client.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to as `0x${string}`, amountRaw],
    });

    console.log('Transfer tx submitted:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('Token transfer confirmed!');
      return { success: true, txHash: hash };
    } else {
      return { success: false, error: 'Transfer transaction failed' };
    }
  } catch (error) {
    console.error('Token transfer error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// GMX UI Fee Management (Arbitrum)
// ============================================

/**
 * Get Arbitrum public client for reading from GMX contracts
 */
function getArbitrumPublicClient() {
  return createPublicClient({
    chain: arbitrum,
    transport: http('https://arb1.arbitrum.io/rpc'),
  });
}

/**
 * Get Arbitrum wallet client for signing transactions
 */
function getArbitrumWalletClient(env: Env) {
  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured');
  }

  // Ensure private key has 0x prefix
  const privateKey = env.WALLET_PRIVATE_KEY.startsWith('0x')
    ? env.WALLET_PRIVATE_KEY
    : `0x${env.WALLET_PRIVATE_KEY}`;

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return {
    client: createWalletClient({
      account,
      chain: arbitrum,
      transport: http('https://arb1.arbitrum.io/rpc'),
    }),
    account,
  };
}

/**
 * Query MAX_UI_FEE_FACTOR from GMX DataStore
 */
export async function getGmxMaxUiFeeFactor(): Promise<{ raw: bigint; percentage: number }> {
  const publicClient = getArbitrumPublicClient();

  const maxFactor = await publicClient.readContract({
    address: GMX_DATA_STORE,
    abi: GMX_DATA_STORE_ABI,
    functionName: 'getUint',
    args: [MAX_UI_FEE_FACTOR_KEY],
  });

  const percentage = Number(maxFactor) / 1e30 * 100;
  return { raw: maxFactor, percentage };
}

/**
 * Register as GMX UI fee receiver by calling setUiFeeFactor
 * The wallet calling this becomes the fee receiver at the specified rate
 */
export async function registerGmxUiFeeReceiver(
  env: Env,
  feeFactor?: bigint
): Promise<{ success: boolean; txHash?: string; error?: string; feeFactor?: string; percentage?: string }> {
  try {
    const publicClient = getArbitrumPublicClient();
    const { client, account } = getArbitrumWalletClient(env);

    // Verify the wallet address matches FIXR_FEE_RECEIVER
    if (account.address.toLowerCase() !== FIXR_FEE_RECEIVER.toLowerCase()) {
      return {
        success: false,
        error: `Wallet address mismatch. Expected ${FIXR_FEE_RECEIVER}, got ${account.address}`,
      };
    }

    // If no fee factor specified, use the max allowed
    let uiFeeFactor = feeFactor;
    if (!uiFeeFactor) {
      const { raw: maxFactor } = await getGmxMaxUiFeeFactor();
      uiFeeFactor = maxFactor;
    }

    const percentage = Number(uiFeeFactor) / 1e30 * 100;
    console.log(`Registering GMX UI fee receiver: ${account.address}`);
    console.log(`Fee factor: ${uiFeeFactor} (${percentage}%)`);

    const hash = await client.writeContract({
      address: GMX_EXCHANGE_ROUTER,
      abi: GMX_EXCHANGE_ROUTER_ABI,
      functionName: 'setUiFeeFactor',
      args: [uiFeeFactor],
    });

    console.log('Registration tx submitted:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('GMX UI fee registration confirmed!');
      return {
        success: true,
        txHash: hash,
        feeFactor: uiFeeFactor.toString(),
        percentage: `${percentage}%`,
      };
    } else {
      return { success: false, error: 'Registration transaction failed' };
    }
  } catch (error) {
    console.error('GMX UI fee registration error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Claim accumulated GMX UI fees
 * Fees are sent to FIXR_FEE_RECEIVER
 */
export async function claimGmxUiFees(
  env: Env
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const publicClient = getArbitrumPublicClient();
    const { client, account } = getArbitrumWalletClient(env);

    console.log(`Claiming GMX UI fees for: ${FIXR_FEE_RECEIVER}`);
    console.log(`Caller: ${account.address}`);
    console.log(`Markets: ${GMX_MARKETS.length}, Tokens: ${GMX_TOKENS.length}`);

    const hash = await client.writeContract({
      address: GMX_EXCHANGE_ROUTER,
      abi: GMX_EXCHANGE_ROUTER_ABI,
      functionName: 'claimUiFees',
      args: [[...GMX_MARKETS], [...GMX_TOKENS], FIXR_FEE_RECEIVER],
    });

    console.log('Claim tx submitted:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('GMX UI fee claim confirmed!');
      return { success: true, txHash: hash };
    } else {
      return { success: false, error: 'Claim transaction failed' };
    }
  } catch (error) {
    console.error('GMX UI fee claim error:', error);
    return { success: false, error: String(error) };
  }
}

