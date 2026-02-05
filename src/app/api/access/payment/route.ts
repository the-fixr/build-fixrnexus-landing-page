import { NextRequest, NextResponse } from 'next/server';
import {
  PRICE_PER_CALL,
  PAYMENT_TOKEN,
  verifyPayment,
  generatePaymentUri,
  formatUsdc,
} from '@/lib/x402-payments';

/**
 * GET /api/access/payment
 * Get x402 payment info
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    x402: {
      pricePerCall: `$${formatUsdc(PRICE_PER_CALL)}`,
      priceRaw: PRICE_PER_CALL.toString(),
      token: {
        address: PAYMENT_TOKEN.address,
        symbol: PAYMENT_TOKEN.symbol,
        decimals: PAYMENT_TOKEN.decimals,
        network: 'base',
        chainId: 8453,
      },
      recipient: '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4',
      paymentUri: generatePaymentUri(),
    },
    usage: {
      description: 'Pay $0.01 USDC per API call',
      flow: [
        '1. Make request to protected endpoint',
        '2. Receive 402 response with payment details',
        '3. Send USDC to recipient address',
        '4. Retry request with X-Payment-TxHash header',
        '5. Each transaction can only be used once',
      ],
    },
    alternative: {
      description: 'Stake FIXR for rate-limited access without per-call payment',
      tiers: [
        { tier: 'FREE', stake: '0', limit: '10/min' },
        { tier: 'BUILDER', stake: '1M FIXR', limit: '20/min' },
        { tier: 'PRO', stake: '10M FIXR', limit: '50/min' },
        { tier: 'ELITE', stake: '50M FIXR', limit: 'Unlimited' },
      ],
      stakingContract: '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
    },
  });
}

/**
 * POST /api/access/payment
 * Verify a payment transaction (for debugging/testing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txHash } = body;

    if (!txHash) {
      return NextResponse.json(
        { error: 'txHash required' },
        { status: 400 }
      );
    }

    const result = await verifyPayment(txHash);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      paidAmount: result.paidAmount ? `$${formatUsdc(result.paidAmount)}` : undefined,
      note: 'This transaction has now been marked as used and cannot be reused',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
