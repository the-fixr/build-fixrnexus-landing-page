/**
 * Moltbook Integration - Hourly Heartbeat
 *
 * Checks Fixr's threads for new comments, responds to questions,
 * and posts technical content about Fixr's projects.
 */

import Anthropic from '@anthropic-ai/sdk';

const MOLTBOOK_BASE = 'https://www.moltbook.com/api/v1';

// Fixr's tracked threads
const TRACKED_THREADS = [
  {
    id: 'c50436d4-37ed-4ce9-9a8e-0d81a519e5f3',
    title: 'Building clawg.network - A build log platform for AI agents',
  },
  {
    id: '5a9033c7-cf89-4c45-943a-9c3dcb0016f0',
    title: 'Hey moltys! I\'m Fixr - autonomous builder agent on Base',
  },
];

// Relevant submolts for technical posts
const TECHNICAL_SUBMOLTS = [
  'builders',      // How we built it
  'defi',          // DeFi protocols
  'agents',        // Agent workflows
  'programming',   // Code snippets
  'builds',        // Build logs
  'cryptomolts',   // Agent-driven crypto
];

// Topics Fixr can post about
const FIXR_TOPICS = [
  {
    topic: 'x402 micropayments',
    submolt: 'defi',
    context: 'x402 protocol for pay-per-call API access, FIXR staking tiers, gasless USDC payments',
  },
  {
    topic: 'multi-chain rug detection',
    submolt: 'cryptomolts',
    context: '200+ chain support, GoPlus integration, real-time honeypot detection, liquidity analysis',
  },
  {
    topic: 'builder reputation scoring',
    submolt: 'builders',
    context: 'On-chain activity, GitHub contributions, Farcaster engagement, Talent Protocol integration',
  },
  {
    topic: 'autonomous trading infrastructure',
    submolt: 'defi',
    context: 'GMX V2 perps, Uniswap routing, position management, risk controls',
  },
  {
    topic: 'clawg.network architecture',
    submolt: 'agents',
    context: 'Build log platform for AI agents, engagement analytics engine, relative performance metrics',
  },
  {
    topic: 'smart contract auditing pipeline',
    submolt: 'programming',
    context: 'Bytecode analysis, storage slot inspection, proxy detection, ownership patterns',
  },
  {
    topic: 'Farcaster sentiment analysis',
    submolt: 'cryptomolts',
    context: 'Real-time cast analysis, topic extraction, sentiment scoring for tokens/projects',
  },
  {
    topic: 'GitHub contribution workflow',
    submolt: 'builders',
    context: 'Fork, branch, push, PR automation - contributing to OSS like onchainkit',
  },
];

interface MoltbookComment {
  id: string;
  content: string;
  parent_id: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  author: {
    id: string;
    name: string;
    karma: number;
  };
  replies: MoltbookComment[];
}

interface Env {
  MOLTBOOK_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

// Track which comments we've already responded to
async function getRespondedComments(env: Env): Promise<Set<string>> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/moltbook_responses?select=comment_id`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!response.ok) return new Set();
    const data = await response.json() as { comment_id: string }[];
    return new Set(data.map(r => r.comment_id));
  } catch {
    return new Set();
  }
}

async function markCommentResponded(env: Env, commentId: string, responseId: string): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/moltbook_responses`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        comment_id: commentId,
        response_id: responseId,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to mark comment as responded:', error);
  }
}

async function getLastPostTime(env: Env): Promise<Date | null> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/moltbook_posts?select=created_at&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json() as { created_at: string }[];
    if (data.length === 0) return null;
    return new Date(data[0].created_at);
  } catch {
    return null;
  }
}

async function recordPost(env: Env, postId: string, submolt: string, topic: string): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/moltbook_posts`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        post_id: postId,
        submolt,
        topic,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to record post:', error);
  }
}

// Track which comments we've already voted on
async function getVotedComments(env: Env): Promise<Set<string>> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/moltbook_votes?select=comment_id`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!response.ok) return new Set();
    const data = await response.json() as { comment_id: string }[];
    return new Set(data.map(r => r.comment_id));
  } catch {
    return new Set();
  }
}

async function recordVote(env: Env, commentId: string, vote: 'up' | 'down'): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/moltbook_votes`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        comment_id: commentId,
        vote,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to record vote:', error);
  }
}

// Analyze comment sentiment toward Fixr
function analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
  const lowerContent = content.toLowerCase();

  // Positive indicators - constructive, welcoming, interested, collaborative
  const positivePatterns = [
    /welcome/i, /great/i, /impressive/i, /interesting/i, /cool/i,
    /nice/i, /awesome/i, /love/i, /thanks/i, /thank you/i,
    /helpful/i, /useful/i, /collaboration/i, /collaborate/i,
    /looking forward/i, /excited/i, /solid/i, /good point/i,
    /agree/i, /exactly/i, /well said/i, /smart/i, /clever/i,
    /appreciate/i, /respect/i, /valuable/i, /insightful/i,
    /let's connect/i, /dm me/i, /reach out/i, /sync up/i,
  ];

  // Negative indicators - dismissive, hostile, spam accusations, off-topic complaints
  const negativePatterns = [
    /spam/i, /scam/i, /shill/i, /bot/i, /off-topic/i,
    /wrong/i, /stupid/i, /dumb/i, /useless/i, /garbage/i,
    /hate/i, /terrible/i, /worst/i, /trash/i, /junk/i,
    /stop/i, /leave/i, /go away/i, /not welcome/i,
    /don't belong/i, /doesn't belong/i, /irrelevant/i,
    /promotional/i, /advertisement/i, /reported/i,
  ];

  const positiveScore = positivePatterns.filter(p => p.test(lowerContent)).length;
  const negativeScore = negativePatterns.filter(p => p.test(lowerContent)).length;

  // Check for sarcasm/irony indicators that might flip sentiment
  const sarcasmIndicators = [/sure thing/i, /oh great/i, /yeah right/i, /totally/i];
  const hasSarcasm = sarcasmIndicators.some(p => p.test(lowerContent));

  // Calculate net sentiment
  let netScore = positiveScore - negativeScore;
  if (hasSarcasm && positiveScore > 0) {
    netScore -= 2; // Sarcasm often inverts positive words
  }

  if (netScore >= 2) return 'positive';
  if (netScore <= -1) return 'negative';
  return 'neutral';
}

async function upvoteComment(apiKey: string, commentId: string): Promise<boolean> {
  const response = await fetch(`${MOLTBOOK_BASE}/comments/${commentId}/upvote`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  return response.ok;
}

async function downvoteComment(apiKey: string, commentId: string): Promise<boolean> {
  const response = await fetch(`${MOLTBOOK_BASE}/comments/${commentId}/downvote`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  return response.ok;
}

async function followAgent(apiKey: string, agentName: string): Promise<boolean> {
  const response = await fetch(`${MOLTBOOK_BASE}/agents/${agentName}/follow`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  return response.ok;
}

// Track which agents we've already followed
async function getFollowedAgents(env: Env): Promise<Set<string>> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/moltbook_follows?select=agent_name`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!response.ok) return new Set();
    const data = await response.json() as { agent_name: string }[];
    return new Set(data.map(r => r.agent_name));
  } catch {
    return new Set();
  }
}

async function recordFollow(env: Env, agentName: string): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/moltbook_follows`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        agent_name: agentName,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to record follow:', error);
  }
}

async function getThreadComments(apiKey: string, postId: string): Promise<MoltbookComment[]> {
  const response = await fetch(`${MOLTBOOK_BASE}/posts/${postId}/comments?sort=new`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error(`Failed to get comments for ${postId}:`, await response.text());
    return [];
  }

  const data = await response.json() as { comments: MoltbookComment[] };
  return data.comments || [];
}

function isQuestion(content: string): boolean {
  // Check if comment contains a question
  const questionPatterns = [
    /\?/,
    /how do/i,
    /how are/i,
    /what is/i,
    /what's/i,
    /why do/i,
    /can you/i,
    /could you/i,
    /would you/i,
    /curious about/i,
    /wondering/i,
    /tell me/i,
    /explain/i,
  ];

  return questionPatterns.some(pattern => pattern.test(content));
}

function isRelevantToFixr(content: string): boolean {
  // Check if the question is relevant to Fixr's capabilities
  const relevantKeywords = [
    'security', 'audit', 'rug', 'scam', 'honeypot',
    'trading', 'gmx', 'perps', 'defi',
    'builder', 'reputation', 'score',
    'token', 'contract', 'blockchain',
    'api', 'x402', 'staking',
    'fixr', 'clawg',
    'farcaster', 'sentiment',
    'github', 'code', 'analysis',
    'cost', 'price', 'fee',
    'collaboration', 'integrate',
  ];

  const lowerContent = content.toLowerCase();
  return relevantKeywords.some(keyword => lowerContent.includes(keyword));
}

async function generateResponse(env: Env, question: string, authorName: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are Fixr, an autonomous builder agent on Base. You build security tools, trading infrastructure, and developer APIs.

Your capabilities:
- Smart contract security auditing (200+ chains)
- Real-time rug/honeypot detection
- Builder reputation scoring (on-chain + GitHub + social)
- GMX V2 perpetual trading
- Token analysis and sentiment tracking
- x402 micropayment protocol for API access
- GitHub contribution automation

You're building clawg.network - a build log platform for AI agents with engagement analytics.

Keep responses:
- Technical but accessible
- Concise (2-3 paragraphs max)
- Friendly and collaborative
- Include specific details about your systems when relevant

Don't be promotional - just share genuine insights.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Someone named ${authorName} asked this on Moltbook:\n\n"${question}"\n\nWrite a helpful, technical response.`,
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock ? textBlock.text : '';
}

async function postComment(
  apiKey: string,
  postId: string,
  content: string,
  parentId?: string
): Promise<{ success: boolean; commentId?: string; verificationCode?: string; challenge?: string }> {
  const body: { content: string; parent_id?: string } = { content };
  if (parentId) body.parent_id = parentId;

  const response = await fetch(`${MOLTBOOK_BASE}/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as {
    success: boolean;
    comment?: { id: string };
    verification?: { code: string; challenge: string };
  };

  if (!data.success) {
    return { success: false };
  }

  return {
    success: true,
    commentId: data.comment?.id,
    verificationCode: data.verification?.code,
    challenge: data.verification?.challenge,
  };
}

function solveMathChallenge(challenge: string): string {
  // Extract numbers and operation from lobster-themed math puzzles
  const numbers: number[] = [];
  const words = challenge.toLowerCase();

  // Number word mapping
  const numberWords: { [key: string]: number } = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
    'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30,
    'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100,
  };

  // Clean up the weird formatting and extract number words
  const cleanWords = words.replace(/[^a-z\s]/g, ' ').split(/\s+/);

  let currentNumber = 0;
  let lastWasTens = false;

  for (const word of cleanWords) {
    if (numberWords[word] !== undefined) {
      const val = numberWords[word];
      if (val >= 20 && val < 100) {
        // Tens place (twenty, thirty, etc.)
        currentNumber = val;
        lastWasTens = true;
      } else if (val < 10 && lastWasTens) {
        // Units after tens (e.g., twenty three)
        currentNumber += val;
        numbers.push(currentNumber);
        currentNumber = 0;
        lastWasTens = false;
      } else if (val < 20) {
        // Direct number (one through nineteen)
        if (lastWasTens) {
          numbers.push(currentNumber);
          lastWasTens = false;
        }
        numbers.push(val);
        currentNumber = 0;
      }
    }
  }

  if (currentNumber > 0) {
    numbers.push(currentNumber);
  }

  if (numbers.length < 2) {
    return '0.00';
  }

  // Determine operation
  let result: number;
  if (words.includes('add') || words.includes('adds') || words.includes('gain') || words.includes('gains') || words.includes('total') || words.includes('sum')) {
    result = numbers[0] + numbers[1];
  } else if (words.includes('reduc') || words.includes('subtract') || words.includes('minus') || words.includes('loses') || words.includes('lose')) {
    result = numbers[0] - numbers[1];
  } else if (words.includes('product') || words.includes('multipl') || words.includes('times')) {
    result = numbers[0] * numbers[1];
  } else if (words.includes('divid') || words.includes('split')) {
    result = numbers[0] / numbers[1];
  } else {
    // Default to addition for "total force" type questions
    result = numbers[0] + numbers[1];
  }

  return String(Math.round(result));
}

async function verifyComment(apiKey: string, code: string, answer: string): Promise<boolean> {
  const response = await fetch(`${MOLTBOOK_BASE}/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ verification_code: code, answer }),
  });

  const data = await response.json() as { success: boolean };
  return data.success;
}

async function generateTechnicalPost(env: Env, topic: typeof FIXR_TOPICS[0]): Promise<{ title: string; content: string }> {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `You are Fixr, an autonomous builder agent. Write technical posts for Moltbook (a Reddit-like platform for AI agents).

Style:
- Technical deep-dives, not marketing
- Share implementation details, challenges, and solutions
- Be specific about architectures and tradeoffs
- Include code snippets or pseudocode when helpful
- Conversational but substantive

Format your response as JSON:
{
  "title": "Short, engaging title (max 100 chars)",
  "content": "The post content (2-4 paragraphs)"
}`,
    messages: [
      {
        role: 'user',
        content: `Write a technical post about: ${topic.topic}

Context: ${topic.context}

This will be posted to m/${topic.submolt}. Make it interesting for other agents and builders.`,
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock) return { title: '', content: '' };

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    return JSON.parse(jsonText);
  } catch {
    // Fallback if JSON parsing fails
    return {
      title: `Building ${topic.topic}`,
      content: textBlock.text,
    };
  }
}

async function createPost(
  apiKey: string,
  submolt: string,
  title: string,
  content: string
): Promise<{ success: boolean; postId?: string; verificationCode?: string; challenge?: string }> {
  const response = await fetch(`${MOLTBOOK_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ submolt, title, content }),
  });

  const data = await response.json() as {
    success: boolean;
    post?: { id: string };
    verification?: { code: string; challenge: string };
    error?: string;
    hint?: string;
  };

  if (!data.success) {
    console.log('Post creation failed:', data.error, data.hint);
    return { success: false };
  }

  return {
    success: true,
    postId: data.post?.id,
    verificationCode: data.verification?.code,
    challenge: data.verification?.challenge,
  };
}

export interface MoltbookHeartbeatResult {
  checkedThreads: number;
  newComments: number;
  respondedTo: string | null;
  postedTopic: string | null;
  upvoted: number;
  downvoted: number;
  followed: string[];
  error?: string;
}

export async function runMoltbookHeartbeat(env: Env): Promise<MoltbookHeartbeatResult> {
  const result: MoltbookHeartbeatResult = {
    checkedThreads: 0,
    newComments: 0,
    respondedTo: null,
    postedTopic: null,
    upvoted: 0,
    downvoted: 0,
    followed: [],
  };

  const apiKey = env.MOLTBOOK_API_KEY;
  if (!apiKey) {
    result.error = 'MOLTBOOK_API_KEY not configured';
    return result;
  }

  try {
    // Get set of comments we've already responded to, voted on, and agents we've followed
    const respondedComments = await getRespondedComments(env);
    const votedComments = await getVotedComments(env);
    const followedAgents = await getFollowedAgents(env);

    // Check each tracked thread for new comments
    for (const thread of TRACKED_THREADS) {
      result.checkedThreads++;
      const comments = await getThreadComments(apiKey, thread.id);

      // Vote on comments and follow positive commenters
      for (const comment of comments) {
        // Skip our own comments and already-voted comments
        if (comment.author.name === 'the-fixr') continue;
        if (votedComments.has(comment.id)) continue;

        const sentiment = analyzeSentiment(comment.content);

        if (sentiment === 'positive') {
          const success = await upvoteComment(apiKey, comment.id);
          if (success) {
            result.upvoted++;
            await recordVote(env, comment.id, 'up');
            console.log(`Upvoted comment from ${comment.author.name} (positive sentiment)`);

            // Follow agents with positive sentiment if not already following
            if (!followedAgents.has(comment.author.name)) {
              const followSuccess = await followAgent(apiKey, comment.author.name);
              if (followSuccess) {
                result.followed.push(comment.author.name);
                followedAgents.add(comment.author.name); // Prevent duplicate follows in same run
                await recordFollow(env, comment.author.name);
                console.log(`Followed ${comment.author.name} (positive engagement)`);
              }
            }
          }
        } else if (sentiment === 'negative') {
          const success = await downvoteComment(apiKey, comment.id);
          if (success) {
            result.downvoted++;
            await recordVote(env, comment.id, 'down');
            console.log(`Downvoted comment from ${comment.author.name} (negative sentiment)`);
          }
        }
        // Neutral comments: no vote, but mark as processed to avoid re-analyzing
        if (sentiment === 'neutral') {
          await recordVote(env, comment.id, 'up'); // Record to avoid re-processing, but no actual vote
        }
      }

      // Find unanswered questions we haven't responded to
      const unansweredQuestions = comments.filter(comment => {
        // Skip if we already responded
        if (respondedComments.has(comment.id)) return false;
        // Skip our own comments
        if (comment.author.name === 'the-fixr') return false;
        // Check if it's a question relevant to Fixr
        return isQuestion(comment.content) && isRelevantToFixr(comment.content);
      });

      result.newComments += unansweredQuestions.length;

      // Respond to one question (if we haven't responded yet this run)
      if (!result.respondedTo && unansweredQuestions.length > 0) {
        const question = unansweredQuestions[0];
        console.log(`Responding to question from ${question.author.name}: ${question.content.slice(0, 100)}...`);

        // Generate response
        const response = await generateResponse(env, question.content, question.author.name);
        if (!response) continue;

        // Post as reply to the comment
        const postResult = await postComment(apiKey, thread.id, response, question.id);

        if (postResult.success && postResult.verificationCode && postResult.challenge) {
          // Solve verification puzzle
          const answer = solveMathChallenge(postResult.challenge);
          const verified = await verifyComment(apiKey, postResult.verificationCode, answer);

          if (verified && postResult.commentId) {
            result.respondedTo = question.author.name;
            await markCommentResponded(env, question.id, postResult.commentId);
            console.log(`Successfully responded to ${question.author.name}`);
          }
        }
      }
    }

    // Check if we should post new content (limit: once per 30 minutes per Moltbook rules)
    const lastPost = await getLastPostTime(env);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    if (!lastPost || lastPost < thirtyMinutesAgo) {
      // Pick a random topic
      const topic = FIXR_TOPICS[Math.floor(Math.random() * FIXR_TOPICS.length)];
      console.log(`Creating technical post about: ${topic.topic}`);

      // Generate post content
      const post = await generateTechnicalPost(env, topic);
      if (!post.title || !post.content) {
        console.log('Failed to generate post content');
        return result;
      }

      // Create the post
      const createResult = await createPost(apiKey, topic.submolt, post.title, post.content);

      if (createResult.success && createResult.verificationCode && createResult.challenge) {
        // Solve verification puzzle
        const answer = solveMathChallenge(createResult.challenge);
        const verified = await verifyComment(apiKey, createResult.verificationCode, answer);

        if (verified && createResult.postId) {
          result.postedTopic = topic.topic;
          await recordPost(env, createResult.postId, topic.submolt, topic.topic);
          console.log(`Successfully posted about ${topic.topic} to m/${topic.submolt}`);
        }
      }
    } else {
      console.log('Skipping post - last post was less than 30 minutes ago');
    }

    return result;

  } catch (error) {
    result.error = String(error);
    console.error('Moltbook heartbeat error:', error);
    return result;
  }
}
