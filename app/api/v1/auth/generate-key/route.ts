import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * POST /api/v1/auth/generate-key
 * Generate an API key by verifying wallet signature
 *
 * Body: { walletAddress, signature, message }
 */
export async function POST(request: Request) {
  try {
    const { walletAddress, signature, message } = await request.json();

    // Validate inputs
    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, signature, message' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Verify the message format (prevent replay attacks)
    const expectedMessagePrefix = 'Sign this message to generate your FEEDS API key.\n\nWallet: ';
    if (!message.startsWith(expectedMessagePrefix)) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // Verify signature
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Check recovered address matches claimed address
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Signature does not match wallet address' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if key already exists for this wallet
    const { data: existingKey } = await supabase
      .from('api_keys')
      .select('api_key, created_at')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('is_active', true)
      .single();

    if (existingKey) {
      // Return existing key
      return NextResponse.json({
        success: true,
        apiKey: existingKey.api_key,
        walletAddress: walletAddress.toLowerCase(),
        isNew: false,
        createdAt: existingKey.created_at,
      });
    }

    // Generate new API key
    const apiKey = `feeds_${crypto.randomBytes(24).toString('hex')}`;

    // Get or create a system user for non-authenticated API key holders
    // For now, we'll use the wallet address as a pseudo-user-id
    const pseudoUserId = ethers.keccak256(ethers.toUtf8Bytes(walletAddress.toLowerCase())).slice(0, 42);

    // Insert new API key
    const { data: newKey, error } = await supabase
      .from('api_keys')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        api_key: apiKey,
        signature,
        message,
        name: 'Default',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create API key:', error);
      return NextResponse.json(
        { error: 'Failed to create API key', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      apiKey: newKey.api_key,
      walletAddress: walletAddress.toLowerCase(),
      isNew: true,
      createdAt: newKey.created_at,
    });

  } catch (error: any) {
    console.error('Generate key error:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key', details: error.message },
      { status: 500 }
    );
  }
}
