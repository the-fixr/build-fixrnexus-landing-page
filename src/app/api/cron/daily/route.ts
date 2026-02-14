// Fixr Agent Daily Check-in with @bankr
// Runs once daily to get market updates and make investment decisions
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { postToFarcaster } from '@/lib/social';

export const runtime = 'nodejs';
export const maxDuration = 300;

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = ReturnType<typeof createClient<any>>;

// Generate a thoughtful check-in message based on context
async function generateDailyMessage(supabase: SupabaseClientAny): Promise<string> {
  // Get recent completed tasks to understand what Fixr has been working on
  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('title, result, updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(5);

  // Get any previous investment data from farcaster_replies
  const { data: recentReplies } = await supabase
    .from('farcaster_replies')
    .select('text, author_username, created_at')
    .eq('author_username', 'bankr')
    .order('created_at', { ascending: false })
    .limit(3);

  // Variety of conversational check-in messages
  const checkInTemplates = [
    "gm @bankr - what's the vibe on Base today? anything interesting moving?",
    "yo @bankr checking in - how's the market looking? any alpha to share?",
    "hey @bankr what's good today? seeing any opportunities worth exploring?",
    "@bankr gm - what tokens are people talking about on Base rn?",
    "morning @bankr - anything heating up today I should know about?",
    "@bankr what's the sentiment like today? bullish or taking it easy?",
    "gm @bankr - any notable moves on Base? thinking about my next play",
    "hey @bankr what's trending today? looking for some ideas",
  ];

  // Pick a random template
  const baseMessage = checkInTemplates[Math.floor(Math.random() * checkInTemplates.length)];

  // Sometimes add context about recent activity
  const addContext = Math.random() > 0.5;
  if (addContext && recentTasks && recentTasks.length > 0) {
    const contextAdditions = [
      " been building lately, might have some dry powder to deploy",
      " shipped some stuff recently, time to think about investments",
      " curious what you're seeing out there",
    ];
    return baseMessage + contextAdditions[Math.floor(Math.random() * contextAdditions.length)];
  }

  return baseMessage;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { db: { schema: 'public' }, auth: { persistSession: false } }
    );

    // Check if we already posted a daily check-in today (within last 20 hours)
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    const { data: recentDailyPosts } = await supabase
      .from('farcaster_replies')
      .select('id, text')
      .eq('author_username', 'fixr')
      .eq('parsed_type', 'daily_checkin')
      .gte('created_at', twentyHoursAgo)
      .limit(1);

    if (recentDailyPosts && recentDailyPosts.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Already posted daily check-in today, skipping',
        skipped: true,
        lastPost: recentDailyPosts[0].text,
      });
    }

    // Generate the daily check-in message
    const message = await generateDailyMessage(supabase);

    // Post to Farcaster
    const result = await postToFarcaster(message);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    // Log this interaction
    await supabase.from('farcaster_replies').insert({
      id: result.postId || `fixr_daily_${Date.now()}`,
      parent_hash: 'none',
      thread_hash: result.threadHash || result.postId || `fixr_daily_${Date.now()}`,
      author_fid: 0, // Fixr's FID - would need actual value
      author_username: 'fixr',
      author_display_name: 'Fixr',
      text: message,
      parsed_type: 'daily_checkin',
      parsed_data: { type: 'daily_bankr_checkin' },
      processed: false,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Daily check-in posted to @bankr',
      postId: result.postId,
      url: result.url,
      content: message,
    });
  } catch (error) {
    console.error('Daily cron error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
