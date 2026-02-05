// Debug endpoint to check environment variables
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    env: {
      NEYNAR_API_KEY: process.env.NEYNAR_API_KEY ? `${process.env.NEYNAR_API_KEY.slice(0, 8)}...` : 'NOT SET',
      FARCASTER_SIGNER_UUID: process.env.FARCASTER_SIGNER_UUID ? `${process.env.FARCASTER_SIGNER_UUID.slice(0, 8)}...` : 'NOT SET',
      X_API_KEY: process.env.X_API_KEY ? `${process.env.X_API_KEY.slice(0, 8)}...` : 'NOT SET',
      X_API_SECRET: process.env.X_API_SECRET ? 'SET' : 'NOT SET',
      X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN ? `${process.env.X_ACCESS_TOKEN.slice(0, 8)}...` : 'NOT SET',
      X_ACCESS_SECRET: process.env.X_ACCESS_SECRET ? 'SET' : 'NOT SET',
    },
  });
}
