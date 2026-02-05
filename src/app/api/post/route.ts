// Fixr Agent Post Test Endpoint
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { postToBoth, postToFarcaster, postToX } from '@/lib/social';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, platform, embeds } = body as {
      text: string;
      platform?: 'x' | 'farcaster' | 'both';
      embeds?: { url: string }[];
    };

    if (!text) {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }

    let result;
    switch (platform) {
      case 'x':
        result = { x: await postToX(text), farcaster: { success: false, error: 'skipped' } };
        break;
      case 'farcaster':
        result = { x: { success: false, error: 'skipped' }, farcaster: await postToFarcaster(text, embeds) };
        break;
      default:
        result = await postToBoth(text, embeds);
    }

    return NextResponse.json({
      success: result.x.success || result.farcaster.success,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint for quick test
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get('text') || 'test post from Fixr agent';
  const platform = searchParams.get('platform') as 'x' | 'farcaster' | 'both' | null;

  let result;
  switch (platform) {
    case 'x':
      result = { x: await postToX(text), farcaster: { success: false, error: 'skipped' } };
      break;
    case 'farcaster':
      result = { x: { success: false, error: 'skipped' }, farcaster: await postToFarcaster(text) };
      break;
    default:
      result = await postToBoth(text);
  }

  return NextResponse.json({
    success: result.x.success || result.farcaster.success,
    result,
  });
}
