// Internal endpoint to get approved tasks ready for execution
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
  }

  // Create fresh client each time to avoid connection pooling issues
  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: false },
  });

  // Debug: get ALL tasks first to see what we're working with
  const { data: allTasksRaw, error: allError } = await supabase
    .from('tasks')
    .select('id, status, plan')
    .order('created_at', { ascending: true });

  // Get approved tasks with plans, OR executing tasks that need resumption
  // Note: Removed .not('plan', 'is', null) filter - checking plan in JS instead
  const { data: approvedTasksRaw, error: approvedError } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  // Filter for tasks that have a plan (workaround for Supabase JSONB filter issue)
  const approvedTasks = (approvedTasksRaw || []).filter(t => t.plan !== null);

  // Also get tasks that are "executing" but may have timed out (need resume)
  // These have executionProgress but haven't completed
  const { data: executingTasksRaw, error: executingError } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'executing')
    .order('created_at', { ascending: true });

  // Filter for tasks that have a plan (workaround for Supabase JSONB filter issue)
  const executingTasks = (executingTasksRaw || []).filter(t => t.plan !== null);

  // Combine approved + stalled executing tasks
  const allTasks = [...(approvedTasks || []), ...(executingTasks || [])];

  return NextResponse.json({
    version: 'v4-debug',
    timestamp: new Date().toISOString(),
    tasks: allTasks,
    debug: {
      approved: approvedTasks?.length || 0,
      executing: executingTasks?.length || 0,
      allTasksCount: allTasksRaw?.length || 0,
      allTasksStatuses: allTasksRaw?.map(t => ({ id: t.id.slice(-8), status: t.status, hasPlan: t.plan !== null })) || [],
      errors: {
        all: allError ? String(allError) : null,
        approved: approvedError ? String(approvedError) : null,
        executing: executingError ? String(executingError) : null,
      },
    },
  });
}
