/**
 * Skill Registry — Phase 2 of Fixr Self-Improvement System
 *
 * Manages a formal registry of all agent capabilities.
 * Tracks per-skill metrics, confidence scores, and lessons learned.
 * Generates adaptive prompt context for Claude calls.
 */

import { OutcomeEnv, OutcomeRecord, getSkillStats } from './outcomes';

// ============ Types ============

export interface Skill {
  id: string;
  category: string;
  display_name: string;
  description: string | null;
  total_uses: number;
  successes: number;
  failures: number;
  avg_duration_ms: number;
  common_errors: SkillError[];
  lessons: SkillLesson[];
  confidence: number;
  last_used: string | null;
  updated_at: string;
}

export interface SkillError {
  errorClass: string;
  count: number;
  lastSeen: string;
}

export interface SkillLesson {
  lesson: string;
  source: string;
  learnedAt: string;
}

// Bayesian prior weight — takes ~20 observations to fully converge
const PRIOR_WEIGHT = 10;

// ============ Registry Functions ============

/**
 * Get a single skill from the registry
 */
export async function getSkill(env: OutcomeEnv, skillId: string): Promise<Skill | null> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/skill_registry?id=eq.${encodeURIComponent(skillId)}&limit=1`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) return null;
    const rows = await response.json() as Skill[];
    return rows[0] || null;
  } catch (error) {
    console.error('[Skills] Error fetching skill:', error);
    return null;
  }
}

/**
 * Get all skills from the registry
 */
export async function getAllSkills(env: OutcomeEnv): Promise<Skill[]> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/skill_registry?order=category,display_name`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) return [];
    return await response.json() as Skill[];
  } catch (error) {
    console.error('[Skills] Error fetching all skills:', error);
    return [];
  }
}

/**
 * Update a skill's counters and confidence from outcome_ledger data
 */
export async function refreshSkillFromOutcomes(env: OutcomeEnv, skillId: string): Promise<void> {
  try {
    const stats = await getSkillStats(env, skillId, 90); // Last 90 days

    if (stats.total === 0) return; // No data, nothing to update

    // Bayesian confidence: converges toward actual success rate
    const confidence = (PRIOR_WEIGHT * 0.5 + stats.succeeded) / (PRIOR_WEIGHT + stats.total);

    // Build common errors array
    const commonErrors: SkillError[] = stats.commonErrors.slice(0, 5).map(e => ({
      errorClass: e.errorClass,
      count: e.count,
      lastSeen: new Date().toISOString(),
    }));

    await fetch(
      `${env.SUPABASE_URL}/rest/v1/skill_registry?id=eq.${encodeURIComponent(skillId)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          total_uses: stats.total,
          successes: stats.succeeded,
          failures: stats.failed,
          avg_duration_ms: stats.avgDuration,
          common_errors: commonErrors,
          confidence: Math.round(confidence * 1000) / 1000, // 3 decimal places
          last_used: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      }
    );
  } catch (error) {
    console.error(`[Skills] Error refreshing skill ${skillId}:`, error);
  }
}

/**
 * Refresh all skills from outcome_ledger data
 * Called by cron every 6 hours
 */
export async function refreshAllSkills(env: OutcomeEnv): Promise<{ refreshed: number; errors: number }> {
  const skills = await getAllSkills(env);
  let refreshed = 0;
  let errors = 0;

  for (const skill of skills) {
    try {
      await refreshSkillFromOutcomes(env, skill.id);
      refreshed++;
    } catch {
      errors++;
    }
  }

  console.log(`[Skills] Refreshed ${refreshed} skills, ${errors} errors`);
  return { refreshed, errors };
}

/**
 * Add a lesson to a skill
 */
export async function addLesson(
  env: OutcomeEnv,
  skillId: string,
  lesson: string,
  source: string = 'manual'
): Promise<boolean> {
  try {
    const skill = await getSkill(env, skillId);
    if (!skill) return false;

    const lessons = skill.lessons || [];

    // Don't add duplicate lessons
    if (lessons.some(l => l.lesson === lesson)) return true;

    // Keep max 10 lessons per skill
    lessons.push({ lesson, source, learnedAt: new Date().toISOString() });
    if (lessons.length > 10) {
      lessons.shift(); // Remove oldest
    }

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/skill_registry?id=eq.${encodeURIComponent(skillId)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          lessons,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`[Skills] Error adding lesson to ${skillId}:`, error);
    return false;
  }
}

// ============ Adaptive Prompt Context ============

/**
 * Generate prompt context string for a specific skill.
 * Includes success rate, recent failures, and lessons learned.
 */
export async function getSkillContext(env: OutcomeEnv, skillId: string): Promise<string> {
  const skill = await getSkill(env, skillId);
  if (!skill || skill.total_uses === 0) return '';

  const successPct = Math.round((skill.successes / skill.total_uses) * 100);
  let context = `### ${skill.display_name} (confidence: ${skill.confidence.toFixed(2)}, ${skill.successes}/${skill.total_uses} succeeded, ${successPct}%)`;

  // Add lessons
  if (skill.lessons && skill.lessons.length > 0) {
    for (const lesson of skill.lessons.slice(-5)) { // Last 5 lessons
      context += `\n- Lesson: "${lesson.lesson}"`;
    }
  }

  // Add common errors
  if (skill.common_errors && skill.common_errors.length > 0) {
    const topError = skill.common_errors[0];
    context += `\n- Most common failure: ${topError.errorClass} (${topError.count} times)`;
  }

  return context;
}

/**
 * Generate full adaptive context for multiple skills.
 * Used to inject into planner and conversation prompts.
 */
export async function getAdaptiveContext(
  env: OutcomeEnv,
  relevantSkillIds?: string[]
): Promise<string> {
  const skills = relevantSkillIds
    ? await Promise.all(relevantSkillIds.map(id => getSkill(env, id)))
    : await getAllSkills(env);

  const activeSkills = (skills.filter(Boolean) as Skill[])
    .filter(s => s.total_uses > 0)
    .sort((a, b) => b.total_uses - a.total_uses);

  if (activeSkills.length === 0) return '';

  let context = '## Lessons from Past Experience\n';

  for (const skill of activeSkills.slice(0, 8)) { // Top 8 most-used skills
    const skillContext = await getSkillContext(env, skill.id);
    if (skillContext) {
      context += '\n' + skillContext + '\n';
    }
  }

  return context;
}

/**
 * Identify which skills are relevant for a given task description.
 * Returns skill IDs that likely apply.
 */
export function identifyRelevantSkills(taskDescription: string): string[] {
  const desc = taskDescription.toLowerCase();
  const skills: string[] = [];

  // Always include task execution
  skills.push('task_execution');

  // Code skills
  if (desc.includes('code') || desc.includes('build') || desc.includes('create') || desc.includes('implement')) {
    skills.push('code_generation');
  }
  if (desc.includes('solana') || desc.includes('anchor') || desc.includes('program')) {
    skills.push('code_generation');
  }
  if (desc.includes('contract') || desc.includes('solidity') || desc.includes('evm')) {
    skills.push('contract_deploy');
  }

  // Deploy skills
  if (desc.includes('deploy') || desc.includes('vercel') || desc.includes('ship')) {
    skills.push('vercel_deploy');
  }
  if (desc.includes('github') || desc.includes('push') || desc.includes('repo')) {
    skills.push('github_push');
  }

  // Social skills
  if (desc.includes('post') || desc.includes('announce') || desc.includes('share')) {
    skills.push('farcaster_post', 'x_post');
  }

  // Analysis skills
  if (desc.includes('token') || desc.includes('scan') || desc.includes('analysis')) {
    skills.push('token_analysis');
  }
  if (desc.includes('audit') || desc.includes('security')) {
    skills.push('contract_audit');
  }

  // Trading
  if (desc.includes('trade') || desc.includes('market') || desc.includes('bankr')) {
    skills.push('trading_decision');
  }

  // Media
  if (desc.includes('image') || desc.includes('generate') || desc.includes('visual')) {
    skills.push('image_generation');
  }

  // Deduplicate
  return [...new Set(skills)];
}

/**
 * Get a compact summary of all skill performance for dashboard display
 */
export async function getSkillSummary(env: OutcomeEnv): Promise<{
  totalSkills: number;
  activeSkills: number;
  avgConfidence: number;
  topSkills: { id: string; name: string; confidence: number; uses: number }[];
  weakestSkills: { id: string; name: string; confidence: number; uses: number }[];
}> {
  const skills = await getAllSkills(env);
  const active = skills.filter(s => s.total_uses > 0);

  const avgConfidence = active.length > 0
    ? active.reduce((sum, s) => sum + s.confidence, 0) / active.length
    : 0.5;

  const sorted = [...active].sort((a, b) => b.confidence - a.confidence);

  return {
    totalSkills: skills.length,
    activeSkills: active.length,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    topSkills: sorted.slice(0, 5).map(s => ({
      id: s.id,
      name: s.display_name,
      confidence: s.confidence,
      uses: s.total_uses,
    })),
    weakestSkills: sorted.slice(-3).reverse().map(s => ({
      id: s.id,
      name: s.display_name,
      confidence: s.confidence,
      uses: s.total_uses,
    })),
  };
}
