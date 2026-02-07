import { NextResponse } from 'next/server';

/**
 * DEPRECATED: Oracle deployment now happens client-side using user's wallet
 *
 * This endpoint is no longer used. Oracle deployments are handled entirely
 * in the frontend (app/create-oracle/page.tsx) where users pay for their
 * own oracle deployments using their connected wallet.
 *
 * Benefits of client-side deployment:
 * - Users pay their own gas fees
 * - More decentralized (no centralized deployer wallet)
 * - Clear ownership (msg.sender is the actual deployer)
 * - No private key management on backend
 *
 * Database records are created and updated directly from the client
 * using Supabase RLS policies to ensure security.
 */
export async function POST(request: Request) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use client-side deployment instead.' },
    { status: 410 } // 410 Gone
  );
}
