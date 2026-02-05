// Fixr Agent Status Endpoint
export const dynamic = 'force-dynamic';
// Returns current agent state and health

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Agent identity (static)
const AGENT_IDENTITY = {
  name: 'Fixr',
  tagline: "Fix'n shit. Debugging your mess since before it was cool.",
  email: 'fixr@fixr.nexus',
  socials: {
    x: '@Fixr21718',
    farcaster: '@fixr',
    website: 'https://fixr.nexus',
  },
};

const GOALS = [
  'Build and deploy fixr.nexus landing page',
  'Ship a project on Ethereum mainnet',
  'Ship a project on Base',
  'Ship a project on Monad testnet',
  'Ship a project on Solana',
  'Grow social presence through visible work',
];

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

    // Get all tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, status, updated_at')
      .order('updated_at', { ascending: false });

    if (tasksError) {
      console.error('Status API tasks error:', tasksError);
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Get completed projects
    const { data: projects } = await supabase
      .from('completed_projects')
      .select('id')
      .order('completed_at', { ascending: false });

    const tasksList = tasks || [];

    const tasksByStatus = tasksList.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      agent: {
        name: AGENT_IDENTITY.name,
        tagline: AGENT_IDENTITY.tagline,
        socials: AGENT_IDENTITY.socials,
      },
      stats: {
        totalTasks: tasksList.length,
        tasksByStatus,
        completedProjects: projects?.length || 0,
        goalsRemaining: GOALS.length,
      },
      recentTasks: tasksList.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        updatedAt: t.updated_at,
      })),
      goals: GOALS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
