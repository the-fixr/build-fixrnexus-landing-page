/**
 * Outcome Ledger — Phase 1 of Fixr Self-Improvement System
 *
 * Records structured outcomes for every agent action.
 * Classifies errors into a taxonomy for pattern detection.
 * Provides skill-level and aggregate statistics.
 */

import { Env } from './types';

// Minimal env interface for modules with their own Env definition (e.g., bankrTrade.ts)
export interface OutcomeEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

// ============ Types ============

export type ActionType = 'task' | 'post' | 'trade' | 'pr' | 'proposal' | 'deploy' | 'cron' | 'analysis';

export type ErrorClass =
  | 'network'
  | 'auth'
  | 'rate_limit'
  | 'logic'
  | 'external_service'
  | 'timeout'
  | 'validation';

export interface OutcomeRecord {
  id?: string;
  action_type: ActionType;
  action_id?: string;
  skill: string;
  success: boolean;
  error_class?: ErrorClass;
  error_message?: string;
  context?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
  duration_ms?: number;
  retry_count?: number;
  created_at?: string;
}

export interface ErrorClassification {
  errorClass: ErrorClass;
  errorMessage: string;
  isRetryable: boolean;
  suggestedDelay?: number;
}

export interface SkillStats {
  skill: string;
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  commonErrors: { errorClass: ErrorClass; count: number }[];
  avgDuration: number;
}

export interface OutcomeSummary {
  totalActions: number;
  successRate: number;
  bySkill: Record<string, SkillStats>;
  byErrorClass: Record<string, number>;
  topFailures: OutcomeRecord[];
}

// ============ Error Classification ============

/**
 * Classify an error into a taxonomy with retry guidance
 */
export function classifyError(error: unknown): ErrorClassification {
  const msg = String(error).toLowerCase();
  const fullMsg = String(error);

  if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('dns')) {
    return { errorClass: 'network', errorMessage: fullMsg, isRetryable: true, suggestedDelay: 5000 };
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden')) {
    return { errorClass: 'auth', errorMessage: fullMsg, isRetryable: false };
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return { errorClass: 'rate_limit', errorMessage: fullMsg, isRetryable: true, suggestedDelay: 60000 };
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline exceeded') || msg.includes('aborted')) {
    return { errorClass: 'timeout', errorMessage: fullMsg, isRetryable: true, suggestedDelay: 10000 };
  }
  if (msg.includes('invalid') || msg.includes('validation') || msg.includes('parse') || msg.includes('syntax') || msg.includes('type error')) {
    return { errorClass: 'validation', errorMessage: fullMsg, isRetryable: false };
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('service unavailable')) {
    return { errorClass: 'external_service', errorMessage: fullMsg, isRetryable: true, suggestedDelay: 15000 };
  }

  return { errorClass: 'logic', errorMessage: fullMsg, isRetryable: false };
}

// ============ Outcome Recording ============

/**
 * Record an action outcome to the outcome_ledger table
 */
export async function recordOutcome(
  env: OutcomeEnv,
  record: Omit<OutcomeRecord, 'id' | 'created_at'>
): Promise<void> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/outcome_ledger`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        action_type: record.action_type,
        action_id: record.action_id || null,
        skill: record.skill,
        success: record.success,
        error_class: record.error_class || null,
        error_message: record.error_message || null,
        context: record.context || {},
        outcome: record.outcome || {},
        duration_ms: record.duration_ms || null,
        retry_count: record.retry_count || 0,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Outcomes] Failed to record outcome:', response.status, text);
    }
  } catch (error) {
    // Never let outcome recording break the main flow
    console.error('[Outcomes] Error recording outcome:', error);
  }
}

// ============ Querying ============

/**
 * Get stats for a specific skill over a time period
 */
export async function getSkillStats(
  env: OutcomeEnv,
  skill: string,
  days: number = 30
): Promise<SkillStats> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/outcome_ledger?skill=eq.${encodeURIComponent(skill)}&created_at=gte.${since}&select=success,error_class,duration_ms`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return { skill, total: 0, succeeded: 0, failed: 0, successRate: 0, commonErrors: [], avgDuration: 0 };
    }

    const rows = await response.json() as Array<{
      success: boolean;
      error_class: ErrorClass | null;
      duration_ms: number | null;
    }>;

    const total = rows.length;
    const succeeded = rows.filter(r => r.success).length;
    const failed = total - succeeded;
    const successRate = total > 0 ? succeeded / total : 0;

    // Count errors by class
    const errorCounts: Record<string, number> = {};
    for (const row of rows) {
      if (row.error_class) {
        errorCounts[row.error_class] = (errorCounts[row.error_class] || 0) + 1;
      }
    }
    const commonErrors = Object.entries(errorCounts)
      .map(([errorClass, count]) => ({ errorClass: errorClass as ErrorClass, count }))
      .sort((a, b) => b.count - a.count);

    // Average duration
    const durations = rows.filter(r => r.duration_ms != null).map(r => r.duration_ms!);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    return { skill, total, succeeded, failed, successRate, commonErrors, avgDuration };
  } catch (error) {
    console.error('[Outcomes] Error getting skill stats:', error);
    return { skill, total: 0, succeeded: 0, failed: 0, successRate: 0, commonErrors: [], avgDuration: 0 };
  }
}

/**
 * Get recent failures, optionally filtered by skill
 */
export async function getRecentFailures(
  env: OutcomeEnv,
  skill?: string,
  limit: number = 20
): Promise<OutcomeRecord[]> {
  try {
    let url = `${env.SUPABASE_URL}/rest/v1/outcome_ledger?success=eq.false&order=created_at.desc&limit=${limit}`;
    if (skill) {
      url += `&skill=eq.${encodeURIComponent(skill)}`;
    }

    const response = await fetch(url, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!response.ok) return [];
    return await response.json() as OutcomeRecord[];
  } catch (error) {
    console.error('[Outcomes] Error getting recent failures:', error);
    return [];
  }
}

/**
 * Get a full outcome summary across all skills
 */
export async function getOutcomeSummary(
  env: OutcomeEnv,
  days: number = 7
): Promise<OutcomeSummary> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/outcome_ledger?created_at=gte.${since}&select=skill,success,error_class,duration_ms,error_message,action_type,action_id,context&order=created_at.desc&limit=1000`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return { totalActions: 0, successRate: 0, bySkill: {}, byErrorClass: {}, topFailures: [] };
    }

    const rows = await response.json() as OutcomeRecord[];
    const totalActions = rows.length;
    const succeeded = rows.filter(r => r.success).length;
    const successRate = totalActions > 0 ? succeeded / totalActions : 0;

    // Group by skill
    const bySkill: Record<string, SkillStats> = {};
    for (const row of rows) {
      if (!bySkill[row.skill]) {
        bySkill[row.skill] = {
          skill: row.skill,
          total: 0,
          succeeded: 0,
          failed: 0,
          successRate: 0,
          commonErrors: [],
          avgDuration: 0,
        };
      }
      const s = bySkill[row.skill];
      s.total++;
      if (row.success) s.succeeded++;
      else s.failed++;
    }
    // Calculate success rates
    for (const s of Object.values(bySkill)) {
      s.successRate = s.total > 0 ? s.succeeded / s.total : 0;
    }

    // Group errors by class
    const byErrorClass: Record<string, number> = {};
    for (const row of rows) {
      if (row.error_class) {
        byErrorClass[row.error_class] = (byErrorClass[row.error_class] || 0) + 1;
      }
    }

    // Top failures (most recent unique failures)
    const topFailures = rows
      .filter(r => !r.success)
      .slice(0, 10);

    return { totalActions, successRate, bySkill, byErrorClass, topFailures };
  } catch (error) {
    console.error('[Outcomes] Error getting outcome summary:', error);
    return { totalActions: 0, successRate: 0, bySkill: {}, byErrorClass: {}, topFailures: [] };
  }
}

// ============ Helpers ============

/**
 * Map a plan step action to a skill name
 */
export function mapStepToSkill(action: string, details?: Record<string, unknown>): string {
  switch (action) {
    case 'code':
      if (details?.targetRepo) return 'github_push';
      return 'code_generation';
    case 'deploy':
      return (details?.platform as string) || 'vercel_deploy';
    case 'contract':
      return 'contract_deploy';
    case 'post':
      return 'social_post';
    default:
      return action;
  }
}

/**
 * Wrap an async operation with automatic outcome recording
 */
export async function withOutcomeTracking<T>(
  env: OutcomeEnv,
  meta: {
    actionType: ActionType;
    actionId?: string;
    skill: string;
    context?: Record<string, unknown>;
  },
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await recordOutcome(env, {
      action_type: meta.actionType,
      action_id: meta.actionId,
      skill: meta.skill,
      success: true,
      context: meta.context,
      outcome: typeof result === 'object' && result !== null ? result as Record<string, unknown> : { value: result },
      duration_ms: Date.now() - start,
    });
    return result;
  } catch (error) {
    const classification = classifyError(error);
    await recordOutcome(env, {
      action_type: meta.actionType,
      action_id: meta.actionId,
      skill: meta.skill,
      success: false,
      error_class: classification.errorClass,
      error_message: classification.errorMessage.slice(0, 2000),
      context: meta.context,
      duration_ms: Date.now() - start,
    });
    throw error;
  }
}
