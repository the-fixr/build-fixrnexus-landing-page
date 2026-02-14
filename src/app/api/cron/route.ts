// Fixr Agent Cron Job
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Task } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

    // Filter for tasks that need planning (pending, no plan, no result)
    const tasksNeedingPlans: Task[] = (tasksData.tasks || [])
      .filter((t: Record<string, unknown>) => t.status === 'pending' && !t.plan && !t.result)
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

    if (tasksNeedingPlans.length === 0) {
      return NextResponse.json({
        success: true,
        version: 'v16-tasks',
        message: 'No tasks need planning',
        stats: { totalTasks: tasksData.tasks?.length || 0, tasksNeedingPlans: 0 },
      });
    }

    // Process the first task
    const task = tasksNeedingPlans[0];

    // Direct Supabase for updates - with fresh client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { db: { schema: 'public' }, auth: { persistSession: false } }
    );

    // CRITICAL: Double-check task status before planning to avoid re-processing
    // This prevents race conditions from stale data
    const { data: freshTask } = await supabase
      .from('tasks')
      .select('status, plan')
      .eq('id', task.id)
      .single();

    if (!freshTask || freshTask.status !== 'pending' || freshTask.plan) {
      return NextResponse.json({
        success: true,
        version: 'v15-skip',
        message: `Task ${task.id} already processed (status: ${freshTask?.status}, hasPlan: ${!!freshTask?.plan})`,
        taskId: task.id,
      });
    }

    await supabase
      .from('tasks')
      .update({ status: 'planning', updated_at: new Date().toISOString() })
      .eq('id', task.id);

    // Generate plan
    const { generatePlan } = await import('@/lib/planner');
    const planResult = await generatePlan(task);

    if (!planResult.success || !planResult.plan) {
      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          result: {
            success: false,
            outputs: [],
            error: planResult.error || 'Failed to generate plan',
            completedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      return NextResponse.json({
        success: false,
        version: 'v14-fetch',
        error: planResult.error,
        taskId: task.id,
      });
    }

    // Update task with plan
    const { data: updatedTaskData } = await supabase
      .from('tasks')
      .update({
        status: 'awaiting_approval',
        plan: planResult.plan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .select()
      .single();

    // Save approval request
    await supabase.from('approval_requests').insert({
      id: planResult.plan.id,
      plan_id: planResult.plan.id,
      task_id: task.id,
      sent_at: new Date().toISOString(),
      status: 'pending',
    });

    // Send email
    const { sendPlanApprovalEmail } = await import('@/lib/email');
    const updatedTask: Task = updatedTaskData ? {
      id: updatedTaskData.id,
      title: updatedTaskData.title,
      description: updatedTaskData.description,
      chain: updatedTaskData.chain,
      status: updatedTaskData.status,
      plan: updatedTaskData.plan,
      result: updatedTaskData.result,
      createdAt: updatedTaskData.created_at,
      updatedAt: updatedTaskData.updated_at,
    } : task;

    const emailResult = await sendPlanApprovalEmail(updatedTask, planResult.plan);

    return NextResponse.json({
      success: true,
      version: 'v14-fetch',
      message: 'Plan generated and sent for approval',
      taskId: task.id,
      planId: planResult.plan.id,
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { success: false, version: 'v14-fetch', error: String(error) },
      { status: 500 }
    );
  }
}
