// Fixr Agent Tasks API
export const dynamic = 'force-dynamic';
// Manage tasks queue

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addTask, updateTask } from '@/lib/memory';
import { Task, Chain } from '@/lib/types';

// Get all tasks
export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    // Create fresh client to avoid stale data
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false },
    });

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tasksList = tasks || [];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      version: 'v3',
      tasks: tasksList.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        chain: t.chain,
        status: t.status,
        plan: t.plan,
        result: t.result,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      stats: {
        total: tasksList.length,
        pending: tasksList.filter((t) => t.status === 'pending').length,
        planning: tasksList.filter((t) => t.status === 'planning').length,
        awaiting: tasksList.filter((t) => t.status === 'awaiting_approval').length,
        approved: tasksList.filter((t) => t.status === 'approved').length,
        executing: tasksList.filter((t) => t.status === 'executing').length,
        completed: tasksList.filter((t) => t.status === 'completed').length,
        failed: tasksList.filter((t) => t.status === 'failed').length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { title, description, chain } = body as {
      title: string;
      description: string;
      chain?: Chain;
    };

    if (!title || !description) {
      return NextResponse.json(
        { error: 'title and description required' },
        { status: 400 }
      );
    }

    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      chain,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addTask(task);

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// Update a task
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, ...updates } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId required' },
        { status: 400 }
      );
    }

    const task = await updateTask(taskId, updates);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
