// Fixr Videos Endpoint (Livepeer)
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Livepeer video playback IDs
// These should be replaced with actual Fixr video playback IDs
const LIVEPEER_VIDEOS = [
  {
    playbackId: '20c1bfaxvujs42cj',
    title: 'Fixr',
  },
];

export async function GET() {
  try {
    // TODO: Fetch actual Fixr videos from Livepeer Studio API
    // For now, return configured videos

    return NextResponse.json({
      success: true,
      videos: LIVEPEER_VIDEOS.map((video, idx) => ({
        ...video,
        id: `vid-${idx}`,
        created_at: new Date(Date.now() - idx * 86400000).toISOString(),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
