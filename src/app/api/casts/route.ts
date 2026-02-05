// Fixr Cast Feed Endpoint
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    });

    // Get Fixr's recent casts from cast analytics
    const { data: casts, error } = await supabase
      .from('fixr_cast_analytics')
      .select('hash, text, cast_type, posted_at, likes, recasts, replies, channel_id')
      .order('posted_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Casts API error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      casts: (casts || []).map((cast) => ({
        hash: cast.hash,
        text: cast.text,
        type: cast.cast_type,
        postedAt: cast.posted_at,
        likes: cast.likes || 0,
        recasts: cast.recasts || 0,
        replies: cast.replies || 0,
        channel: cast.channel_id,
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
