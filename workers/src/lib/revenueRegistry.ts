/**
 * Revenue Contract Registry
 *
 * Tracks all Fixr revenue-generating contracts across chains
 * Provides unified balance checking and withdrawal capabilities
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  type Address,
  type Hash,
} from 'viem';
import { base, arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from './types';

// ============================================================================
// CONTRACT REGISTRY
// ============================================================================

export type ContractType = 'factory' | 'nft' | 'fee_receiver';

export interface RevenueContract {
  id: string;
  name: string;
  type: ContractType;
  chain: 'base' | 'arbitrum';
  chainId: number;
  address: Address;
  description: string;
  feeType: string;
  withdrawFunction: 'withdraw()' | 'withdraw(address)' | 'none';
  // Track last withdrawal
  lastWithdrawalTx?: Hash;
  lastWithdrawalTime?: string;
  lastWithdrawalAmount?: string;
}

/**
 * Master registry of all Fixr revenue-generating contracts
 */
export const REVENUE_CONTRACTS: RevenueContract[] = [
  {
    id: 'builder-id-base',
    name: 'Builder ID NFT',
    type: 'nft',
    chain: 'base',
    chainId: 8453,
    address: '0xbe2940989E203FE1cfD75e0bAa1202D58A273956',
    description: 'Soulbound Builder ID NFT - mint fee 0.0001 ETH',
    feeType: 'mint_fee',
    withdrawFunction: 'withdraw(address)',
  },
  {
    id: 'deployer-factory-base',
    name: 'FixrDeployer Factory (Base)',
    type: 'factory',
    chain: 'base',
    chainId: 8453,
    address: '0x8b804b24c2f3ba544fa8ffbbfe20dd182aa773ba',
    description: 'CREATE2 token factory - deploy fee 0.0001 ETH',
    feeType: 'deploy_fee',
    withdrawFunction: 'withdraw()',
  },
  {
    id: 'deployer-factory-arbitrum',
    name: 'FixrDeployer Factory (Arbitrum)',
    type: 'factory',
    chain: 'arbitrum',
    chainId: 42161,
    address: '0xeefc3ddcbf23c682782581fb9d04b03dca332d28',
    description: 'CREATE2 token factory - deploy fee 0.0001 ETH',
    feeType: 'deploy_fee',
    withdrawFunction: 'withdraw()',
  },
  {
    id: 'gmx-ui-fees-arbitrum',
    name: 'GMX UI Fees (Arbitrum)',
    type: 'fee_receiver',
    chain: 'arbitrum',
    chainId: 42161,
    address: '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4',
    description: 'GMX protocol sends UI fees directly to this wallet',
    feeType: 'ui_fee',
    withdrawFunction: 'none', // Fees go directly to wallet, no withdrawal needed
  },
];

// ============================================================================
// CONTRACT ABIs
// ============================================================================

const WITHDRAW_ABI = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

const WITHDRAW_TO_ABI = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
] as const;

// ============================================================================
// CHAIN CONFIGURATION
// ============================================================================

const CHAINS = {
  base: {
    chain: base,
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
  arbitrum: {
    chain: arbitrum,
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
  },
} as const;

function getRpcUrl(chain: 'base' | 'arbitrum', env: Env): string {
  if (env.ALCHEMY_API_KEY) {
    if (chain === 'base') {
      return `https://base-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
    } else if (chain === 'arbitrum') {
      return `https://arb-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
    }
  }

  if (chain === 'base' && env.BASE_RPC_URL) {
    return env.BASE_RPC_URL;
  } else if (chain === 'arbitrum' && env.ARBITRUM_RPC_URL) {
    return env.ARBITRUM_RPC_URL;
  }

  return CHAINS[chain].rpc;
}

function getPublicClient(chain: 'base' | 'arbitrum', env: Env) {
  const chainConfig = CHAINS[chain];
  const rpcUrl = getRpcUrl(chain, env);

  return createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl),
  });
}

function normalizePrivateKey(key: string): `0x${string}` {
  if (key.startsWith('0x')) {
    return key as `0x${string}`;
  }
  return `0x${key}` as `0x${string}`;
}

function getWalletClient(chain: 'base' | 'arbitrum', env: Env) {
  if (!env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured');
  }

  const chainConfig = CHAINS[chain];
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
// BALANCE CHECKING
// ============================================================================

export interface ContractBalance {
  contractId: string;
  name: string;
  chain: string;
  address: Address;
  balanceWei: string;
  balanceEth: string;
  canWithdraw: boolean;
  explorerUrl: string;
}

/**
 * Get balance of a single revenue contract
 */
export async function getContractBalance(
  contract: RevenueContract,
  env: Env
): Promise<ContractBalance> {
  const publicClient = getPublicClient(contract.chain, env);

  try {
    const balance = await publicClient.getBalance({ address: contract.address });
    const chainConfig = CHAINS[contract.chain];

    return {
      contractId: contract.id,
      name: contract.name,
      chain: contract.chain,
      address: contract.address,
      balanceWei: balance.toString(),
      balanceEth: formatEther(balance),
      canWithdraw: contract.withdrawFunction !== 'none' && balance > 0n,
      explorerUrl: `${chainConfig.explorer}/address/${contract.address}`,
    };
  } catch (error) {
    console.error(`Error fetching balance for ${contract.id}:`, error);
    return {
      contractId: contract.id,
      name: contract.name,
      chain: contract.chain,
      address: contract.address,
      balanceWei: '0',
      balanceEth: '0',
      canWithdraw: false,
      explorerUrl: `${CHAINS[contract.chain].explorer}/address/${contract.address}`,
    };
  }
}

/**
 * Get balances for all revenue contracts
 */
export async function getAllContractBalances(env: Env): Promise<{
  contracts: ContractBalance[];
  totalBalanceEth: string;
  withdrawableBalanceEth: string;
}> {
  const balances = await Promise.all(
    REVENUE_CONTRACTS.map(contract => getContractBalance(contract, env))
  );

  let totalWei = 0n;
  let withdrawableWei = 0n;

  for (const balance of balances) {
    totalWei += BigInt(balance.balanceWei);
    if (balance.canWithdraw) {
      withdrawableWei += BigInt(balance.balanceWei);
    }
  }

  return {
    contracts: balances,
    totalBalanceEth: formatEther(totalWei),
    withdrawableBalanceEth: formatEther(withdrawableWei),
  };
}

// ============================================================================
// WITHDRAWAL OPERATIONS
// ============================================================================

export interface WithdrawalResult {
  success: boolean;
  contractId: string;
  txHash?: Hash;
  amountEth?: string;
  error?: string;
  explorerUrl?: string;
}

/**
 * Withdraw funds from a single contract
 */
export async function withdrawFromContract(
  contractId: string,
  recipient: Address,
  env: Env
): Promise<WithdrawalResult> {
  const contract = REVENUE_CONTRACTS.find(c => c.id === contractId);

  if (!contract) {
    return { success: false, contractId, error: 'Contract not found' };
  }

  if (contract.withdrawFunction === 'none') {
    return { success: false, contractId, error: 'This contract does not support withdrawal' };
  }

  try {
    const { client, account } = getWalletClient(contract.chain, env);
    const publicClient = getPublicClient(contract.chain, env);
    const chainConfig = CHAINS[contract.chain];

    // Get current balance before withdrawal
    const balance = await publicClient.getBalance({ address: contract.address });

    if (balance === 0n) {
      return { success: false, contractId, error: 'Contract has zero balance' };
    }

    let txHash: Hash;

    if (contract.withdrawFunction === 'withdraw()') {
      txHash = await client.writeContract({
        address: contract.address,
        abi: WITHDRAW_ABI,
        functionName: 'withdraw',
        account,
      });
    } else if (contract.withdrawFunction === 'withdraw(address)') {
      txHash = await client.writeContract({
        address: contract.address,
        abi: WITHDRAW_TO_ABI,
        functionName: 'withdraw',
        args: [recipient],
        account,
      });
    } else {
      return { success: false, contractId, error: 'Unknown withdraw function' };
    }

    // Wait for confirmation so the nonce advances before the next tx on the same chain
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(`[Revenue] Withdrawal from ${contract.name}: ${txHash}`);

    return {
      success: true,
      contractId,
      txHash,
      amountEth: formatEther(balance),
      explorerUrl: `${chainConfig.explorer}/tx/${txHash}`,
    };
  } catch (error) {
    console.error(`[Revenue] Withdrawal error for ${contractId}:`, error);
    return {
      success: false,
      contractId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Withdraw from all contracts with positive balances
 */
export async function withdrawFromAllContracts(
  recipient: Address,
  env: Env
): Promise<{
  results: WithdrawalResult[];
  totalWithdrawnEth: string;
  successCount: number;
  failCount: number;
}> {
  const withdrawable = REVENUE_CONTRACTS.filter(c => c.withdrawFunction !== 'none');

  const results: WithdrawalResult[] = [];
  let totalWithdrawn = 0n;
  let successCount = 0;
  let failCount = 0;

  for (const contract of withdrawable) {
    const result = await withdrawFromContract(contract.id, recipient, env);
    results.push(result);

    if (result.success && result.amountEth) {
      totalWithdrawn += BigInt(Math.floor(parseFloat(result.amountEth) * 1e18));
      successCount++;
    } else {
      failCount++;
    }
  }

  return {
    results,
    totalWithdrawnEth: formatEther(totalWithdrawn),
    successCount,
    failCount,
  };
}

// ============================================================================
// WITHDRAWAL HISTORY (via KV storage)
// ============================================================================

export interface WithdrawalRecord {
  contractId: string;
  txHash: Hash;
  amountEth: string;
  timestamp: string;
  recipient: Address;
}

/**
 * Save withdrawal record to KV
 */
export async function saveWithdrawalRecord(
  record: WithdrawalRecord,
  env: Env
): Promise<void> {
  if (!env.FIXR_KV) return;

  // Get existing records
  const historyKey = `withdrawal_history_${record.contractId}`;
  const existing = await env.FIXR_KV.get(historyKey);
  const records: WithdrawalRecord[] = existing ? JSON.parse(existing) : [];

  // Add new record (keep last 100)
  records.unshift(record);
  if (records.length > 100) {
    records.pop();
  }

  await env.FIXR_KV.put(historyKey, JSON.stringify(records));

  // Also update the contract's last withdrawal info
  const contractKey = `contract_last_withdrawal_${record.contractId}`;
  await env.FIXR_KV.put(contractKey, JSON.stringify({
    txHash: record.txHash,
    amountEth: record.amountEth,
    timestamp: record.timestamp,
  }));
}

/**
 * Get withdrawal history for a contract
 */
export async function getWithdrawalHistory(
  contractId: string,
  env: Env,
  limit: number = 10
): Promise<WithdrawalRecord[]> {
  if (!env.FIXR_KV) return [];

  const historyKey = `withdrawal_history_${contractId}`;
  const existing = await env.FIXR_KV.get(historyKey);

  if (!existing) return [];

  const records: WithdrawalRecord[] = JSON.parse(existing);
  return records.slice(0, limit);
}

/**
 * Get all withdrawal history across all contracts
 */
export async function getAllWithdrawalHistory(
  env: Env,
  limit: number = 50
): Promise<WithdrawalRecord[]> {
  if (!env.FIXR_KV) return [];

  const allRecords: WithdrawalRecord[] = [];

  for (const contract of REVENUE_CONTRACTS) {
    const records = await getWithdrawalHistory(contract.id, env, limit);
    allRecords.push(...records);
  }

  // Sort by timestamp descending
  allRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return allRecords.slice(0, limit);
}

// ============================================================================
// SUMMARY / DASHBOARD
// ============================================================================

export interface RevenueSummary {
  contracts: ContractBalance[];
  totalBalanceEth: string;
  withdrawableBalanceEth: string;
  recentWithdrawals: WithdrawalRecord[];
  lastUpdated: string;
}

/**
 * Get full revenue summary for dashboard
 */
export async function getRevenueSummary(env: Env): Promise<RevenueSummary> {
  const balances = await getAllContractBalances(env);
  const recentWithdrawals = await getAllWithdrawalHistory(env, 10);

  return {
    ...balances,
    recentWithdrawals,
    lastUpdated: new Date().toISOString(),
  };
}
