// Fixr Agent Memory System
// Uses Supabase for persistent storage

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AgentMemory, Task, ApprovalRequest, Env } from './types';

// Create Supabase client for Workers
function getSupabase(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
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
export async function loadMemory(env: Env): Promise<AgentMemory> {
  try {
    const supabase = getSupabase(env);

    // Get all tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get completed projects
    const { data: projects } = await supabase
      .from('completed_projects')
      .select('*')
      .order('completed_at', { ascending: false });

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
export async function addTask(env: Env, task: Task): Promise<void> {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('tasks').insert({
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
export async function updateTask(env: Env, taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const supabase = getSupabase(env);
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.chain !== undefined) updateData.chain = updates.chain;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.plan !== undefined) updateData.plan = updates.plan;
  if (updates.result !== undefined) updateData.result = updates.result;

  const { data, error } = await supabase
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
export async function getTask(env: Env, taskId: string): Promise<Task | null> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !data) return null;
  return dbTaskToTask(data);
}

/**
 * Get all tasks
 */
export async function getAllTasks(env: Env): Promise<Task[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []).map(dbTaskToTask);
}

/**
 * Get tasks that are pending or approved (ready for work)
 */
export async function getPendingTasks(env: Env): Promise<Task[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getPendingTasks: ERROR:', error);
    return [];
  }
  return (data || []).map(dbTaskToTask);
}

/**
 * Get tasks awaiting approval
 */
export async function getAwaitingApprovalTasks(env: Env): Promise<Task[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []).map(dbTaskToTask);
}

/**
 * Get approved or executing tasks
 */
export async function getApprovedTasks(env: Env): Promise<Task[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['approved', 'executing'])
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []).map(dbTaskToTask);
}

/**
 * Save an approval request
 */
export async function saveApprovalRequest(env: Env, request: ApprovalRequest): Promise<void> {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('approval_requests').insert({
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
export async function getApprovalRequest(env: Env, id: string): Promise<ApprovalRequest | null> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
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
  env: Env,
  id: string,
  status: 'approved' | 'rejected'
): Promise<ApprovalRequest | null> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
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
export async function markApprovalRequestsExecuted(env: Env, taskId: string): Promise<void> {
  const supabase = getSupabase(env);
  await supabase
    .from('approval_requests')
    .update({
      status: 'executed',
      responded_at: new Date().toISOString(),
    })
    .eq('task_id', taskId);
}

/**
 * Check for pending approval requests for a task
 */
export async function hasPendingApprovalRequest(env: Env, taskId: string): Promise<boolean> {
  const supabase = getSupabase(env);
  const { data } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('task_id', taskId)
    .eq('status', 'pending')
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Add a completed project
 */
export async function addCompletedProject(env: Env, project: {
  id: string;
  name: string;
  description: string;
  chain: string;
  urls: Record<string, string>;
}): Promise<void> {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('completed_projects').insert({
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
