// Fixr Agent Memory System
// Uses Supabase for persistent storage

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AgentMemory, Task, ApprovalRequest } from './types';

// Create Supabase client fresh each time to avoid stale connection issues
function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  console.log('getSupabase: URL prefix:', supabaseUrl?.slice(0, 40), 'key length:', supabaseKey?.length);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Default memory state
const DEFAULT_MEMORY: AgentMemory = {
  identity: {
    name: 'Fixr',
    tagline: "Fix'n shit. Debugging your mess since before it was cool.",
    email: 'fixr@fixr.nexus',
    socials: {
      x: '@Fixr21718',
      farcaster: '@fixr',
      website: 'https://fixr.nexus',
    },
  },
  goals: [
    'Build and deploy fixr.nexus landing page',
    'Ship a project on Ethereum mainnet',
    'Ship a project on Base',
    'Ship a project on Monad testnet',
    'Ship a project on Solana',
    'Grow social presence through visible work',
  ],
  tasks: [],
  completedProjects: [],
  wallets: {
    ethereum: '',
    solana: '',
  },
};

/**
 * Load full agent memory (identity, goals, etc.)
 */
export async function loadMemory(): Promise<AgentMemory> {
  try {
    console.log('loadMemory: Starting to load from Supabase');
    // Get all tasks
    const { data: tasks, error } = await getSupabase()
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('loadMemory: Tasks query result:', { count: tasks?.length, error: error?.message });

    if (error) throw error;

    // Get completed projects
    const { data: projects } = await getSupabase()
      .from('completed_projects')
      .select('*')
      .order('completed_at', { ascending: false });

    console.log('loadMemory: Returning', tasks?.length || 0, 'tasks');
    return {
      ...DEFAULT_MEMORY,
      tasks: (tasks || []).map(dbTaskToTask),
      completedProjects: projects || [],
    };
  } catch (error) {
    console.error('loadMemory: FAILED to load memory:', error);
    return DEFAULT_MEMORY;
  }
}

/**
 * Add a new task
 */
export async function addTask(task: Task): Promise<void> {
  const { error } = await getSupabase().from('tasks').insert({
    id: task.id,
    title: task.title,
    description: task.description,
    chain: task.chain,
    status: task.status,
    plan: task.plan,
    result: task.result,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  });

  if (error) throw error;
}

/**
 * Update an existing task
 */
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.chain !== undefined) updateData.chain = updates.chain;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.plan !== undefined) updateData.plan = updates.plan;
  if (updates.result !== undefined) updateData.result = updates.result;

  const { data, error } = await getSupabase()
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update task:', error);
    return null;
  }

  return dbTaskToTask(data);
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string): Promise<Task | null> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !data) return null;
  return dbTaskToTask(data);
}

/**
 * Get tasks that are pending or approved (ready for work)
 */
export async function getPendingTasks(): Promise<Task[]> {
  console.log('getPendingTasks: Starting query');
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: true });

  console.log('getPendingTasks: Result:', { count: data?.length, error: error?.message });
  if (error) {
    console.error('getPendingTasks: ERROR:', error);
    return [];
  }
  return (data || []).map(dbTaskToTask);
}

/**
 * Get tasks awaiting approval
 */
export async function getAwaitingApprovalTasks(): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []).map(dbTaskToTask);
}

/**
 * Save an approval request
 */
export async function saveApprovalRequest(request: ApprovalRequest): Promise<void> {
  const { error } = await getSupabase().from('approval_requests').insert({
    id: request.id,
    plan_id: request.planId,
    task_id: request.taskId,
    sent_at: request.sentAt,
    status: request.status,
  });

  if (error) throw error;
}

/**
 * Get an approval request by ID
 */
export async function getApprovalRequest(id: string): Promise<ApprovalRequest | null> {
  const { data, error } = await getSupabase()
    .from('approval_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    planId: data.plan_id,
    taskId: data.task_id,
    sentAt: data.sent_at,
    status: data.status,
    respondedAt: data.responded_at,
  };
}

/**
 * Update an approval request status
 */
export async function updateApprovalRequest(
  id: string,
  status: 'approved' | 'rejected'
): Promise<ApprovalRequest | null> {
  const { data, error } = await getSupabase()
    .from('approval_requests')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    planId: data.plan_id,
    taskId: data.task_id,
    sentAt: data.sent_at,
    status: data.status,
    respondedAt: data.responded_at,
  };
}

/**
 * Mark all approval requests for a task as executed
 */
export async function markApprovalRequestsExecuted(taskId: string): Promise<void> {
  await getSupabase()
    .from('approval_requests')
    .update({
      status: 'executed',
      responded_at: new Date().toISOString(),
    })
    .eq('task_id', taskId);
}

/**
 * Add a completed project
 */
export async function addCompletedProject(project: {
  id: string;
  name: string;
  description: string;
  chain: string;
  urls: Record<string, string>;
}): Promise<void> {
  const { error } = await getSupabase().from('completed_projects').insert({
    id: project.id,
    name: project.name,
    description: project.description,
    chain: project.chain,
    urls: project.urls,
    completed_at: new Date().toISOString(),
  });

  if (error) throw error;
}

// Helper to convert DB row to Task type
function dbTaskToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    chain: row.chain as Task['chain'],
    status: row.status as Task['status'],
    plan: row.plan as Task['plan'],
    result: row.result as Task['result'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
