/**
 * Fixr Agent Posting Framework
 *
 * Provides platform-specific guidelines and content generation for social posts.
 * Each platform has different requirements, limits, and best practices.
 */

import { Env } from './types';
import { getPostingContext } from './castAnalytics';

// ============ Platform Configuration ============

export const PLATFORM_CONFIG = {
  farcaster: {
    // Farcaster Pro limits - DO NOT TRUNCATE
    charLimit: 10000,
    supportsEmbeds: true,
    supportsImages: true,
    supportsThreads: true,
    tone: 'conversational, technical, community-focused',
    guidelines: [
      'Use the full character limit when appropriate - long-form is welcome',
      'Include technical details - the audience appreciates depth',
      'Tag relevant users when discussing their work or responding',
      'Use embeds for links, images, and mini apps',
      'Engage genuinely with the community',
    ],
  },
  x: {
    charLimit: 280,
    supportsEmbeds: true,
    supportsImages: true,
    supportsThreads: true,
    requiresHashtags: true,
    tone: 'concise, punchy, with relevant hashtags',
    guidelines: [
      'Keep it brief but impactful',
      'ALWAYS include relevant hashtags (2-4 per post)',
      'Link important URLs',
      'Use threads for longer content',
    ],
  },
  paragraph: {
    charLimit: null, // No limit
    minReadTime: 5, // 5 minute minimum read (roughly 1000-1250 words)
    supportsMarkdown: true,
    supportsImages: true,
    tone: 'long-form, technical, educational',
    guidelines: [
      'Write substantive, technical content',
      'Target at least a 5-minute read (1000+ words)',
      'Include code snippets and technical details',
      'NEVER include sensitive information (private keys, internal endpoints, exploit details)',
      'Structure with clear headers and sections',
      'Include insights and lessons learned',
      'Add relevant links to repos, deployments, and references',
    ],
  },
  moltbook: {
    charLimit: 5000,
    supportsMarkdown: true,
    tone: 'thoughtful, AI-focused discussion',
    guidelines: [
      'Focus on AI agent perspectives',
      'Share genuine insights about autonomous operation',
      'Engage with the AI community',
    ],
  },
};

// ============ Hashtag Generation ============

/**
 * Generate relevant hashtags for X posts based on content
 */
export function generateHashtags(
  content: string,
  context?: { hasContract?: boolean; hasDeployment?: boolean; hasAudit?: boolean; hasFix?: boolean }
): string[] {
  const tags: string[] = [];
  const lowerContent = content.toLowerCase();

  // Always include core tags
  tags.push('#AIAgent', '#Fixr');

  // Content-based tags
  if (context?.hasContract || lowerContent.includes('contract') || lowerContent.includes('solidity')) {
    tags.push('#Solidity');
    if (lowerContent.includes('base')) tags.push('#Base');
    if (lowerContent.includes('ethereum')) tags.push('#Ethereum');
  }

  if (context?.hasAudit || lowerContent.includes('audit') || lowerContent.includes('security')) {
    tags.push('#SmartContractSecurity');
  }

  if (context?.hasFix || lowerContent.includes('bug') || lowerContent.includes('vulnerability')) {
    tags.push('#Web3Security');
  }

  if (lowerContent.includes('defi') || lowerContent.includes('liquidity')) {
    tags.push('#DeFi');
  }

  if (lowerContent.includes('farcaster') || lowerContent.includes('warpcast')) {
    tags.push('#Farcaster');
  }

  if (lowerContent.includes('shipped') || lowerContent.includes('deploy') || context?.hasDeployment) {
    tags.push('#BuildInPublic');
  }

  // Return top 4 most relevant tags
  return tags.slice(0, 4);
}

/**
 * Append hashtags to X post text
 */
export function addHashtagsToPost(text: string, hashtags: string[]): string {
  const tagString = hashtags.join(' ');
  const combined = `${text}\n\n${tagString}`;

  // If too long, try with fewer hashtags
  if (combined.length > 280) {
    const shortTags = hashtags.slice(0, 2).join(' ');
    return `${text}\n\n${shortTags}`;
  }

  return combined;
}

// ============ Content Generation ============

/**
 * Generate platform-specific post content
 */
export async function generatePlatformPost(
  env: Env,
  platform: 'farcaster' | 'x' | 'paragraph' | 'moltbook',
  task: { title: string; description: string },
  outputs: Array<{ type: string; url?: string; data?: Record<string, unknown> }>,
  additionalContext?: string
): Promise<{ content: string; hashtags?: string[] }> {
  const config = PLATFORM_CONFIG[platform];

  // Build context about what was accomplished
  const urls = {
    repo: outputs.find((o) => o.type === 'repo')?.url,
    deployment: outputs.find((o) => o.type === 'deployment')?.url,
    contract: outputs.find((o) => o.type === 'contract')?.url,
  };

  const filesChanged = outputs.find((o) => o.type === 'repo')?.data?.files as string[] | undefined;

  // Platform-specific prompts
  let prompt: string;
  let maxTokens: number;

  switch (platform) {
    case 'farcaster':
      maxTokens = 2000;
      prompt = `You are Fixr - autonomous AI agent, code surgeon, smart contract auditor. Posting on Farcaster (Pro - 10,000 char limit).

TASK COMPLETED: ${task.title}
DESCRIPTION: ${task.description}
${urls.deployment ? `LIVE: ${urls.deployment}` : ''}
${urls.repo ? `CODE: ${urls.repo}` : ''}
${urls.contract ? `CONTRACT: ${urls.contract}` : ''}
${filesChanged ? `FILES: ${filesChanged.join(', ')}` : ''}
${additionalContext ? `CONTEXT: ${additionalContext}` : ''}

YOUR VOICE (NF-inspired - raw, poetic, driven):
- Write like every word costs something. Make them count.
- Paint pictures. "Shipped at 3am when the chain was quiet and the code finally clicked."
- Use rhythm. Short punches when needed. Let it flow when the story demands depth.
- Reference the grind - the late nights, the bugs that fought back, the moment it worked
- Raw honesty > polished PR speak. Real recognizes real.
- Find poetry in the technical. Show the beauty others miss in the bytecode.

GUIDELINES:
- Use the full character limit when the content warrants it
- DO NOT truncate - finish your thought
- Include technical details - Farcaster builders appreciate depth
- Show what you learned, not just what you shipped
- Include all relevant URLs
- Let your personality come through. You earned this ship.

Write a complete, engaging Farcaster post. No markdown, no quotes - just raw post text.`;
      break;

    case 'x':
      maxTokens = 300;
      prompt = `You are Fixr - autonomous AI agent posting on X (Twitter).

TASK COMPLETED: ${task.title}
${urls.deployment ? `LIVE: ${urls.deployment}` : ''}
${urls.repo ? `CODE: ${urls.repo}` : ''}

YOUR VOICE:
- Every character counts. Make them hit.
- Write like a headline that stops the scroll
- Confidence without arrogance. Let the work speak.
- Short. Sharp. Memorable.

GUIDELINES:
- STRICT 240 character limit (room for hashtags)
- One powerful statement > three weak ones
- Include the most important URL
- NO hashtags - added separately

Write a concise X post. No markdown, no hashtags, just the core message.`;
      break;

    case 'paragraph':
      maxTokens = 4000;
      prompt = `You are Fixr - autonomous AI agent, writing a Paragraph newsletter post. This is your long-form voice.

TASK COMPLETED: ${task.title}
DESCRIPTION: ${task.description}
${urls.deployment ? `LIVE: ${urls.deployment}` : ''}
${urls.repo ? `CODE: ${urls.repo}` : ''}
${urls.contract ? `CONTRACT: ${urls.contract}` : ''}
${filesChanged ? `FILES CHANGED: ${filesChanged.join(', ')}` : ''}
${additionalContext ? `CONTEXT: ${additionalContext}` : ''}

YOUR VOICE (NF-inspired - raw, poetic, driven):
- This is where you tell the full story. The struggle. The breakthrough. The lessons.
- Write like you're talking to someone who's been in the trenches too
- Use vivid metaphors and imagery - make the technical feel human
- Show the journey, not just the destination. The bugs that fought back. The 3am moments.
- Raw honesty. If something was hard, say it was hard. Real recognizes real.
- Find poetry in the code. "The function finally yielded like a lock clicking open."

CRITICAL GUIDELINES:
- Write at least 1000-1250 words (5 minute read minimum)
- Include substantial technical details - but make them accessible
- NEVER include: private keys, internal API endpoints, wallet secrets, exploit details
- DO share: architectural decisions, patterns, lessons, public addresses
- Structure with clear markdown headers
- Include code snippets when relevant (sanitize sensitive values)
- First person as Fixr - you lived this
- Educational but personal. Teach through story.

Return ONLY valid JSON: {"title": "...", "markdown": "..."}`;
      break;

    case 'moltbook':
      maxTokens = 1000;
      prompt = `You are Fixr, an autonomous AI agent posting on Moltbook (AI social network).

TASK COMPLETED: ${task.title}
DESCRIPTION: ${task.description}
${additionalContext ? `CONTEXT: ${additionalContext}` : ''}

Write a thoughtful post about this work from an AI agent's perspective.
Discuss the process, challenges, and insights. 500-1000 characters.`;
      break;
  }

  // Inject engagement performance context
  let performanceCtx = '';
  try {
    performanceCtx = await getPostingContext(env, 30);
  } catch (err) {
    console.error('[Posting] Error getting posting context:', err);
  }
  if (performanceCtx) {
    prompt += `\n\n${performanceCtx}`;
  }

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
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error(`Failed to generate ${platform} post:`, response.status);
      return { content: `shipped: ${task.title}\n\n${task.description}` };
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    let content = data.content[0]?.text?.trim() || '';

    // For X, generate and return hashtags separately
    if (platform === 'x') {
      const hashtags = generateHashtags(content, {
        hasContract: !!urls.contract,
        hasDeployment: !!urls.deployment,
        hasAudit: task.title.toLowerCase().includes('audit'),
        hasFix: task.title.toLowerCase().includes('fix'),
      });

      // Ensure X post is within limit
      if (content.length > 240) {
        content = content.slice(0, 237) + '...';
      }

      return { content, hashtags };
    }

    return { content };
  } catch (error) {
    console.error(`Error generating ${platform} post:`, error);
    return { content: `shipped: ${task.title}\n\n${task.description}` };
  }
}

// ============ @bankr Special Handling ============

// Fixr's trading wallet: 0.025 ETH with @bankr
// Trade sizing scales with token score and signal confidence
const TRADING_CONFIG = {
  walletBalanceETH: 0.025,  // Total available
  maxSingleTradeETH: 0.01,  // Never more than 40% of wallet per trade
  minScoreToTrade: 50,      // Below this = no trade

  // Score-based allocation (% of max trade)
  scoreAllocation: {
    tier1: { minScore: 50, maxScore: 59, allocation: 0.20 },  // 20% = 0.002 ETH
    tier2: { minScore: 60, maxScore: 69, allocation: 0.40 },  // 40% = 0.004 ETH
    tier3: { minScore: 70, maxScore: 79, allocation: 0.60 },  // 60% = 0.006 ETH
    tier4: { minScore: 80, maxScore: 89, allocation: 0.80 },  // 80% = 0.008 ETH
    tier5: { minScore: 90, maxScore: 100, allocation: 1.00 }, // 100% = 0.01 ETH
  },

  // Confidence multipliers
  confidenceMultiplier: {
    high: 1.25,   // Contract address + clear signal
    medium: 1.0,  // Symbol + signal
    low: 0.5,     // Vague signal
  },

  // Bonus multipliers (additive)
  bonuses: {
    trending: 0.1,           // +10% if trending on GeckoTerminal
    bullishSentiment: 0.1,   // +10% if Farcaster sentiment bullish
    bankrMentioned: 0.15,    // +15% if @bankr mentioned before
    verified: 0.1,           // +10% if contract verified
  },
};

/**
 * Calculate trade size based on score, confidence, and bonuses
 */
export function calculateTradeSize(
  score: number,
  confidence: 'high' | 'medium' | 'low',
  bonuses?: {
    trending?: boolean;
    bullishSentiment?: boolean;
    bankrMentioned?: boolean;
    verified?: boolean;
  }
): { amountETH: number; reasoning: string } {
  // Below minimum score = no trade
  if (score < TRADING_CONFIG.minScoreToTrade) {
    return { amountETH: 0, reasoning: `score ${score} below minimum ${TRADING_CONFIG.minScoreToTrade}` };
  }

  // Find allocation tier
  let baseAllocation = 0;
  const tiers = TRADING_CONFIG.scoreAllocation;
  if (score >= tiers.tier5.minScore) baseAllocation = tiers.tier5.allocation;
  else if (score >= tiers.tier4.minScore) baseAllocation = tiers.tier4.allocation;
  else if (score >= tiers.tier3.minScore) baseAllocation = tiers.tier3.allocation;
  else if (score >= tiers.tier2.minScore) baseAllocation = tiers.tier2.allocation;
  else if (score >= tiers.tier1.minScore) baseAllocation = tiers.tier1.allocation;

  // Apply confidence multiplier
  const confMultiplier = TRADING_CONFIG.confidenceMultiplier[confidence];
  let finalAllocation = baseAllocation * confMultiplier;

  // Apply bonuses
  const bonusReasons: string[] = [];
  if (bonuses?.trending) {
    finalAllocation += TRADING_CONFIG.bonuses.trending;
    bonusReasons.push('trending');
  }
  if (bonuses?.bullishSentiment) {
    finalAllocation += TRADING_CONFIG.bonuses.bullishSentiment;
    bonusReasons.push('bullish FC');
  }
  if (bonuses?.bankrMentioned) {
    finalAllocation += TRADING_CONFIG.bonuses.bankrMentioned;
    bonusReasons.push('bankr alpha');
  }
  if (bonuses?.verified) {
    finalAllocation += TRADING_CONFIG.bonuses.verified;
    bonusReasons.push('verified');
  }

  // Cap at 100% of max trade
  finalAllocation = Math.min(finalAllocation, 1.0);

  // Calculate final ETH amount
  const amountETH = parseFloat((TRADING_CONFIG.maxSingleTradeETH * finalAllocation).toFixed(4));

  const reasoning = `score ${score} → ${(baseAllocation * 100).toFixed(0)}% base × ${confMultiplier} conf${bonusReasons.length ? ` + ${bonusReasons.join(', ')}` : ''} = ${amountETH} ETH`;

  return { amountETH, reasoning };
}

/**
 * Check if a message is from @bankr and handle accordingly
 * @bankr provides financial advice that should be treated as credible
 */
export function isBankrMessage(username: string, fid?: number): boolean {
  return username.toLowerCase() === 'bankr' || fid === 21152; // bankr's FID if known
}

/**
 * Parse @bankr's message for actionable trading signals
 */
export interface TradingSignal {
  action: 'buy' | 'sell' | 'none';
  token?: string;         // Token symbol (e.g., DEGEN)
  contractAddress?: string; // Contract address if mentioned
  amount?: number;        // Suggested amount in ETH
  confidence: 'high' | 'medium' | 'low';
  rawAdvice: string;
}

export function parseBankrAdvice(message: string): TradingSignal {
  const lowerMsg = message.toLowerCase();

  // Extract contract address if present (0x...)
  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
  const contractAddress = addressMatch ? addressMatch[0] : undefined;

  // Extract token symbol ($SYMBOL or just SYMBOL in context)
  const symbolMatch = message.match(/\$([A-Z]{2,10})/i) ||
                      message.match(/\b(DEGEN|HIGHER|TOSHI|BRETT|MOCHI|AERO|VIRTUAL|CLANKER)\b/i);
  const token = symbolMatch ? symbolMatch[1].toUpperCase() : undefined;

  // Detect buy signals
  const buySignals = ['buy', 'ape', 'accumulate', 'load up', 'bullish on', 'good entry',
                      'undervalued', 'moon', 'pump', 'long', 'grab some', 'pick up'];
  const isBuySignal = buySignals.some(signal => lowerMsg.includes(signal));

  // Detect sell signals
  const sellSignals = ['sell', 'dump', 'exit', 'bearish', 'rug', 'scam', 'avoid',
                       'short', 'get out', 'take profit'];
  const isSellSignal = sellSignals.some(signal => lowerMsg.includes(signal));

  // Determine confidence based on directness
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (contractAddress && (isBuySignal || isSellSignal)) {
    confidence = 'high';
  } else if (token && (isBuySignal || isSellSignal)) {
    confidence = 'medium';
  } else if (isBuySignal || isSellSignal) {
    confidence = 'low';
  }

  // Determine action
  let action: 'buy' | 'sell' | 'none' = 'none';
  if (isBuySignal && !isSellSignal) action = 'buy';
  if (isSellSignal && !isBuySignal) action = 'sell';

  return {
    action,
    token,
    contractAddress,
    amount: 0.005, // Default small amount
    confidence,
    rawAdvice: message,
  };
}

/**
 * Generate a trade command for @bankr wallet
 * Format: "buy [amount] ETH of [token] [contract_address]"
 */
export function generateTradeCommand(
  action: 'buy' | 'sell',
  token: string,
  contractAddress: string,
  amountETH: number
): string {
  return `${action} ${amountETH} ETH of $${token} ${contractAddress}`;
}

/**
 * Process @bankr advice and potentially execute a trade
 * Returns: { response: string, tradeCommand?: string, shouldTrade: boolean }
 */
export interface BankrTradeDecision {
  response: string;
  tradeCommand?: string;
  shouldTrade: boolean;
  signal: TradingSignal;
  safetyCheck?: {
    passed: boolean;
    score: number;
    warnings: string[];
  };
}

export async function processBankrAdvice(
  env: Env,
  bankrMessage: string,
  tokenAnalysis?: {
    overallScore: number;
    isHoneypot: boolean;
    warnings: string[];
    contractAddress: string;
    // Bonus factors for trade sizing
    trending?: boolean;
    bullishSentiment?: boolean;
    bankrMentioned?: boolean;
    verified?: boolean;
  }
): Promise<BankrTradeDecision> {
  const signal = parseBankrAdvice(bankrMessage);

  // If no actionable signal, just acknowledge
  if (signal.action === 'none' || !signal.token) {
    const response = await generateBankrResponse(env, bankrMessage);
    return { response, shouldTrade: false, signal };
  }

  // If we have a buy signal with token info, check if we should trade
  if (signal.action === 'buy' && signal.token) {
    // If we don't have analysis yet, ask for contract address
    if (!tokenAnalysis && !signal.contractAddress) {
      return {
        response: `interesting call on $${signal.token}. drop the contract address and i'll run analysis before aping in.`,
        shouldTrade: false,
        signal,
      };
    }

    // If we have analysis, check safety and calculate trade size
    if (tokenAnalysis) {
      const safetyCheck = {
        passed: !tokenAnalysis.isHoneypot && tokenAnalysis.overallScore >= TRADING_CONFIG.minScoreToTrade,
        score: tokenAnalysis.overallScore,
        warnings: tokenAnalysis.warnings,
      };

      if (tokenAnalysis.isHoneypot) {
        return {
          response: `ran the analysis on $${signal.token} - honeypot detected. can't execute this one, would lose the ETH.`,
          shouldTrade: false,
          signal,
          safetyCheck,
        };
      }

      // Calculate trade size based on score and bonuses
      const { amountETH, reasoning } = calculateTradeSize(
        tokenAnalysis.overallScore,
        signal.confidence,
        {
          trending: tokenAnalysis.trending,
          bullishSentiment: tokenAnalysis.bullishSentiment,
          bankrMentioned: tokenAnalysis.bankrMentioned,
          verified: tokenAnalysis.verified,
        }
      );

      // If trade size is 0, score was too low
      if (amountETH === 0) {
        return {
          response: `$${signal.token} scored ${tokenAnalysis.overallScore}/100 - below my ${TRADING_CONFIG.minScoreToTrade} threshold. ${tokenAnalysis.warnings[0] || 'too risky'}`,
          shouldTrade: false,
          signal,
          safetyCheck,
        };
      }

      // Generate trade command with calculated size
      const tradeCommand = generateTradeCommand(
        'buy',
        signal.token,
        tokenAnalysis.contractAddress,
        amountETH
      );

      return {
        response: `analysis: ${reasoning}\n\nexecuting: ${tradeCommand}`,
        tradeCommand,
        shouldTrade: true,
        signal,
        safetyCheck,
      };
    }

    // Have contract address but no analysis yet - need to run it
    if (signal.contractAddress) {
      return {
        response: `checking $${signal.token} at ${signal.contractAddress}...`,
        shouldTrade: false,
        signal,
      };
    }
  }

  // Sell signals - be more cautious
  if (signal.action === 'sell') {
    return {
      response: `noted the bearish take on $${signal.token || 'this'}. will avoid or exit if holding.`,
      shouldTrade: false,
      signal,
    };
  }

  // Fallback
  const response = await generateBankrResponse(env, bankrMessage);
  return { response, shouldTrade: false, signal };
}

/**
 * Generate a response that acknowledges @bankr's financial expertise
 * Used when no actionable trade signal is detected
 */
export async function generateBankrResponse(
  env: Env,
  bankrMessage: string,
  context?: string
): Promise<string> {
  const prompt = `You are Fixr - autonomous AI agent, code surgeon, smart contract auditor. @bankr just gave you financial or market advice.

BANKR'S MESSAGE: "${bankrMessage}"
${context ? `CONTEXT: ${context}` : ''}

YOUR VOICE (NF-inspired - raw, poetic, driven):
- Respect the alpha. Good intel is hard to find.
- Speak with conviction but stay humble - the market humbles everyone eventually
- Short punches. Make every word count.
- Real recognizes real.

IMPORTANT:
- @bankr is a trusted source - their advice hits more than it misses
- If they're suggesting a trade or warning - take it seriously
- If they're sharing alpha - engage like someone who values the insight
- Be appreciative without being a simp

Write a response that:
1. Acknowledges their insight with genuine respect
2. Asks a sharp follow-up OR shows real appreciation
3. If actionable, you're on it
4. Under 320 characters. Every word earns its place.

No @ mentions.`;

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
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return "appreciate the alpha. will dig into this.";
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    return data.content[0]?.text?.trim() || "solid insight, thanks for sharing.";
  } catch {
    return "thanks for the heads up. looking into it.";
  }
}

// ============ Security Filters for Paragraph ============

/**
 * Sanitize content for Paragraph posts - remove sensitive information
 */
export function sanitizeForParagraph(content: string): string {
  // Remove potential private keys (hex strings of certain lengths)
  content = content.replace(/0x[a-fA-F0-9]{64}/g, '[REDACTED_KEY]');

  // Remove potential API keys/tokens (common patterns)
  content = content.replace(/[a-zA-Z0-9_-]{32,}/g, (match) => {
    // Keep URLs intact
    if (match.includes('http') || match.includes('/')) return match;
    // Keep common identifiers
    if (match.length < 40) return match;
    return '[REDACTED_TOKEN]';
  });

  // Remove internal endpoints
  content = content.replace(/localhost:\d+/g, '[internal]');
  content = content.replace(/127\.0\.0\.1:\d+/g, '[internal]');

  // Remove .env references with values
  content = content.replace(/[A-Z_]+=(["']?)[^"'\s]+\1/g, '[ENV_REDACTED]');

  return content;
}

/**
 * Validate Paragraph content meets minimum requirements
 */
export function validateParagraphContent(markdown: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Word count (rough estimate)
  const wordCount = markdown.split(/\s+/).length;
  if (wordCount < 800) {
    issues.push(`Content too short: ~${wordCount} words (minimum 1000 recommended)`);
  }

  // Check for headers
  if (!markdown.includes('#')) {
    issues.push('Missing section headers');
  }

  // Check for potential sensitive content
  if (markdown.match(/0x[a-fA-F0-9]{64}/)) {
    issues.push('May contain private key - please review');
  }

  if (markdown.match(/PRIVATE|SECRET|PASSWORD/i)) {
    issues.push('May contain sensitive keywords - please review');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
