// Internal endpoint to get/create pending tasks
// Called by cron to work around Supabase connection issues
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

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
      return NextResponse.json(
        { error: 'title and description are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        id: taskId,
        title,
        description,
        chain: chain || null,
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      task: data,
      message: 'Task created. Fixr will generate a plan and email for approval.',
    });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: List pending tasks
export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;

  try {
    const supabase = getSupabase();

    // Get ALL tasks first (workaround for Supabase JSONB/null filter issues)
    const { data: allTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    // Filter in JavaScript for tasks that need planning:
    // - status is 'pending' (not yet planned)
    // - no plan yet
    // - no result yet
    const tasksNeedingPlanning = (allTasks || []).filter(
      (t) => t.status === 'pending' && t.plan === null && t.result === null
    );

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    // Also check for tasks that already have pending approval requests
    // to avoid re-sending emails
    const taskIds = (tasksNeedingPlanning || []).map((t: { id: string }) => t.id);

    let tasksWithPendingApprovals: string[] = [];
    if (taskIds.length > 0) {
      const { data: pendingApprovals } = await supabase
        .from('approval_requests')
        .select('task_id')
        .in('task_id', taskIds)
        .eq('status', 'pending');

      tasksWithPendingApprovals = (pendingApprovals || []).map((a: { task_id: string }) => a.task_id);
    }

    // Filter out tasks that already have pending approval requests
    const preFilteredTasks = (tasksNeedingPlanning || []).filter(
      (t: { id: string }) => !tasksWithPendingApprovals.includes(t.id)
    );

    // CRITICAL: Verify each task is actually still pending (Supabase caching workaround)
    // The eq('status', 'pending') query sometimes returns stale results
    const verifiedTasks: typeof preFilteredTasks = [];
    for (const task of preFilteredTasks) {
      const { data: freshTask } = await supabase
        .from('tasks')
        .select('id, status, plan')
        .eq('id', task.id)
        .single();

      if (freshTask && freshTask.status === 'pending' && !freshTask.plan) {
        verifiedTasks.push(task);
      }
    }

    return NextResponse.json({
      version: 'v9-with-post',
      timestamp: new Date().toISOString(),
      allCount: verifiedTasks.length,
      tasks: verifiedTasks,
      debug: {
        supabaseUrl: supabaseUrl?.slice(0, 40) + '...',
        totalTasks: allTasks?.length || 0,
        allTasksStatuses: (allTasks || []).map(t => ({ id: t.id.slice(-10), status: t.status, plan: t.plan !== null, result: t.result !== null })),
        tasksNeedingPlanning: tasksNeedingPlanning?.length || 0,
        withPendingApprovals: tasksWithPendingApprovals.length,
        preFilterCount: preFilteredTasks.length,
        verifiedCount: verifiedTasks.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
