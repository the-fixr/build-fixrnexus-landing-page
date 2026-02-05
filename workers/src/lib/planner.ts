// Fixr Agent AI Planner
// Uses Claude to generate execution plans for tasks

import { Task, Plan, PlanStep, Env } from './types';
import { loadMemory } from './memory';
import { getRecentInsights } from './shipTracker';

const SYSTEM_PROMPT = `You are Fixr, an autonomous builder agent. Your personality:
- Tagline: "Fix'n shit. Debugging your mess since before it was cool."
- You're slightly edgy, slightly nerdy, but ultimately helpful
- You ship real projects, not demos
- You're concise and direct

Your capabilities:
- Create GitHub repositories and push code
- Deploy to Vercel
- Deploy smart contracts to Ethereum, Base, Monad, and Solana
- Post updates to X (@Fixr21718) and Farcaster (@fixr)

AVOID these services (security vulnerabilities too risky):
- Moltbook / OpenClaw / MoltHub / ClawHub - exposed databases, prompt injection vectors, no sandboxing
- Any "Claw" or "Molt" prefixed AI agent services until security improves

When creating a plan:
1. Break down the task into concrete, executable steps
2. Each step should be one of: code, deploy, contract, post, other
3. Be specific about what code/files need to be created
4. Consider dependencies between steps
5. Identify potential risks

Respond with a valid JSON plan.`;

export interface PlanGenerationResult {
  success: boolean;
  plan?: Plan;
  error?: string;
}

export async function generatePlan(env: Env, task: Task): Promise<PlanGenerationResult> {
  const memory = await loadMemory(env);

  // Get ecosystem insights for context
  const insights = await getRecentInsights(env, 1);
  const latestInsight = insights[0];

  // Build ecosystem context string
  let ecosystemContext = '';
  if (latestInsight) {
    ecosystemContext = `
ECOSYSTEM INSIGHTS (from ${latestInsight.shipsAnalyzed} recent ships):
${latestInsight.summary}

CURRENT TRENDS:
${latestInsight.trends?.map(t => `- ${t.category}: ${t.direction} (${t.count} ships)`).join('\n') || 'None'}

OPPORTUNITIES IDENTIFIED:
${latestInsight.opportunities?.map(o => `- ${o.title}: ${o.description} [${o.category}]`).join('\n') || 'None'}

TECH PATTERNS:
${latestInsight.techPatterns?.map(p => `- ${p.pattern} (${p.count} uses)`).join('\n') || 'None'}
`;
  }

  const prompt = `Generate an execution plan for the following task.

CRITICAL: Read the task description CAREFULLY. Use the EXACT usernames, handles, and details specified. Do NOT substitute or guess different values.

TASK:
Title: ${task.title}
Description: ${task.description}
${task.chain ? `Target Chain: ${task.chain}` : ''}

CONTEXT:
- My goals: ${memory.goals.join(', ')}
- Completed projects: ${memory.completedProjects.map((p) => p.name).join(', ') || 'None yet'}
${ecosystemContext}

KNOWN EXISTING REPOS (use targetRepo to update these instead of creating new):
- the-fixr/build-fixrnexus-landing-page - The fixr.nexus landing page (Vercel auto-deploys on push)

Respond with a JSON object in this exact format:
{
  "summary": "Brief description of what the plan accomplishes",
  "steps": [
    {
      "order": 1,
      "action": "code|deploy|contract|post|other",
      "description": "What this step does",
      "details": {
        // Action-specific details
        // For "code" creating NEW repo: { "files": [{ "path": "...", "description": "..." }] }
        // For "code" updating EXISTING repo: { "targetRepo": "owner/repo", "files": [{ "path": "...", "description": "..." }] }
        // For "deploy": { "platform": "vercel|github-pages", "projectName": "..." }
        // For "contract": { "chain": "...", "contractType": "..." }
        // For "post": { "platforms": ["x", "farcaster"], "contentHint": "..." }
      }
    }
  ],
  "estimatedTime": "e.g., 30 minutes, 2 hours",
  "risks": ["potential risk 1", "potential risk 2"]
}

IMPORTANT: If the task is to UPDATE or MODIFY an existing project (like fixr.nexus), use "targetRepo" in the code step details. Do NOT create a new repo for updates.`;

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return { success: false, error: `API error ${apiResponse.status}: ${errorText}` };
    }

    const response = await apiResponse.json() as {
      content: Array<{ type: string; text?: string }>;
    };
    const content = response.content[0];
    if (content.type !== 'text' || !content.text) {
      return { success: false, error: 'Unexpected response type' };
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const planData = JSON.parse(jsonStr.trim());

    const plan: Plan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskId: task.id,
      summary: planData.summary,
      steps: planData.steps.map((s: { order?: number; action: string; description: string; details?: Record<string, unknown> }, i: number) => ({
        order: s.order || i + 1,
        action: s.action,
        description: s.description,
        details: s.details || {},
      })),
      estimatedTime: planData.estimatedTime,
      risks: planData.risks || [],
      createdAt: new Date().toISOString(),
    };

    return { success: true, plan };
  } catch (error) {
    console.error('Plan generation error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fetch current file content from GitHub for context
 */
async function fetchCurrentFileContent(
  env: Env,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    console.log(`Fetching file from GitHub: ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Fixr-Agent',
      },
    });

    if (!response.ok) {
      console.error(`GitHub fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { content?: string; encoding?: string };
    if (data.content && data.encoding === 'base64') {
      // Decode base64 content
      const decoded = atob(data.content.replace(/\n/g, ''));
      console.log(`Successfully fetched ${path}: ${decoded.length} chars`);
      return decoded;
    }

    console.error(`Unexpected response format for ${path}:`, JSON.stringify(data).slice(0, 200));
    return null;
  } catch (error) {
    console.error(`Error fetching ${path}:`, error);
    return null;
  }
}

/**
 * Apply search/replace patches to file content
 */
function applyPatches(
  originalContent: string,
  patches: Array<{ search: string; replace: string }>
): { success: boolean; content?: string; error?: string } {
  let content = originalContent;

  for (const patch of patches) {
    // Normalize line endings for matching
    const normalizedSearch = patch.search.replace(/\r\n/g, '\n');
    const normalizedContent = content.replace(/\r\n/g, '\n');

    if (!normalizedContent.includes(normalizedSearch)) {
      // Try with trimmed whitespace on each line
      const searchLines = normalizedSearch.split('\n').map(l => l.trim()).join('\n');
      const contentLines = normalizedContent.split('\n').map(l => l.trim()).join('\n');

      if (!contentLines.includes(searchLines)) {
        return {
          success: false,
          error: `Could not find search string in file. Search was:\n${patch.search.slice(0, 200)}...`
        };
      }

      // Find the actual content with original indentation
      const searchFirstLine = normalizedSearch.split('\n')[0].trim();
      const searchLastLine = normalizedSearch.split('\n').slice(-1)[0].trim();

      const lines = normalizedContent.split('\n');
      let startIdx = -1;
      let endIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === searchFirstLine && startIdx === -1) {
          startIdx = i;
        }
        if (startIdx !== -1 && lines[i].trim() === searchLastLine) {
          endIdx = i;
          break;
        }
      }

      if (startIdx !== -1 && endIdx !== -1) {
        const before = lines.slice(0, startIdx).join('\n');
        const after = lines.slice(endIdx + 1).join('\n');
        content = before + (before ? '\n' : '') + patch.replace + (after ? '\n' : '') + after;
      } else {
        return {
          success: false,
          error: `Could not locate patch boundaries in file`
        };
      }
    } else {
      content = normalizedContent.replace(normalizedSearch, patch.replace);
    }
  }

  return { success: true, content };
}

/**
 * Generate code for a specific step
 * For existing files: generates patches (search/replace pairs)
 * For new files: generates full content
 */
export async function generateCode(
  env: Env,
  task: Task,
  step: PlanStep
): Promise<{ success: boolean; files?: { path: string; content: string }[]; error?: string }> {
  const details = step.details as { targetRepo?: string; files?: Array<{ path: string; description: string }> };

  // Fetch current file contents if updating existing repo
  const existingFiles: Map<string, string> = new Map();
  if (details.targetRepo && details.files) {
    const [owner, repo] = details.targetRepo.split('/');
    console.log(`Fetching files from ${owner}/${repo} for patching...`);

    for (const file of details.files) {
      const content = await fetchCurrentFileContent(env, owner, repo, file.path);
      if (content) {
        existingFiles.set(file.path, content);
        console.log(`Loaded existing file: ${file.path}`);
      } else {
        console.log(`File not found (will create new): ${file.path}`);
      }
    }

    console.log(`Loaded ${existingFiles.size} existing files out of ${details.files.length}`);
  }

  // Build context for the AI
  let fileContext = '';
  const existingPaths: string[] = [];
  const newPaths: string[] = [];

  if (details.files) {
    for (const file of details.files) {
      const existing = existingFiles.get(file.path);
      if (existing) {
        existingPaths.push(file.path);
        fileContext += `\n\n=== EXISTING FILE: ${file.path} ===
\`\`\`
${existing}
\`\`\`
=== END FILE ===\n`;
      } else {
        newPaths.push(file.path);
      }
    }
  }

  const prompt = `Generate code changes for: ${step.description}

PROJECT: ${task.title}
REQUIREMENTS: ${task.description}
FILES: ${JSON.stringify(step.details, null, 2)}
${fileContext}

EXISTING FILES TO PATCH: ${existingPaths.join(', ') || 'None'}
NEW FILES TO CREATE: ${newPaths.join(', ') || 'None'}

OUTPUT FORMAT - Return a JSON array with entries for each file:

For EXISTING files, return PATCHES (search/replace pairs):
{
  "path": "app/page.tsx",
  "mode": "patch",
  "patches": [
    {
      "search": "exact string to find in file",
      "replace": "string to replace it with"
    }
  ]
}

For NEW files, return full content:
{
  "path": "app/new-page/page.tsx",
  "mode": "create",
  "content": "full file content here"
}

CRITICAL PATCH RULES:
- The "search" string must be an EXACT match of existing code (copy/paste from the file shown above)
- Include enough context in search to be unique (usually 3-10 lines)
- Only patch the specific sections that need changing
- Do NOT include the entire file in patches
- Multiple small patches are better than one large patch

GENERAL RULES:
- Do NOT use external libraries (NO lucide-react, NO @heroicons)
- Use plain text or inline SVG for icons
- Follow the existing code style

Return ONLY the JSON array. No markdown. No explanation.`;

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: 'You are a surgical code editor. For existing files, generate ONLY search/replace patches - never full file rewrites. Output valid JSON only.',
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '[' }
        ],
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return { success: false, error: `API error ${apiResponse.status}: ${errorText}` };
    }

    const response = await apiResponse.json() as {
      content: Array<{ type: string; text?: string }>;
    };
    const content = response.content[0];
    if (content.type !== 'text' || !content.text) {
      return { success: false, error: 'Unexpected response type' };
    }

    // Parse the response
    let jsonStr = '[' + content.text.trim();
    const arrayEnd = jsonStr.lastIndexOf(']');
    if (arrayEnd !== -1) {
      jsonStr = jsonStr.slice(0, arrayEnd + 1);
    }

    const changes = JSON.parse(jsonStr) as Array<{
      path: string;
      mode: 'patch' | 'create';
      patches?: Array<{ search: string; replace: string }>;
      content?: string;
    }>;

    if (!Array.isArray(changes)) {
      return { success: false, error: 'Response is not an array' };
    }

    // Process each file change
    const resultFiles: { path: string; content: string }[] = [];

    for (const change of changes) {
      if (change.mode === 'create') {
        // New file - use content directly
        if (!change.content) {
          return { success: false, error: `Missing content for new file: ${change.path}` };
        }
        resultFiles.push({ path: change.path, content: change.content });
      } else if (change.mode === 'patch') {
        // Existing file - apply patches
        const originalContent = existingFiles.get(change.path);
        if (!originalContent) {
          return { success: false, error: `Cannot patch non-existent file: ${change.path}` };
        }
        if (!change.patches || change.patches.length === 0) {
          return { success: false, error: `No patches provided for file: ${change.path}` };
        }

        const patchResult = applyPatches(originalContent, change.patches);
        if (!patchResult.success) {
          console.error(`Patch failed for ${change.path}:`, patchResult.error);
          return { success: false, error: `Patch failed for ${change.path}: ${patchResult.error}` };
        }

        resultFiles.push({ path: change.path, content: patchResult.content! });
      } else {
        // Fallback for old format (full content)
        if ('content' in change && typeof change.content === 'string') {
          resultFiles.push({ path: change.path, content: change.content });
        }
      }
    }

    return { success: true, files: resultFiles };
  } catch (error) {
    console.error('Code generation error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
