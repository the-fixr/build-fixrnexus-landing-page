// Fixr Agent - Create Task API
// Used to create new tasks for Fixr to plan and execute

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { title, description, chain } = await request.json();

    if (!title || !description) {
      return NextResponse.json(
        { error: 'title and description are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { db: { schema: 'public' }, auth: { persistSession: false } }
    );

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
