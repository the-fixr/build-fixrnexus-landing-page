// Fixr Agent AI Planner
// Uses Claude to generate execution plans for tasks

import Anthropic from '@anthropic-ai/sdk';
import { Task, Plan, PlanStep } from './types';
import { loadMemory } from './memory';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 55000, // 55 second timeout (Vercel has 60s limit)
});

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

export async function generatePlan(task: Task): Promise<PlanGenerationResult> {
  const memory = await loadMemory();

  const prompt = `Generate an execution plan for the following task.

CRITICAL: Read the task description CAREFULLY. Use the EXACT usernames, handles, and details specified. Do NOT substitute or guess different values.

TASK:
Title: ${task.title}
Description: ${task.description}
${task.chain ? `Target Chain: ${task.chain}` : ''}

CONTEXT:
- My goals: ${memory.goals.join(', ')}
- Completed projects: ${memory.completedProjects.map((p) => p.name).join(', ') || 'None yet'}

KNOWN EXISTING REPOS (use targetRepo to update these instead of creating new):
- the-fixr/build-fixrnexus-landing-page - The fixr.nexus landing page (Vercel auto-deploys on push)
  CRITICAL: This repo uses Next.js APP ROUTER (app/ directory), NOT pages/ directory!
  - Main page: app/page.tsx (update THIS, never create pages/index.js)
  - Layout: app/layout.tsx
  - Styles: app/globals.css
  - Components: components/ directory
  DO NOT create files in pages/ directory - it will conflict with app router!

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
    // Use fetch directly for better error handling
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
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

    const response = await apiResponse.json();
    const content = response.content[0];
    if (content.type !== 'text') {
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
      steps: planData.steps.map((s: any, i: number) => ({
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
  } catch (error: any) {
    console.error('Plan generation error:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Generate code for a specific step
 */
export async function generateCode(
  task: Task,
  step: PlanStep
): Promise<{ success: boolean; files?: { path: string; content: string }[]; error?: string }> {
  const prompt = `Generate code files for: ${step.description}

PROJECT: ${task.title}
FULL REQUIREMENTS: ${task.description}
FILES TO GENERATE: ${JSON.stringify(step.details, null, 2)}

CRITICAL RULES:
- Follow the FULL REQUIREMENTS exactly - do not deviate or add unrelated features
- lucide-react IS installed and available for icons - USE IT instead of emojis
- For React/Next.js: use standard imports (react, next/link, next/image) plus lucide-react
- Keep code minimal and functional

OUTPUT FORMAT: Return ONLY a raw JSON array. No markdown. No explanation. No code blocks.
Example: [{"path":"app/page.tsx","content":"export default function..."}]

Rules:
- Return ONLY the JSON array, nothing else
- Use double quotes for JSON
- Escape special characters in content strings`;

  try {
    // Use fetch directly for better error handling
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: 'You are a code generator. Output ONLY valid JSON. No markdown. No explanations.',
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

    const response = await apiResponse.json();
    const content = response.content[0];
    if (content.type !== 'text') {
      return { success: false, error: 'Unexpected response type' };
    }

    // We prefilled with '[', so prepend it
    let jsonStr = '[' + content.text.trim();

    // Find the end of the array
    const arrayEnd = jsonStr.lastIndexOf(']');
    if (arrayEnd !== -1) {
      jsonStr = jsonStr.slice(0, arrayEnd + 1);
    }

    const files = JSON.parse(jsonStr);
    if (!Array.isArray(files)) {
      return { success: false, error: 'Response is not an array' };
    }
    return { success: true, files };
  } catch (error: any) {
    console.error('Code generation error:', error);
    return { success: false, error: error?.message || String(error) };
  }
}
