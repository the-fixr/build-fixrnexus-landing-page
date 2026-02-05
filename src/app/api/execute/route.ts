// Fixr Agent Execution Endpoint
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Task } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 800;

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use /api/tasks which works correctly (other internal endpoints have db issues)
    const baseUrl = 'https://fixr-agent.vercel.app';
    const tasksRes = await fetch(`${baseUrl}/api/tasks?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    const tasksData = await tasksRes.json();

    if (tasksData.error || !tasksData.success) {
      return NextResponse.json({ success: false, error: tasksData.error || 'Failed to fetch tasks' });
    }

    // Filter for tasks ready for execution (approved or executing with plan)
    const approvedTasks: Task[] = (tasksData.tasks || [])
      .filter((t: Record<string, unknown>) =>
        (t.status === 'approved' || t.status === 'executing') && t.plan
      )
      .map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        description: row.description as string,
        chain: row.chain as Task['chain'],
        status: row.status as Task['status'],
        plan: row.plan as Task['plan'],
        result: row.result as Task['result'],
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
      }));

    if (approvedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tasks ready for execution',
      });
    }

    const task = approvedTasks[0];

    if (!task.plan) {
      return NextResponse.json({
        success: false,
        error: 'Task has no plan',
        taskId: task.id,
      });
    }

    console.log(`Executing task: ${task.title}`);

    // Import and execute
    const { executePlan } = await import('@/lib/executor');
    const result = await executePlan(task, task.plan);

    return NextResponse.json({
      success: result.success,
      taskId: task.id,
      outputs: result.outputs,
      error: result.error,
    });
  } catch (error) {
    console.error('Execution error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// Manual execution trigger
export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    // Fetch task directly from Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !taskData) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task: Task = {
      id: taskData.id,
      title: taskData.title,
      description: taskData.description,
      chain: taskData.chain,
      status: taskData.status,
      plan: taskData.plan,
      result: taskData.result,
      createdAt: taskData.created_at,
      updatedAt: taskData.updated_at,
    };

    if (!task.plan) {
      return NextResponse.json({ error: 'Task has no plan' }, { status: 400 });
    }

    // Allow both 'approved' (new execution) and 'executing' (resume)
    if (task.status !== 'approved' && task.status !== 'executing') {
      return NextResponse.json(
        { error: `Task status is ${task.status}, expected approved or executing` },
        { status: 400 }
      );
    }

    const { executePlan } = await import('@/lib/executor');
    const result = await executePlan(task, task.plan);

    return NextResponse.json({
      success: result.success,
      outputs: result.outputs,
      error: result.error,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
