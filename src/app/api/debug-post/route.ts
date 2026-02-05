// Debug endpoint for testing Farcaster posting
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;

  const text = request.nextUrl.searchParams.get('text') || 'debug test from fixr';
  const parent = request.nextUrl.searchParams.get('parent'); // Optional parent hash for replies

  if (!apiKey || !signerUuid) {
    return NextResponse.json({
      error: 'Missing credentials',
      apiKey: !!apiKey,
      signerUuid: !!signerUuid,
    });
  }

  const bodyData: { signer_uuid: string; text: string; parent?: string } = {
    signer_uuid: signerUuid,
    text: text,
  };

  if (parent) {
    bodyData.parent = parent;
  }

  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return NextResponse.json({
      request: {
        url: 'https://api.neynar.com/v2/farcaster/cast',
        headers: {
          'x-api-key': `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
          'Content-Type': 'application/json',
        },
        body: bodyData,
        bodyJson: JSON.stringify(bodyData),
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        data,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: (error as Error).stack,
    });
  }
}
