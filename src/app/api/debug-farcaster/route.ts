// Debug endpoint to check Farcaster replies
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: false },
  });

  // Get recent farcaster replies
  const { data: replies, error } = await supabase
    .from('farcaster_replies')
    .select('id, author_username, text, parsed_type, parent_hash, thread_hash, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Separate by author
  const fixrPosts = replies?.filter(r => r.author_username === 'fixr') || [];
  const bankrPosts = replies?.filter(r => r.author_username === 'bankr') || [];
  const otherPosts = replies?.filter(r => !['fixr', 'bankr'].includes(r.author_username)) || [];

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary: {
      total: replies?.length || 0,
      fixr: fixrPosts.length,
      bankr: bankrPosts.length,
      other: otherPosts.length,
    },
    recentFixrPosts: fixrPosts.slice(0, 5).map(r => ({
      text: r.text?.slice(0, 100),
      type: r.parsed_type,
      createdAt: r.created_at,
    })),
    recentBankrPosts: bankrPosts.slice(0, 5).map(r => ({
      text: r.text?.slice(0, 100),
      parentHash: r.parent_hash?.slice(0, 10),
      createdAt: r.created_at,
    })),
    allReplies: replies?.map(r => ({
      id: r.id?.slice(0, 10),
      author: r.author_username,
      text: r.text?.slice(0, 80),
      type: r.parsed_type,
      parent: r.parent_hash?.slice(0, 10),
    })),
  });
}
