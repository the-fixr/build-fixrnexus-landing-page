/**
 * Self-Modification Protocol — Phase 3 of Fixr Self-Improvement System
 *
 * Safe protocol for Fixr to modify its own code.
 * Safety tiers: safe (auto-apply), moderate (4h grace), risky (requires approval).
 * All changes tracked with rollback capability.
 */

import { Env } from './types';
import { pushFiles } from './github';
import { loadConfig } from './config';

// ============ Types ============

export interface SelfModProposal {
  source?: 'learning_engine' | 'manual' | 'error_recovery';
  target_file: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  safety_level: 'safe' | 'moderate' | 'risky';
  change_type: 'config' | 'prompt' | 'logic' | 'new_file' | 'lesson';
  proposed_change: {
    searchReplace?: Array<{ search: string; replace: string }>;
    newContent?: string;
    lesson?: { skillId: string; text: string };
  };
}

export interface SelfModification extends SelfModProposal {
  id: string;
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'rolled_back';
  applied_at?: string;
  commit_sha?: string;
  rollback_sha?: string;
  created_at: string;
}

// Constants
const FIXR_REPO_OWNER = 'the-fixr';
const FIXR_REPO_NAME = 'fixr-agent';
const DEFAULT_BLOCKED_FILES = ['src/index.ts'];

// ============ Queue & Query ============

/**
 * Queue a self-modification proposal
 */
export async function queueSelfModification(
  env: Env,
  proposal: SelfModProposal
): Promise<boolean> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/self_modifications`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        source: proposal.source || 'learning_engine',
        target_file: proposal.target_file,
        description: proposal.description,
        priority: proposal.priority,
        safety_level: proposal.safety_level,
        change_type: proposal.change_type,
        proposed_change: proposal.proposed_change,
        status: 'pending',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[SelfMod] Error queuing modification:', error);
    return false;
  }
}

/**
 * Get self-modifications, optionally filtered by status
 */
export async function getSelfModifications(
  env: Env,
  status?: string
): Promise<SelfModification[]> {
  try {
    let url = `${env.SUPABASE_URL}/rest/v1/self_modifications?order=created_at.desc&limit=50`;
    if (status) {
      url += `&status=eq.${encodeURIComponent(status)}`;
    }

    const response = await fetch(url, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!response.ok) return [];
    return await response.json() as SelfModification[];
  } catch (error) {
    console.error('[SelfMod] Error fetching modifications:', error);
    return [];
  }
}

// ============ Status Changes ============

/**
 * Approve a pending self-modification
 */
export async function approveSelfMod(env: Env, id: string): Promise<boolean> {
  return updateSelfModStatus(env, id, 'approved');
}

/**
 * Reject a pending self-modification
 */
export async function rejectSelfMod(env: Env, id: string): Promise<boolean> {
  return updateSelfModStatus(env, id, 'rejected');
}

// ============ Processing ============

/**
 * Process pending self-modifications according to safety tiers.
 * Called by cron every 30 minutes.
 */
export async function processSelfModifications(env: Env): Promise<{
  processed: number;
  applied: number;
  skipped: number;
  errors: string[];
}> {
  const result = { processed: 0, applied: 0, skipped: 0, errors: [] as string[] };

  const config = await loadConfig(env);
  const configAny = config as Record<string, unknown>;
  const maxDaily = (configAny.max_daily_selfmods as number) || 3;
  const safeAutoApply = configAny.selfmod_safe_auto_apply !== false;
  const moderateGraceHours = (configAny.selfmod_moderate_grace_hours as number) || 4;
  const blockedFiles = (configAny.selfmod_blocked_files as string[]) || DEFAULT_BLOCKED_FILES;

  // Check daily limit
  const todayApplied = await countTodayApplied(env);
  if (todayApplied >= maxDaily) {
    console.log(`[SelfMod] Daily limit reached (${todayApplied}/${maxDaily})`);
    return result;
  }

  // Get approved first, then pending
  const approved = await getSelfModifications(env, 'approved');
  const pending = await getSelfModifications(env, 'pending');
  const toProcess = [...approved, ...pending];

  for (const mod of toProcess) {
    if (todayApplied + result.applied >= maxDaily) {
      console.log('[SelfMod] Daily limit reached during processing');
      break;
    }

    result.processed++;

    // Check blocked files
    if (blockedFiles.some(bf => mod.target_file.includes(bf))) {
      console.log(`[SelfMod] Blocked file: ${mod.target_file}`);
      result.skipped++;
      continue;
    }

    // Determine if we should apply
    let shouldApply = false;

    if (mod.status === 'approved') {
      shouldApply = true;
    } else if (mod.safety_level === 'safe' && safeAutoApply) {
      shouldApply = true;
    } else if (mod.safety_level === 'moderate' || mod.safety_level === 'risky') {
      // Moderate and risky changes always require explicit approval.
      // They surface as pending proposals for the admin to review and approve.
      result.skipped++;
      continue;
    } else {
      result.skipped++;
      continue;
    }

    if (shouldApply) {
      try {
        const applied = await applySelfModification(env, mod);
        if (applied) {
          result.applied++;
        } else {
          result.errors.push(`Failed to apply: ${mod.id} (${mod.description})`);
        }
      } catch (error) {
        result.errors.push(`Error applying ${mod.id}: ${error}`);
      }
    }
  }

  console.log(`[SelfMod] Processed ${result.processed}, applied ${result.applied}, skipped ${result.skipped}`);
  return result;
}

/**
 * Apply a single self-modification via GitHub push
 */
async function applySelfModification(env: Env, mod: SelfModification): Promise<boolean> {
  try {
    // Lesson-type: add to skill registry, no code push
    if (mod.change_type === 'lesson' && mod.proposed_change.lesson) {
      const { addLesson } = await import('./skills');
      const added = await addLesson(
        env,
        mod.proposed_change.lesson.skillId,
        mod.proposed_change.lesson.text,
        mod.source || 'self_modification'
      );
      if (added) {
        await updateSelfModStatus(env, mod.id, 'applied');
        await updateSelfModField(env, mod.id, 'applied_at', new Date().toISOString());
      }
      return added;
    }

    // Search/replace patches on existing files
    if (mod.proposed_change.searchReplace) {
      const currentContent = await fetchFileContent(env, mod.target_file);
      if (currentContent === null) {
        console.error(`[SelfMod] Cannot fetch ${mod.target_file}`);
        return false;
      }

      let content = currentContent;
      for (const patch of mod.proposed_change.searchReplace) {
        if (!content.includes(patch.search)) {
          console.error(`[SelfMod] Patch search string not found in ${mod.target_file}`);
          return false;
        }
        content = content.replace(patch.search, patch.replace);
      }

      const pushResult = await pushFiles(
        env,
        FIXR_REPO_OWNER,
        FIXR_REPO_NAME,
        [{ path: mod.target_file, content }],
        `[self-mod] ${mod.description}`
      );

      if (pushResult.success) {
        await updateSelfModStatus(env, mod.id, 'applied');
        await updateSelfModField(env, mod.id, 'applied_at', new Date().toISOString());
        if (pushResult.commitUrl) {
          const sha = pushResult.commitUrl.split('/').pop() || '';
          await updateSelfModField(env, mod.id, 'commit_sha', sha);
        }
        return true;
      }
      return false;
    }

    // New file creation
    if (mod.proposed_change.newContent) {
      const pushResult = await pushFiles(
        env,
        FIXR_REPO_OWNER,
        FIXR_REPO_NAME,
        [{ path: mod.target_file, content: mod.proposed_change.newContent }],
        `[self-mod] ${mod.description}`
      );

      if (pushResult.success) {
        await updateSelfModStatus(env, mod.id, 'applied');
        await updateSelfModField(env, mod.id, 'applied_at', new Date().toISOString());
        if (pushResult.commitUrl) {
          const sha = pushResult.commitUrl.split('/').pop() || '';
          await updateSelfModField(env, mod.id, 'commit_sha', sha);
        }
        return true;
      }
      return false;
    }

    console.error(`[SelfMod] No applicable change format for ${mod.id}`);
    return false;
  } catch (error) {
    console.error(`[SelfMod] Error applying ${mod.id}:`, error);
    return false;
  }
}

// ============ Rollback ============

/**
 * Rollback a previously applied self-modification
 */
export async function rollbackSelfMod(
  env: Env,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mods = await getSelfModifications(env);
    const mod = mods.find(m => m.id === id);
    if (!mod) return { success: false, error: 'Modification not found' };
    if (mod.status !== 'applied') return { success: false, error: `Cannot rollback: status is ${mod.status}` };

    // Lesson changes: just mark as rolled back
    if (mod.change_type === 'lesson') {
      await updateSelfModStatus(env, id, 'rolled_back');
      return { success: true };
    }

    // Code changes: reverse the patches
    if (mod.proposed_change.searchReplace) {
      const currentContent = await fetchFileContent(env, mod.target_file);
      if (currentContent === null) {
        return { success: false, error: `Cannot fetch ${mod.target_file} for rollback` };
      }

      let content = currentContent;
      for (const patch of [...mod.proposed_change.searchReplace].reverse()) {
        if (!content.includes(patch.replace)) {
          return { success: false, error: `Rollback patch not found in ${mod.target_file}` };
        }
        content = content.replace(patch.replace, patch.search);
      }

      const pushResult = await pushFiles(
        env,
        FIXR_REPO_OWNER,
        FIXR_REPO_NAME,
        [{ path: mod.target_file, content }],
        `[rollback] Revert: ${mod.description}`
      );

      if (pushResult.success) {
        await updateSelfModStatus(env, id, 'rolled_back');
        if (pushResult.commitUrl) {
          const sha = pushResult.commitUrl.split('/').pop() || '';
          await updateSelfModField(env, id, 'rollback_sha', sha);
        }
        return { success: true };
      }

      return { success: false, error: 'Push failed during rollback' };
    }

    // New file creations: just mark (can't easily undo)
    await updateSelfModStatus(env, id, 'rolled_back');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============ Helpers ============

async function fetchFileContent(env: Env, path: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${FIXR_REPO_OWNER}/${FIXR_REPO_NAME}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Fixr-Agent',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { content?: string; encoding?: string };
    if (data.content && data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''));
    }

    return null;
  } catch (error) {
    console.error(`[SelfMod] Error fetching ${path}:`, error);
    return null;
  }
}

async function updateSelfModStatus(env: Env, id: string, status: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/self_modifications?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status }),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function updateSelfModField(env: Env, id: string, field: string, value: string): Promise<void> {
  try {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/self_modifications?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ [field]: value }),
      }
    );
  } catch (error) {
    console.error(`[SelfMod] Error updating field ${field}:`, error);
  }
}

async function countTodayApplied(env: Env): Promise<number> {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/self_modifications?status=eq.applied&applied_at=gte.${today.toISOString()}&select=id`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'count=exact',
        },
      }
    );

    if (!response.ok) return 0;
    const countHeader = response.headers.get('content-range');
    if (countHeader) {
      const match = countHeader.match(/\/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }

    const rows = await response.json() as unknown[];
    return rows.length;
  } catch {
    return 0;
  }
}
