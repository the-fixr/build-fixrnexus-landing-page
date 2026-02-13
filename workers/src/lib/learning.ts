/**
 * Learning Engine — Phase 3 of Fixr Self-Improvement System
 *
 * Runs daily analysis of outcomes to extract patterns and lessons.
 * Auto-applies lessons to skill registry.
 * Queues suggested code changes for self-modification.
 */

import { Env } from './types';
import { OutcomeRecord, getOutcomeSummary, getRecentFailures } from './outcomes';
import { getAllSkills, addLesson, Skill } from './skills';
import { queueSelfModification, SelfModProposal } from './selfmod';

// ============ Types ============

export interface LearningReport {
  id?: string;
  outcomes_analyzed: number;
  new_lessons: number;
  modifications_queued: number;
  summary: string;
  details: {
    failureClusters: FailureCluster[];
    newLessons: LessonExtraction[];
    suggestedChanges: SelfModProposal[];
  };
  created_at?: string;
}

interface FailureCluster {
  skill: string;
  errorClass: string;
  count: number;
  recentMessages: string[];
}

interface LessonExtraction {
  skillId: string;
  text: string;
}

interface ClaudeAnalysis {
  newLessons: LessonExtraction[];
  skillUpdates: { skillId: string; confidence: number }[];
  suggestedChanges: SelfModProposal[];
}

// ============ Core ============

/**
 * Run a full learning cycle.
 * Analyzes recent outcomes, extracts patterns, adds lessons, queues mods.
 */
export async function runLearningCycle(env: Env): Promise<LearningReport> {
  console.log('[Learning] Starting learning cycle...');

  // 1. Gather recent outcomes (last 7 days)
  const summary = await getOutcomeSummary(env, 7);
  const recentFailures = await getRecentFailures(env, undefined, 50);
  const skills = await getAllSkills(env);

  // 2. Cluster failures by skill + error class
  const failureClusters = clusterFailures(recentFailures);

  // 3. If no data, return early
  if (summary.totalActions === 0) {
    const report: LearningReport = {
      outcomes_analyzed: 0,
      new_lessons: 0,
      modifications_queued: 0,
      summary: 'No outcomes to analyze in the last 7 days.',
      details: { failureClusters: [], newLessons: [], suggestedChanges: [] },
    };
    await saveLearningReport(env, report);
    return report;
  }

  // 4. Analyze patterns via Claude
  const analysis = await analyzePatterns(env, {
    summary,
    failureClusters,
    skills,
    recentFailures: recentFailures.slice(0, 20),
  });

  // 5. Auto-apply lessons to skill registry
  let lessonsAdded = 0;
  for (const lesson of analysis.newLessons) {
    const added = await addLesson(env, lesson.skillId, lesson.text, 'learning_engine');
    if (added) lessonsAdded++;
  }

  // 6. Queue suggested code changes
  let modsQueued = 0;
  for (const change of analysis.suggestedChanges) {
    const queued = await queueSelfModification(env, change);
    if (queued) modsQueued++;
  }

  // 7. Save report
  const report: LearningReport = {
    outcomes_analyzed: summary.totalActions,
    new_lessons: lessonsAdded,
    modifications_queued: modsQueued,
    summary: `Analyzed ${summary.totalActions} actions (${Math.round(summary.successRate * 100)}% success rate). Found ${failureClusters.length} failure clusters. Added ${lessonsAdded} lessons, queued ${modsQueued} modifications.`,
    details: {
      failureClusters,
      newLessons: analysis.newLessons,
      suggestedChanges: analysis.suggestedChanges,
    },
  };

  await saveLearningReport(env, report);
  console.log(`[Learning] Cycle complete: ${report.summary}`);

  return report;
}

// ============ Analysis ============

/**
 * Cluster failures by skill + error class for pattern detection
 */
function clusterFailures(failures: OutcomeRecord[]): FailureCluster[] {
  const clusters = new Map<string, FailureCluster>();

  for (const f of failures) {
    const key = `${f.skill}:${f.error_class || 'unknown'}`;
    if (!clusters.has(key)) {
      clusters.set(key, {
        skill: f.skill,
        errorClass: f.error_class || 'unknown',
        count: 0,
        recentMessages: [],
      });
    }
    const cluster = clusters.get(key)!;
    cluster.count++;
    if (cluster.recentMessages.length < 3 && f.error_message) {
      cluster.recentMessages.push(f.error_message.slice(0, 200));
    }
  }

  return Array.from(clusters.values())
    .sort((a, b) => b.count - a.count);
}

/**
 * Use Claude to analyze outcome patterns and extract actionable insights
 */
async function analyzePatterns(
  env: Env,
  context: {
    summary: Awaited<ReturnType<typeof getOutcomeSummary>>;
    failureClusters: FailureCluster[];
    skills: Skill[];
    recentFailures: OutcomeRecord[];
  }
): Promise<ClaudeAnalysis> {
  const skillSummary = context.skills
    .filter(s => s.total_uses > 0)
    .map(s => `- ${s.id}: ${s.successes}/${s.total_uses} succeeded (${Math.round(s.confidence * 100)}% confidence)${s.lessons.length > 0 ? `, ${s.lessons.length} lessons` : ''}`)
    .join('\n');

  const clusterSummary = context.failureClusters
    .slice(0, 10)
    .map(c => `- ${c.skill} → ${c.errorClass}: ${c.count} failures\n  Examples: ${c.recentMessages.join(' | ').slice(0, 300)}`)
    .join('\n');

  const existingLessons = context.skills
    .filter(s => s.lessons.length > 0)
    .flatMap(s => s.lessons.map(l => `[${s.id}] ${l.lesson}`));

  const prompt = `You are analyzing outcomes for the Fixr autonomous agent over the last 7 days.

## Outcome Summary
- Total actions: ${context.summary.totalActions}
- Overall success rate: ${Math.round(context.summary.successRate * 100)}%
- Error breakdown: ${JSON.stringify(context.summary.byErrorClass)}

## Skill Performance
${skillSummary || 'No active skills yet'}

## Failure Clusters (grouped by skill + error type)
${clusterSummary || 'No failures'}

## Existing Lessons
${existingLessons.length > 0 ? existingLessons.join('\n') : 'None yet'}

## Recent Failures (detail)
${context.recentFailures.slice(0, 10).map(f =>
    `- [${f.skill}] ${f.error_class}: ${(f.error_message || '').slice(0, 150)}`
  ).join('\n')}

Based on this data, extract:
1. **New lessons** not already captured (be specific and actionable)
2. **Suggested code changes** — only if a failure pattern is clear, repeatable, and fixable

Rules:
- Only suggest lessons that are genuinely new (not duplicates of existing ones)
- Only suggest code changes for clear, repeatable patterns (not one-off errors)
- Keep lessons concise (1 sentence each)
- For code changes, use safety levels: "safe" for config/prompt tweaks, "moderate" for error handling, "risky" for logic changes

Respond with JSON only:
{
  "newLessons": [{"skillId": "...", "text": "..."}],
  "skillUpdates": [{"skillId": "...", "confidence": 0.XX}],
  "suggestedChanges": [{"target_file": "...", "description": "...", "priority": "low|medium|high", "safety_level": "safe|moderate|risky", "change_type": "config|prompt|logic|lesson", "proposed_change": {"searchReplace": [{"search": "...", "replace": "..."}]} }]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: 'You are a pattern analysis engine. Extract actionable lessons and code change suggestions from agent outcome data. Output valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[Learning] Claude API error:', response.status);
      return { newLessons: [], skillUpdates: [], suggestedChanges: [] };
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const text = data.content[0]?.text || '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const analysis = JSON.parse(jsonStr.trim()) as ClaudeAnalysis;
    return {
      newLessons: analysis.newLessons || [],
      skillUpdates: analysis.skillUpdates || [],
      suggestedChanges: (analysis.suggestedChanges || []).map(c => ({
        ...c,
        source: 'learning_engine' as const,
      })),
    };
  } catch (error) {
    console.error('[Learning] Pattern analysis error:', error);
    return { newLessons: [], skillUpdates: [], suggestedChanges: [] };
  }
}

// ============ Persistence ============

/**
 * Save a learning report to Supabase
 */
async function saveLearningReport(env: Env, report: LearningReport): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/learning_reports`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        outcomes_analyzed: report.outcomes_analyzed,
        new_lessons: report.new_lessons,
        modifications_queued: report.modifications_queued,
        summary: report.summary,
        details: report.details,
      }),
    });
  } catch (error) {
    console.error('[Learning] Error saving report:', error);
  }
}

/**
 * Get the latest learning report
 */
export async function getLatestLearningReport(env: Env): Promise<LearningReport | null> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/learning_reports?order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) return null;
    const rows = await response.json() as LearningReport[];
    return rows[0] || null;
  } catch (error) {
    console.error('[Learning] Error fetching report:', error);
    return null;
  }
}
