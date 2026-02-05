import { ethers } from 'ethers';

// Payment recipient (treasury)
const PAYMENT_RECIPIENT = '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4';
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// USDC on Base (6 decimals)
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// $0.01 per API call
export const PRICE_PER_CALL = 10000n; // 0.01 USDC (6 decimals)

export const PAYMENT_TOKEN = {
  address: USDC_ADDRESS,
  symbol: 'USDC',
  decimals: USDC_DECIMALS,
} as const;

// Track used transaction hashes to prevent replay
const usedTxHashes = new Set<string>();

// ERC20 Transfer event signature
const TRANSFER_EVENT_TOPIC = ethers.id('Transfer(address,address,uint256)');

/**
 * Format USDC amount (6 decimals) to human readable
 */
export function formatUsdc(amount: bigint): string {
  return (Number(amount) / 10 ** USDC_DECIMALS).toFixed(2);
}

export interface X402Response {
  status: 402;
  headers: {
    'X-Payment-Required': 'true';
    'X-Payment-Token': string;
    'X-Payment-Recipient': string;
    'X-Payment-Amount': string;
    'X-Payment-Currency': string;
    'X-Payment-Network': string;
    'X-Payment-Chain-Id': string;
  };
  body: {
    error: 'payment_required';
    message: string;
    payment: {
      tokenAddress: string;
      recipient: string;
      amount: string;
      amountRaw: string;
      currency: string;
      decimals: number;
      network: string;
      chainId: number;
    };
    alternatives: {
      staking: {
        description: string;
        minAmount: string;
        contractAddress: string;
      };
    };
  };
}

/**
 * Generate a 402 Payment Required response
 */
export function generate402Response(
  requestedEndpoint: string,
  customMessage?: string
): X402Response {
  const amountFormatted = formatUsdc(PRICE_PER_CALL);

  return {
    status: 402,
    headers: {
      'X-Payment-Required': 'true',
      'X-Payment-Token': USDC_ADDRESS,
      'X-Payment-Recipient': PAYMENT_RECIPIENT,
      'X-Payment-Amount': amountFormatted,
      'X-Payment-Currency': 'USDC',
      'X-Payment-Network': 'base',
      'X-Payment-Chain-Id': '8453',
    },
    body: {
      error: 'payment_required',
      message: customMessage || `Payment of $${amountFormatted} USDC required to access ${requestedEndpoint}`,
      payment: {
        tokenAddress: USDC_ADDRESS,
        recipient: PAYMENT_RECIPIENT,
        amount: amountFormatted,
        amountRaw: PRICE_PER_CALL.toString(),
        currency: 'USDC',
        decimals: USDC_DECIMALS,
        network: 'base',
        chainId: 8453,
      },
      alternatives: {
        staking: {
          description: 'Stake FIXR tokens for unlimited API access',
          minAmount: '1,000,000 FIXR (Builder tier)',
          contractAddress: '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
        },
      },
    },
  };
}

/**
 * Verify a USDC payment transaction for x402
 * Returns true only once per txHash (prevents replay)
 */
export async function verifyPayment(
  txHash: string
): Promise<{ valid: boolean; paidAmount?: bigint; error?: string }> {
  // Prevent replay attacks - each tx can only be used once
  const normalizedHash = txHash.toLowerCase();
  if (usedTxHashes.has(normalizedHash)) {
    return { valid: false, error: 'Transaction already used' };
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return { valid: false, error: 'Transaction not found or not confirmed' };
    }

    if (receipt.status !== 1) {
      return { valid: false, error: 'Transaction failed' };
    }

    // Find USDC Transfer event to our recipient
    let paidAmount = 0n;

    for (const log of receipt.logs) {
      // Check if this is a Transfer event from USDC contract
      if (
        log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
        log.topics[0] === TRANSFER_EVENT_TOPIC
      ) {
        // Decode recipient (topic[2]) and amount (data)
        const recipient = ethers.getAddress('0x' + log.topics[2].slice(26));

        if (recipient.toLowerCase() === PAYMENT_RECIPIENT.toLowerCase()) {
          const amount = BigInt(log.data);
          paidAmount += amount;
        }
      }
    }

    if (paidAmount === 0n) {
      return { valid: false, error: 'No USDC payment to treasury found' };
    }

    if (paidAmount < PRICE_PER_CALL) {
      return {
        valid: false,
        paidAmount,
        error: `Insufficient payment. Required $${formatUsdc(PRICE_PER_CALL)}, got $${formatUsdc(paidAmount)}`,
      };
    }

    // Mark transaction as used (single use per tx)
    usedTxHashes.add(normalizedHash);

    return { valid: true, paidAmount };
  } catch (error) {
    console.error('Payment verification error:', error);
    return { valid: false, error: 'Failed to verify payment' };
  }
}

/**
 * Check if payment amount covers multiple calls
 * For bulk payments: $0.01 per call
 */
export function calculateCallsFromPayment(amount: bigint): number {
  return Math.floor(Number(amount) / Number(PRICE_PER_CALL));
}

/**
 * Generate EIP-681 payment URI for USDC transfer
 */
export function generatePaymentUri(): string {
  // EIP-681 format for ERC20: ethereum:<token_address>@<chainId>/transfer?address=<recipient>&uint256=<amount>
  return `ethereum:${USDC_ADDRESS}@8453/transfer?address=${PAYMENT_RECIPIENT}&uint256=${PRICE_PER_CALL}`;
}
