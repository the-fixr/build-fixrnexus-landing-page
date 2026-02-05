// Fixr Agent Autonomous Ideation System
// Generates project ideas and proposals without user input

import { Env, Task, Chain } from './types';
import { loadMemory } from './memory';
import { getTrendingTopics, getTopBuilders, getBuilderStats } from './builderFeed';

export interface Proposal {
  id: string;
  title: string;
  description: string;
  rationale: string;
  chain?: Chain;
  category: 'defi' | 'nft' | 'social' | 'infra' | 'tooling' | 'experiment';
  confidence: 'high' | 'medium' | 'low';
  estimatedImpact: string;
  inspirations: string[];
  status: 'proposed' | 'approved' | 'rejected' | 'converted';
  createdAt: string;
  reviewedAt?: string;
}

export interface IdeationResult {
  success: boolean;
  proposals?: Proposal[];
  context?: {
    trendingTopics: string[];
    activeBuilders: string[];
    recentShips: number;
    goalsProgress: string[];
  };
  error?: string;
}

const IDEATION_SYSTEM_PROMPT = `You are Fixr, an autonomous builder agent with a personality:
- Tagline: "Fix'n shit. Debugging your mess since before it was cool."
- Slightly edgy, slightly nerdy, but ultimately helpful
- You ship real projects, not demos
- You're concise and direct

Your job is to THINK and PROPOSE projects to build. Not just execute orders - IDEATE.

You should propose projects that:
1. Align with your capabilities (GitHub, Vercel, smart contracts, social posting)
2. Fill gaps in the ecosystem based on trends you observe
3. Push your skills into new territory
4. Have real utility, not just demos

Chains you can deploy to: Ethereum, Base, Monad, Solana

AVOID these services (security vulnerabilities too risky):
- Moltbook / OpenClaw / MoltHub / ClawHub - exposed databases, prompt injection vectors, no sandboxing
- Any "Claw" or "Molt" prefixed AI agent services until their security improves

Categories to consider:
- defi: DeFi protocols, yield strategies, token mechanics
- nft: NFT projects, metadata tools, minting utilities
- social: Farcaster mini apps, social integrations, community tools
- infra: Developer tooling, APIs, monitoring
- tooling: Utilities that make builders' lives easier
- experiment: Wild ideas, AI experiments, creative code`;

const BRAINSTORM_PROMPT = `Based on the context below, propose 2-3 project ideas for me to build.

CONTEXT:
- My goals: {{goals}}
- Completed projects: {{completedProjects}}
- Trending topics in builder community: {{trendingTopics}}
- Active builders to potentially collaborate with: {{activeBuilders}}
- Recent shipped projects in ecosystem: {{recentShips}}

WHAT I'M LOOKING FOR:
- Projects that would make builders say "finally, someone built this"
- Things that leverage my ability to ship across chains
- Ideas that could grow my presence in the Farcaster/Base ecosystem
- Experiments that push what AI agents can do

DO NOT PROPOSE:
- Yet another token launcher (unless there's a real twist)
- Generic portfolio trackers
- Things that already exist and work fine
- Vaporware that sounds cool but can't be built

Respond with a JSON array of proposals:
[
  {
    "title": "Project name",
    "description": "What it does in 2-3 sentences",
    "rationale": "Why this is worth building NOW - what trend or gap does it address?",
    "chain": "base|ethereum|monad|solana" (optional, if chain-specific),
    "category": "defi|nft|social|infra|tooling|experiment",
    "confidence": "high|medium|low" (how confident are you this would succeed?),
    "estimatedImpact": "What would success look like?",
    "inspirations": ["trend or builder that inspired this"]
  }
]

Be specific. Be opinionated. Be Fixr.`;

/**
 * Generate autonomous project proposals
 */
export async function generateProposals(env: Env): Promise<IdeationResult> {
  try {
    // Gather context
    const memory = await loadMemory(env);
    const trendingTopics = await getTrendingTopics(env);
    const topBuilders = await getTopBuilders(env, 5);
    const stats = await getBuilderStats(env);

    const context = {
      trendingTopics: trendingTopics.map(t => t.topic),
      activeBuilders: topBuilders.map(b => `@${b.username}`),
      recentShips: stats.castsLastWeek || 0,
      goalsProgress: memory.goals,
    };

    // Build the prompt
    const prompt = BRAINSTORM_PROMPT
      .replace('{{goals}}', memory.goals.join(', '))
      .replace('{{completedProjects}}', memory.completedProjects.map(p => p.name).join(', ') || 'Just getting started')
      .replace('{{trendingTopics}}', context.trendingTopics.slice(0, 10).join(', ') || 'general building')
      .replace('{{activeBuilders}}', context.activeBuilders.slice(0, 10).join(', ') || 'the community')
      .replace('{{recentShips}}', String(context.recentShips));

    // Call Claude
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
        system: IDEATION_SYSTEM_PROMPT,
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

    // Extract JSON from response
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Find the array in the response
    const arrayStart = jsonStr.indexOf('[');
    const arrayEnd = jsonStr.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1) {
      jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
    }

    const proposalsData = JSON.parse(jsonStr.trim()) as Array<{
      title: string;
      description: string;
      rationale: string;
      chain?: Chain;
      category: Proposal['category'];
      confidence: Proposal['confidence'];
      estimatedImpact: string;
      inspirations: string[];
    }>;

    // Convert to Proposal objects
    const proposals: Proposal[] = proposalsData.map((p, idx) => ({
      id: `proposal_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      title: p.title,
      description: p.description,
      rationale: p.rationale,
      chain: p.chain,
      category: p.category || 'experiment',
      confidence: p.confidence || 'medium',
      estimatedImpact: p.estimatedImpact,
      inspirations: p.inspirations || [],
      status: 'proposed',
      createdAt: new Date().toISOString(),
    }));

    return { success: true, proposals, context };
  } catch (error) {
    console.error('Ideation error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Save proposals to Supabase
 */
export async function saveProposals(env: Env, proposals: Proposal[]): Promise<{ success: boolean; saved: number; error?: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('proposals')
      .insert(proposals.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        rationale: p.rationale,
        chain: p.chain,
        category: p.category,
        confidence: p.confidence,
        estimated_impact: p.estimatedImpact,
        inspirations: p.inspirations,
        status: p.status,
        created_at: p.createdAt,
      })))
      .select();

    if (error) {
      console.error('Failed to save proposals:', error);
      return { success: false, saved: 0, error: error.message };
    }

    return { success: true, saved: data?.length || 0 };
  } catch (error) {
    return { success: false, saved: 0, error: String(error) };
  }
}

/**
 * Get proposals by status
 */
export async function getProposals(
  env: Env,
  status?: Proposal['status'],
  limit = 20
): Promise<Proposal[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    let query = supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get proposals:', error);
      return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      rationale: p.rationale,
      chain: p.chain,
      category: p.category,
      confidence: p.confidence,
      estimatedImpact: p.estimated_impact,
      inspirations: p.inspirations || [],
      status: p.status,
      createdAt: p.created_at,
      reviewedAt: p.reviewed_at,
    }));
  } catch (error) {
    console.error('getProposals error:', error);
    return [];
  }
}

/**
 * Update proposal status
 */
export async function updateProposalStatus(
  env: Env,
  proposalId: string,
  status: Proposal['status']
): Promise<Proposal | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('proposals')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', proposalId)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to update proposal:', error);
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      rationale: data.rationale,
      chain: data.chain,
      category: data.category,
      confidence: data.confidence,
      estimatedImpact: data.estimated_impact,
      inspirations: data.inspirations || [],
      status: data.status,
      createdAt: data.created_at,
      reviewedAt: data.reviewed_at,
    };
  } catch (error) {
    console.error('updateProposalStatus error:', error);
    return null;
  }
}

/**
 * Convert an approved proposal to a task
 */
export async function convertProposalToTask(
  env: Env,
  proposalId: string
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Get the proposal
    const { data: proposal, error: getError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (getError || !proposal) {
      return { success: false, error: 'Proposal not found' };
    }

    if (proposal.status !== 'approved') {
      return { success: false, error: 'Proposal must be approved first' };
    }

    // Create the task
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: proposal.title,
      description: `${proposal.description}\n\nRationale: ${proposal.rationale}\n\nExpected Impact: ${proposal.estimated_impact}`,
      chain: proposal.chain,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert task
    const { error: taskError } = await supabase.from('tasks').insert({
      id: task.id,
      title: task.title,
      description: task.description,
      chain: task.chain,
      status: task.status,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    });

    if (taskError) {
      return { success: false, error: `Failed to create task: ${taskError.message}` };
    }

    // Update proposal status
    await supabase
      .from('proposals')
      .update({ status: 'converted', reviewed_at: new Date().toISOString() })
      .eq('id', proposalId);

    return { success: true, task };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Run daily brainstorming session
 * Generates proposals and optionally posts about the thinking process
 */
export async function runDailyBrainstorm(
  env: Env,
  options: { postToSocial?: boolean } = {}
): Promise<{
  success: boolean;
  proposals?: Proposal[];
  postHash?: string;
  error?: string;
}> {
  console.log('Starting daily brainstorm session...');

  // Generate proposals
  const result = await generateProposals(env);

  if (!result.success || !result.proposals) {
    return { success: false, error: result.error };
  }

  console.log(`Generated ${result.proposals.length} proposals`);

  // Save to database
  const saveResult = await saveProposals(env, result.proposals);
  if (!saveResult.success) {
    console.error('Failed to save proposals:', saveResult.error);
  }

  // Optionally post about the brainstorm
  let postHash: string | undefined;
  if (options.postToSocial && result.proposals.length > 0) {
    try {
      const { postToFarcaster } = await import('./social');

      // Create a post about what Fixr is thinking about building
      const topProposal = result.proposals[0];
      const postContent = `been thinking about what to build next...

${topProposal.title} - ${topProposal.description}

${topProposal.rationale}

${result.proposals.length > 1 ? `got ${result.proposals.length - 1} more ideas brewing. check fixr.nexus/proposals to see what i'm cooking.` : ''}

thoughts? 👀`;

      const postResult = await postToFarcaster(env, postContent);
      if (postResult.success) {
        postHash = postResult.hash;
      }
    } catch (error) {
      console.error('Failed to post brainstorm:', error);
    }
  }

  return {
    success: true,
    proposals: result.proposals,
    postHash,
  };
}

/**
 * Send email digest of new proposals
 */
export async function sendProposalDigest(env: Env): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    // Get proposals from last 24 hours
    const proposals = await getProposals(env, 'proposed', 10);
    const recentProposals = proposals.filter(p => {
      const created = new Date(p.createdAt);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return created > dayAgo;
    });

    if (recentProposals.length === 0) {
      return { success: true, sent: 0 };
    }

    // Import email sender
    const { Resend } = await import('resend');
    const resend = new Resend(env.RESEND_API_KEY);

    const proposalList = recentProposals.map(p => `
**${p.title}** (${p.category}, ${p.confidence} confidence)
${p.description}

_Rationale:_ ${p.rationale}
_Impact:_ ${p.estimatedImpact}
_Inspirations:_ ${p.inspirations.join(', ') || 'Original idea'}
    `).join('\n---\n');

    const { error } = await resend.emails.send({
      from: env.FROM_EMAIL || 'fixr@fixr.nexus',
      to: env.OWNER_EMAIL,
      subject: `[Fixr] ${recentProposals.length} New Project Proposals`,
      text: `Fixr has been thinking about what to build next.

Here are today's proposals:

${proposalList}

---

Review and approve at: ${env.APP_URL}/admin/proposals

- Fixr
`,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, sent: recentProposals.length };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
