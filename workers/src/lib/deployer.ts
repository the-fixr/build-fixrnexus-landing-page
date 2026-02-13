/**
 * CREATE2 Contract Deployer for Fixr
 * Deploys the FixrDeployer factory contract and builds transactions for user deployments
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toHex,
  parseAbiParameters,
  type Address,
  type Hash,
  type Hex,
} from 'viem';
import { base, mainnet, arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from './types';
import { FACTORY_BYTECODE, FACTORY_ABI } from './factory-bytecode';

// Re-export for convenience
export { FACTORY_ABI };

// Supported chains (excluding Monad for now - no gas there)
export const SUPPORTED_CHAINS = {
  base: {
    id: 8453,
    name: 'Base',
    chain: base,
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
  ethereum: {
    id: 1,
    name: 'Ethereum',
    chain: mainnet,
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    chain: arbitrum,
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
  },
} as const;

export type SupportedChain = keyof typeof SUPPORTED_CHAINS;
export type TokenStandard = 'erc20' | 'erc721' | 'erc1155';

// ============================================================================
// Helper Functions
// ============================================================================

function getRpcUrl(chain: SupportedChain, env: Env): string {
  const chainConfig = SUPPORTED_CHAINS[chain];

  // Prefer Alchemy for reliability
  if (env.ALCHEMY_API_KEY) {
    if (chain === 'base') {
      return `https://base-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
    } else if (chain === 'ethereum') {
      return `https://eth-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
    } else if (chain === 'arbitrum') {
      return `https://arb-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
    }
  }

  // Fall back to custom RPC or default
  if (chain === 'base' && env.BASE_RPC_URL) {
    return env.BASE_RPC_URL;
  } else if (chain === 'arbitrum' && env.ARBITRUM_RPC_URL) {
    return env.ARBITRUM_RPC_URL;
  }

  return chainConfig.rpc;
}

function getPublicClient(chain: SupportedChain, env: Env) {
  const chainConfig = SUPPORTED_CHAINS[chain];
  const rpcUrl = getRpcUrl(chain, env);

  return createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl),
  });
}

function normalizePrivateKey(key: string): `0x${string}` {
  // Ensure private key has 0x prefix
  if (key.startsWith('0x')) {
    return key as `0x${string}`;
  }
  return `0x${key}` as `0x${string}`;
}

function getWalletClient(chain: SupportedChain, env: Env) {
  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured');
  }

  const chainConfig = SUPPORTED_CHAINS[chain];
  const rpcUrl = getRpcUrl(chain, env);

  const account = privateKeyToAccount(normalizePrivateKey(env.WALLET_PRIVATE_KEY));

  return {
    client: createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(rpcUrl),
    }),
    account,
  };
}

// ============================================================================
// Salt Generation
// ============================================================================

/**
 * Generate deterministic salt from deployer + config
 * This ensures the same salt is used across all chains for the same token config
 */
export function generateSalt(
  deployer: Address,
  name: string,
  symbol: string,
  standard: TokenStandard
): Hex {
  const input = `${deployer.toLowerCase()}-${name}-${symbol}-${standard}-fixr-v1`;
  return keccak256(toHex(input));
}

// ============================================================================
// Factory Deployment (Admin only - Fixr deploys factory contracts)
// ============================================================================

/**
 * Deploy the FixrDeployer factory contract to a chain
 * This should only be called once per chain by Fixr admin
 * Returns txHash immediately - use checkFactoryDeployment to get the contract address
 */
export async function deployFactory(
  chain: SupportedChain,
  env: Env
): Promise<{ success: boolean; address?: Address; txHash?: Hash; error?: string; pending?: boolean }> {
  console.log(`[Deployer] Deploying factory to ${chain}...`);

  try {
    const { client, account } = getWalletClient(chain, env);

    // Deploy factory contract
    const txHash = await client.deployContract({
      abi: FACTORY_ABI,
      bytecode: FACTORY_BYTECODE,
      account,
    });

    console.log(`[Deployer] Factory deployment tx submitted: ${txHash}`);

    // Return immediately with txHash - don't wait for confirmation
    // This avoids hitting Cloudflare's subrequest limit
    return {
      success: true,
      txHash,
      pending: true,
    };
  } catch (error) {
    console.error(`[Deployer] Factory deployment error on ${chain}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check the status of a factory deployment transaction
 * Returns the contract address if deployed successfully
 */
export async function checkFactoryDeployment(
  chain: SupportedChain,
  txHash: Hash,
  env: Env
): Promise<{ success: boolean; address?: Address; pending?: boolean; error?: string }> {
  try {
    const publicClient = getPublicClient(chain, env);

    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

    if (!receipt) {
      return { success: false, pending: true };
    }

    if (receipt.status === 'success' && receipt.contractAddress) {
      return {
        success: true,
        address: receipt.contractAddress,
      };
    } else {
      return {
        success: false,
        error: 'Transaction reverted',
      };
    }
  } catch (error) {
    // If error indicates tx not found, it's still pending
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('not found') || errorMessage.includes('could not be found')) {
      return { success: false, pending: true };
    }
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// User Deployment Transaction Building
// ============================================================================

export interface DeployConfig {
  standard: TokenStandard;
  name: string;
  symbol: string;
  // ERC-20
  totalSupply?: string;
  decimals?: number;
  // ERC-721
  maxSupply?: string;
  mintPrice?: string;
  baseURI?: string;
  // ERC-1155
  tokenURI?: string;
  // Common
  owner: Address;
}

/**
 * Build transaction data for user to deploy via factory
 * User will sign and pay gas for this transaction
 */
export function buildDeployTransaction(
  factoryAddress: Address,
  config: DeployConfig
): { to: Address; data: Hex; value: bigint } {
  const salt = generateSalt(config.owner, config.name, config.symbol, config.standard);

  let data: Hex;

  if (config.standard === 'erc20') {
    const supply = BigInt(config.totalSupply || '1000000');
    data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'deployERC20',
      args: [salt, config.name, config.symbol, supply, config.decimals || 18],
    });
  } else if (config.standard === 'erc721') {
    const maxSupply = BigInt(config.maxSupply || '10000');
    const mintPrice = BigInt(Math.floor(parseFloat(config.mintPrice || '0') * 1e18));
    data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'deployERC721',
      args: [salt, config.name, config.symbol, maxSupply, mintPrice, config.baseURI || ''],
    });
  } else if (config.standard === 'erc1155') {
    data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'deployERC1155',
      args: [salt, config.tokenURI || ''],
    });
  } else {
    throw new Error(`Unsupported token standard: ${config.standard}`);
  }

  return {
    to: factoryAddress,
    data,
    value: 0n, // No ETH required for deployment (gas only)
  };
}

/**
 * Compute the expected contract address for a deployment
 */
export function computeExpectedAddress(
  factoryAddress: Address,
  config: DeployConfig
): Address {
  // This is a simplified computation - the actual address depends on the factory's CREATE2 logic
  const salt = generateSalt(config.owner, config.name, config.symbol, config.standard);

  // The actual address would be computed by the factory contract
  // For now, we'll need to call the factory's computeAddress function
  // This is just a placeholder that returns the salt-based address
  return `0x${keccak256(salt).slice(26)}` as Address;
}

// ============================================================================
// Balance & Status Checks
// ============================================================================

/**
 * Check wallet balances on all chains
 */
export async function checkBalances(env: Env): Promise<Record<SupportedChain, string>> {
  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured');
  }

  const account = privateKeyToAccount(normalizePrivateKey(env.WALLET_PRIVATE_KEY));
  const balances: Record<string, string> = {};

  for (const [chainName] of Object.entries(SUPPORTED_CHAINS)) {
    try {
      const publicClient = getPublicClient(chainName as SupportedChain, env);
      const balance = await publicClient.getBalance({ address: account.address });
      balances[chainName] = (Number(balance) / 1e18).toFixed(6);
    } catch (error) {
      balances[chainName] = 'error';
    }
  }

  return balances as Record<SupportedChain, string>;
}

/**
 * Get Fixr's deployer address
 */
export function getDeployerAddress(env: Env): Address {
  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured');
  }
  const account = privateKeyToAccount(normalizePrivateKey(env.WALLET_PRIVATE_KEY));
  return account.address;
}

/**
 * Get factory addresses from KV storage
 */
export async function getFactoryAddresses(env: Env): Promise<Record<SupportedChain, Address | null>> {
  const addresses: Record<string, Address | null> = {};

  for (const chain of Object.keys(SUPPORTED_CHAINS)) {
    const key = `factory_address_${chain}`;
    const address = await env.FIXR_KV?.get(key);
    addresses[chain] = address as Address | null;
  }

  return addresses as Record<SupportedChain, Address | null>;
}

/**
 * Save factory address to KV storage
 */
export async function saveFactoryAddress(
  chain: SupportedChain,
  address: Address,
  env: Env
): Promise<void> {
  const key = `factory_address_${chain}`;
  await env.FIXR_KV?.put(key, address);
}

// ============================================================================
// Factory Configuration (Admin only)
// ============================================================================

// Deploy fee: 0.0001 ETH = 100000000000000 wei
export const DEPLOY_FEE = 100000000000000n;
export const DEPLOY_FEE_HEX = '0x5af3107a4000';

/**
 * Set the deploy fee on a factory contract
 * Only callable by the factory owner (Fixr's wallet)
 */
export async function setDeployFee(
  chain: SupportedChain,
  factoryAddress: Address,
  fee: bigint,
  env: Env
): Promise<{ success: boolean; txHash?: Hash; error?: string }> {
  try {
    const { client, account } = getWalletClient(chain, env);

    const txHash = await client.writeContract({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'setDeployFee',
      args: [fee],
      account,
    });

    console.log(`[Deployer] setDeployFee tx on ${chain}: ${txHash}`);

    return { success: true, txHash };
  } catch (error) {
    console.error(`[Deployer] setDeployFee error on ${chain}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get current deploy fee from factory contract
 */
export async function getDeployFee(
  chain: SupportedChain,
  factoryAddress: Address,
  env: Env
): Promise<bigint> {
  const publicClient = getPublicClient(chain, env);

  const fee = await publicClient.readContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'deployFee',
  });

  return fee as bigint;
}
