// Debug endpoint to check database connection and create tasks
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase credentials');
  return createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: false },
  });
}

// POST: Create a new task
export async function POST(request: Request) {
  try {
    const { title, description, chain } = await request.json();
    if (!title || !description) {
      return NextResponse.json({ error: 'title and description required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .insert({ id: taskId, title, description, chain: chain || null, status: 'pending', created_at: now, updated_at: now })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, task: data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      error: 'Missing Supabase credentials',
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    });

    // Get all tasks
    const { data: allTasks, error: allError } = await supabase
      .from('tasks')
      .select('id, title, status')
      .order('created_at', { ascending: false });

    // Get pending tasks
    const { data: pendingTasks, error: pendingError } = await supabase
      .from('tasks')
      .select('id, title, status')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: true });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      version: 'v2',
      supabaseUrl: supabaseUrl.slice(0, 30) + '...',
      allTasks: {
        count: allTasks?.length || 0,
        data: allTasks,
        error: allError?.message,
      },
      pendingTasks: {
        count: pendingTasks?.length || 0,
        data: pendingTasks,
        error: pendingError?.message,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    });
  }
}
