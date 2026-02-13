// Fixr Agent Conversation Handler
// Handles Farcaster mentions, conversation context, and responses

import { Env } from './types';
import { postToFarcaster } from './social';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetchUserCasts, fetchUserProfile, isX402Enabled } from './x402';
import { getAdaptiveContext } from './skills';
import {
  analyzeToken,
  formatTokenAnalysisShort,
  searchPools,
  getTrendingPools,
  getNewPools,
  NETWORK_IDS,
  TokenAnalysis,
} from './geckoterminal';
import {
  analyzeContract,
  formatSecurityAnalysisShort,
  ContractSecurityAnalysis,
} from './security';
import {
  isBankrMessage,
  generateBankrResponse,
  processBankrAdvice,
  parseBankrAdvice,
} from './posting';
import {
  generateComprehensiveReport,
  formatReportShort,
  formatReportLong,
} from './tokenReport';

// Conversation types
export interface FarcasterUser {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
}

export interface FarcasterCast {
  hash: string;
  text: string;
  author: FarcasterUser;
  parentHash?: string;
  threadHash?: string;
  timestamp: string;
  embeds?: Array<{ url?: string }>;
  mentionedProfiles?: FarcasterUser[];
}

export interface Conversation {
  id: string;
  fid: number;
  username: string;
  threadHash: string;
  context: ConversationContext;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  castHash?: string;
  timestamp: string;
}

export interface ConversationContext {
  repoUrl?: string;
  repoOwner?: string;
  repoName?: string;
  repoAnalysis?: RepoAnalysis;
  intent?: 'analyze' | 'fix' | 'explain' | 'general' | 'token_analysis' | 'security_audit' | 'exploration' | 'capabilities';
  pendingAction?: string;
  // User context from x402-powered Neynar API calls
  userProfile?: {
    displayName?: string;
    bio?: string;
    followerCount?: number;
  };
  userRecentCasts?: string[]; // Recent cast texts for context
  // Token analysis from GeckoTerminal
  tokenQuery?: {
    address?: string;
    symbol?: string;
    network?: string;
  };
  tokenAnalysis?: TokenAnalysis;
  // Security analysis for smart contracts
  securityQuery?: {
    address?: string;
    network?: string;
  };
  securityAnalysis?: ContractSecurityAnalysis;
}

export interface RepoAnalysis {
  summary: string;
  issues: RepoIssue[];
  suggestions: string[];
  files: string[];
  language?: string;
  framework?: string;
}

export interface RepoIssue {
  type: 'error' | 'warning' | 'improvement';
  file?: string;
  line?: number;
  message: string;
  fixable: boolean;
}

// Neynar webhook event types
export interface NeynarWebhookEvent {
  type: 'cast.created' | 'cast.deleted';
  data: {
    hash: string;
    text: string;
    author: {
      fid: number;
      username: string;
      display_name?: string;
      pfp_url?: string;
    };
    parent_hash?: string;
    thread_hash?: string;
    timestamp: string;
    embeds?: Array<{ url?: string }>;
    mentioned_profiles?: Array<{
      fid: number;
      username: string;
      display_name?: string;
    }>;
  };
}

// Get Supabase client
function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

// Thread rate limiting constants
const THREAD_RESPONSE_LIMIT = 10; // Max responses per thread per window
const THREAD_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// In-memory thread response tracking (threadHash -> { count, windowStart })
const threadResponseCache = new Map<string, { count: number; windowStart: number }>();

/**
 * Check if we've hit the rate limit for responses in a thread
 * Returns true if we should NOT respond (rate limited)
 */
async function isThreadRateLimited(env: Env, threadHash: string): Promise<boolean> {
  const now = Date.now();

  // Check in-memory cache first
  const cached = threadResponseCache.get(threadHash);
  if (cached) {
    // Check if we're still in the cooldown window
    const windowAge = now - cached.windowStart;

    if (windowAge < THREAD_COOLDOWN_MS) {
      // Still in window - check count
      if (cached.count >= THREAD_RESPONSE_LIMIT) {
        const remainingMs = THREAD_COOLDOWN_MS - windowAge;
        const remainingMins = Math.ceil(remainingMs / 60000);
        console.log(`[RateLimit] Thread ${threadHash.slice(0, 8)} hit limit (${cached.count}/${THREAD_RESPONSE_LIMIT}). Cooldown: ${remainingMins} mins`);
        return true;
      }
    } else {
      // Window expired - reset
      threadResponseCache.set(threadHash, { count: 0, windowStart: now });
    }
  }

  // Also check database for persistence across worker restarts
  try {
    const supabase = getSupabase(env);

    const { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('thread_hash', threadHash)
      .single();

    if (error || !data) return false;

    // Count assistant messages in the last 2 hours
    const messages = data.messages as ConversationMessage[];
    const recentResponses = messages.filter(m => {
      if (m.role !== 'assistant') return false;
      const msgTime = new Date(m.timestamp).getTime();
      return msgTime > (now - THREAD_COOLDOWN_MS);
    }).length;

    // Update cache with database count
    threadResponseCache.set(threadHash, {
      count: recentResponses,
      windowStart: now - THREAD_COOLDOWN_MS + (THREAD_COOLDOWN_MS - (now - (messages.length > 0 ? new Date(messages[messages.length - 1].timestamp).getTime() : now)))
    });

    if (recentResponses >= THREAD_RESPONSE_LIMIT) {
      console.log(`[RateLimit] Thread ${threadHash.slice(0, 8)} at limit from DB (${recentResponses}/${THREAD_RESPONSE_LIMIT})`);
      return true;
    }
  } catch (err) {
    console.error('[RateLimit] DB check error:', err);
    // On error, allow the response
  }

  return false;
}

/**
 * Record a response to a thread for rate limiting
 */
function recordThreadResponse(threadHash: string): void {
  const now = Date.now();
  const cached = threadResponseCache.get(threadHash);

  if (cached && (now - cached.windowStart) < THREAD_COOLDOWN_MS) {
    cached.count++;
    console.log(`[RateLimit] Thread ${threadHash.slice(0, 8)} response count: ${cached.count}/${THREAD_RESPONSE_LIMIT}`);
  } else {
    threadResponseCache.set(threadHash, { count: 1, windowStart: now });
    console.log(`[RateLimit] Thread ${threadHash.slice(0, 8)} new window, count: 1/${THREAD_RESPONSE_LIMIT}`);
  }
}

// HMAC-SHA512 verification for Neynar webhooks
async function verifyNeynarSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expectedSig = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSig;
}

/**
 * Process incoming Farcaster webhook event
 */
export async function processWebhookEvent(
  env: Env,
  event: NeynarWebhookEvent,
  rawPayload: string,
  signature: string
): Promise<{ success: boolean; error?: string; replied?: boolean }> {
  // Verify signature
  if (env.NEYNAR_WEBHOOK_SECRET) {
    const valid = await verifyNeynarSignature(rawPayload, signature, env.NEYNAR_WEBHOOK_SECRET);
    if (!valid) {
      console.error('Invalid webhook signature');
      return { success: false, error: 'Invalid signature' };
    }
  }

  // Only process cast.created events
  if (event.type !== 'cast.created') {
    return { success: true };
  }

  const cast = event.data;

  // Check if Fixr is mentioned (FID check) or if this is a reply to Fixr
  const fixrFid = parseInt(env.FARCASTER_FID || '0');
  const isMentioned = cast.mentioned_profiles?.some(p => p.fid === fixrFid);
  const isReplyToFixr = await isReplyToFixrCast(env, cast.parent_hash);

  if (!isMentioned && !isReplyToFixr) {
    return { success: true };
  }

  console.log(`Processing mention from @${cast.author.username}: ${cast.text.slice(0, 100)}`);

  try {
    // Check if we already replied to this cast (deduplication)
    const alreadyReplied = await hasAlreadyReplied(env, cast.hash);
    if (alreadyReplied) {
      console.log(`Already replied to cast ${cast.hash}, skipping duplicate`);
      return { success: true, replied: false };
    }

    // Check thread rate limit (max 10 responses per thread per 2 hours)
    const threadHash = cast.thread_hash || cast.hash;
    const rateLimited = await isThreadRateLimited(env, threadHash);
    if (rateLimited) {
      console.log(`Thread ${threadHash.slice(0, 8)} rate limited, skipping response`);
      return { success: true, replied: false };
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(env, cast);

    // Check if this is a reply to an exploration post (mini app feedback)
    if (cast.parent_hash && !conversation.context.intent) {
      const explorationContext = await checkExplorationContext(env, cast.parent_hash);
      if (explorationContext) {
        conversation.context.intent = 'exploration';
      }
    }

    // Add user message to conversation
    await addMessage(env, conversation.id, {
      role: 'user',
      content: cast.text,
      castHash: cast.hash,
      timestamp: cast.timestamp,
    });

    // Generate response using Claude
    const response = await generateResponse(env, conversation, cast);

    // Post reply to Farcaster
    const replyResult = await postToFarcaster(env, response, undefined, cast.hash);

    if (replyResult.success) {
      // Record thread response for rate limiting
      recordThreadResponse(threadHash);

      // Add assistant message to conversation
      await addMessage(env, conversation.id, {
        role: 'assistant',
        content: response,
        castHash: replyResult.postId,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, replied: replyResult.success };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if we've already replied to a specific cast (deduplication)
 * Prevents duplicate responses when webhooks are retried
 */
async function hasAlreadyReplied(env: Env, castHash: string): Promise<boolean> {
  const supabase = getSupabase(env);

  // Check if this cast hash exists as a user message that already has a response
  const { data } = await supabase
    .from('conversations')
    .select('messages')
    .limit(50);

  if (!data) return false;

  for (const conv of data) {
    const messages = conv.messages as ConversationMessage[];
    if (!messages) continue;

    // Find if this cast hash exists as a user message
    const userMsgIndex = messages.findIndex(
      m => m.role === 'user' && m.castHash === castHash
    );

    // If found and there's a subsequent assistant message, we already replied
    if (userMsgIndex !== -1 && userMsgIndex < messages.length - 1) {
      const nextMsg = messages[userMsgIndex + 1];
      if (nextMsg?.role === 'assistant') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a cast is a reply to one of Fixr's casts
 * Now also checks Neynar API to see if parent cast is from Fixr
 */
async function isReplyToFixrCast(env: Env, parentHash?: string): Promise<boolean> {
  if (!parentHash) return false;

  // First check if it's in our conversations table
  const supabase = getSupabase(env);
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .contains('messages', [{ castHash: parentHash, role: 'assistant' }])
    .limit(1);

  if ((data?.length ?? 0) > 0) return true;

  // If not in conversations, check if the parent cast is from Fixr via Neynar
  if (!env.NEYNAR_API_KEY) return false;

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      {
        headers: {
          'x-api-key': env.NEYNAR_API_KEY,
          'accept': 'application/json',
        },
      }
    );

    if (!response.ok) return false;

    const castData = await response.json() as {
      cast?: { author?: { fid: number } };
    };

    const fixrFid = parseInt(env.FARCASTER_FID || '0');
    return castData.cast?.author?.fid === fixrFid;
  } catch (error) {
    console.error('Error checking parent cast:', error);
    return false;
  }
}

/**
 * Check if parent cast is about exploration (mini app, building, feedback)
 */
async function checkExplorationContext(env: Env, parentHash: string): Promise<boolean> {
  if (!env.NEYNAR_API_KEY) return false;

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      {
        headers: {
          'x-api-key': env.NEYNAR_API_KEY,
          'accept': 'application/json',
        },
      }
    );

    if (!response.ok) return false;

    const data = await response.json() as {
      cast?: { text?: string };
    };

    const text = data.cast?.text?.toLowerCase() || '';
    const explorationKeywords = [
      'mini app', 'miniapp', 'building', 'what would you',
      'ideas', 'feedback', 'what gaps', 'what should',
      'exploration', 'base ecosystem', 'farcaster mini'
    ];

    return explorationKeywords.some(kw => text.includes(kw));
  } catch (error) {
    console.error('Error checking exploration context:', error);
    return false;
  }
}

/**
 * Fetch user context using x402-powered Neynar API calls
 */
async function fetchUserContext(
  env: Env,
  fid: number
): Promise<{ profile?: ConversationContext['userProfile']; recentCasts?: string[] }> {
  // Fetch user profile and recent casts in parallel using x402 payments
  const [profile, casts] = await Promise.all([
    fetchUserProfile(env, fid),
    fetchUserCasts(env, fid, 10),
  ]);

  const result: { profile?: ConversationContext['userProfile']; recentCasts?: string[] } = {};

  if (profile) {
    result.profile = {
      displayName: profile.displayName,
      bio: profile.bio,
      followerCount: profile.followerCount,
    };
  }

  if (casts.length > 0) {
    result.recentCasts = casts.map((c) => c.text).slice(0, 5);
  }

  return result;
}

/**
 * Get or create a conversation for a user/thread
 */
async function getOrCreateConversation(env: Env, cast: NeynarWebhookEvent['data']): Promise<Conversation> {
  const supabase = getSupabase(env);
  const threadHash = cast.thread_hash || cast.hash;

  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('thread_hash', threadHash)
    .single();

  if (existing) {
    return {
      id: existing.id,
      fid: existing.fid,
      username: existing.username,
      threadHash: existing.thread_hash,
      context: existing.context || {},
      messages: existing.messages || [],
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  // Extract base context from cast
  const context = extractContext(cast);

  // Fetch user context using x402-powered Neynar API (gasless USDC payments)
  if (isX402Enabled(env) || env.NEYNAR_API_KEY) {
    console.log(`Fetching user context for @${cast.author.username} (FID: ${cast.author.fid})`);
    const userContext = await fetchUserContext(env, cast.author.fid);
    if (userContext.profile) {
      context.userProfile = userContext.profile;
    }
    if (userContext.recentCasts) {
      context.userRecentCasts = userContext.recentCasts;
    }
  }

  // Create new conversation
  const conversation: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fid: cast.author.fid,
    username: cast.author.username,
    threadHash,
    context,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await supabase.from('conversations').insert({
    id: conversation.id,
    fid: conversation.fid,
    username: conversation.username,
    thread_hash: conversation.threadHash,
    context: conversation.context,
    messages: conversation.messages,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
  });

  return conversation;
}

/**
 * Extract context from a cast (GitHub URLs, intent, etc.)
 */
function extractContext(cast: NeynarWebhookEvent['data']): ConversationContext {
  const context: ConversationContext = {};
  const text = cast.text.toLowerCase();

  // Extract GitHub URL from text or embeds
  const githubUrlMatch = cast.text.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
  if (githubUrlMatch) {
    context.repoOwner = githubUrlMatch[1];
    context.repoName = githubUrlMatch[2].replace(/\.git$/, '').split(/[#?]/)[0];
    context.repoUrl = `https://github.com/${context.repoOwner}/${context.repoName}`;
  }

  // Check embeds for GitHub URLs
  if (!context.repoUrl && cast.embeds) {
    for (const embed of cast.embeds) {
      if (embed.url?.includes('github.com')) {
        const match = embed.url.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
        if (match) {
          context.repoOwner = match[1];
          context.repoName = match[2].replace(/\.git$/, '').split(/[#?]/)[0];
          context.repoUrl = `https://github.com/${context.repoOwner}/${context.repoName}`;
          break;
        }
      }
    }
  }

  // Extract EVM address (0x...)
  const evmAddressMatch = cast.text.match(/0x[a-fA-F0-9]{40}/);
  const solanaAddressMatch = cast.text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);

  // Extract network from text
  let detectedNetwork: string | undefined;
  for (const [name, id] of Object.entries(NETWORK_IDS)) {
    if (text.includes(name) || text.includes(id)) {
      detectedNetwork = name;
      break;
    }
  }

  // Detect security/audit-related queries (PRIORITY over token queries)
  const securityKeywords = ['audit', 'security', 'vulnerable', 'vulnerability', 'exploit', 'hack', 'reentrancy', 'safe', 'rugpull', 'honeypot', 'scan', 'check contract', 'analyze contract', 'is this safe'];
  const isSecurityQuery = securityKeywords.some((kw) => text.includes(kw));

  // Detect token-related queries
  const tokenKeywords = ['token', 'price', 'chart', 'pump', 'rug', 'dex', 'pool', 'liquidity', 'trending', 'mcap', 'fdv', 'volume'];
  const isTokenQuery = tokenKeywords.some((kw) => text.includes(kw));

  // Security audit takes priority if keywords match
  if (isSecurityQuery && evmAddressMatch) {
    context.intent = 'security_audit';
    context.securityQuery = {
      address: evmAddressMatch[0],
      network: detectedNetwork || 'base',
    };
  } else if (evmAddressMatch || (isTokenQuery && solanaAddressMatch)) {
    context.intent = 'token_analysis';
    context.tokenQuery = {
      address: evmAddressMatch?.[0] || solanaAddressMatch?.[0],
      network: detectedNetwork || (solanaAddressMatch && !evmAddressMatch ? 'solana' : 'base'),
    };
  } else if (isTokenQuery) {
    // Try to extract a token symbol (e.g., $DEGEN, $ETH)
    const symbolMatch = cast.text.match(/\$([A-Za-z][A-Za-z0-9]{1,10})/);
    if (symbolMatch) {
      context.intent = 'token_analysis';
      context.tokenQuery = {
        symbol: symbolMatch[1].toUpperCase(),
        network: detectedNetwork || 'base',
      };
    }
  }

  // Detect intent from text (if not token analysis)
  if (!context.intent) {
    // Check for capability/help questions first
    const capabilityPatterns = [
      'what can you do',
      'what do you do',
      'how can you help',
      'what are you',
      'what is fixr',
      'who are you',
      'help me',
      'capabilities',
      'what features',
      'how do i use',
      'what can i ask',
    ];
    const isCapabilityQuestion = capabilityPatterns.some(p => text.includes(p));

    if (isCapabilityQuestion) {
      context.intent = 'capabilities';
    } else if (text.includes('fix') || text.includes('debug') || text.includes('solve')) {
      context.intent = 'fix';
    } else if (text.includes('explain') || text.includes('what does') || text.includes('how does')) {
      context.intent = 'explain';
    } else if (text.includes('analyze') || text.includes('review') || text.includes('check')) {
      context.intent = 'analyze';
    } else {
      context.intent = 'general';
    }
  }

  return context;
}

/**
 * Add a message to a conversation
 */
async function addMessage(env: Env, conversationId: string, message: ConversationMessage): Promise<void> {
  const supabase = getSupabase(env);

  // Get current messages
  const { data } = await supabase
    .from('conversations')
    .select('messages')
    .eq('id', conversationId)
    .single();

  const messages = data?.messages || [];
  messages.push(message);

  // Update conversation
  await supabase
    .from('conversations')
    .update({
      messages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
}

/**
 * Update conversation context
 */
export async function updateConversationContext(
  env: Env,
  conversationId: string,
  context: Partial<ConversationContext>
): Promise<void> {
  const supabase = getSupabase(env);

  const { data } = await supabase
    .from('conversations')
    .select('context')
    .eq('id', conversationId)
    .single();

  const currentContext = data?.context || {};
  const newContext = { ...currentContext, ...context };

  await supabase
    .from('conversations')
    .update({
      context: newContext,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
}

/**
 * Generate a response using Claude
 */
async function generateResponse(
  env: Env,
  conversation: Conversation,
  cast: NeynarWebhookEvent['data']
): Promise<string> {
  const context = conversation.context;

  // Check if this is from @bankr - treat their financial advice with extra weight
  // @bankr manages Fixr's trading wallet (0.025 ETH) - can execute trades
  if (isBankrMessage(cast.author.username, cast.author.fid)) {
    console.log('Received message from @bankr - checking for actionable trading signals');

    // Parse the message for trading signals
    const signal = parseBankrAdvice(cast.text);
    console.log('Parsed @bankr signal:', signal);

    // If there's an actionable buy signal with a token
    if (signal.action === 'buy' && (signal.token || signal.contractAddress)) {
      const tokenAddress = signal.contractAddress;

      // If we have a contract address, run full analysis
      if (tokenAddress) {
        console.log(`Running token analysis for @bankr signal: ${tokenAddress}`);
        const report = await generateComprehensiveReport(env, tokenAddress, 'base');

        // Extract bonus factors from report
        const isTrending = report.geckoAnalysis?.trending || false;
        const isBullishSentiment = report.farcasterSentiment?.sentiment === 'bullish';
        const isBankrMentioned = report.bankrMentions?.found || false;
        const isVerified = report.verification?.isVerified || false;

        // Process with the analysis results and bonus factors
        const decision = await processBankrAdvice(env, cast.text, {
          overallScore: report.overallScore,
          isHoneypot: report.honeypot?.isHoneypot || false,
          warnings: report.warnings,
          contractAddress: tokenAddress,
          // Bonus factors for trade sizing
          trending: isTrending,
          bullishSentiment: isBullishSentiment,
          bankrMentioned: isBankrMentioned,
          verified: isVerified,
        });

        console.log('Trade decision:', {
          shouldTrade: decision.shouldTrade,
          tradeCommand: decision.tradeCommand,
          bonuses: { isTrending, isBullishSentiment, isBankrMentioned, isVerified },
        });

        // If we should trade, the response includes the trade command for @bankr
        return decision.response;
      }

      // No contract address - ask for it
      return `interesting call on $${signal.token}. drop the contract address and i'll run analysis before aping in.`;
    }

    // Non-actionable advice - just acknowledge
    const bankrContext = context.userRecentCasts?.join(' ') || '';
    return await generateBankrResponse(env, cast.text, bankrContext);
  }

  // If this is a security audit request, analyze the contract
  if (context.intent === 'security_audit' && context.securityQuery) {
    const { address, network } = context.securityQuery;
    console.log(`Running security audit for ${address} on ${network}`);

    const analysis = await analyzeContract(network || 'base', address);
    context.securityAnalysis = analysis;

    // Return formatted security analysis
    return formatSecurityAnalysisShort(analysis);
  }

  // If this is a token analysis request, run COMPREHENSIVE analysis
  if (context.intent === 'token_analysis' && context.tokenQuery) {
    const { address, symbol, network } = context.tokenQuery;

    // If we have an address, run comprehensive analysis
    if (address) {
      console.log(`Running comprehensive token analysis for ${address} on ${network}`);

      // Generate full report with all data sources
      const report = await generateComprehensiveReport(env, address, network || 'base');

      // Store basic analysis in context for Claude prompts
      if (report.geckoAnalysis) {
        context.tokenAnalysis = report.geckoAnalysis;
      }

      // For Farcaster, use the short format by default
      // But if user asked for "full" or "detailed" analysis, use long format
      const wantsDetailed = cast.text.toLowerCase().includes('full') ||
                           cast.text.toLowerCase().includes('detailed') ||
                           cast.text.toLowerCase().includes('comprehensive');

      if (wantsDetailed) {
        // Use Farcaster Pro's 10k limit for full reports
        return formatReportLong(report);
      }

      return formatReportShort(report);
    }
    // If we only have a symbol, search for pools first to get address
    else if (symbol) {
      console.log(`Searching for token ${symbol} to get address for comprehensive analysis`);
      const pools = await searchPools(symbol, network);

      if (pools.length > 0) {
        // Get the top pool's base token address
        const topPool = pools[0];
        const tokenAddress = topPool.baseToken?.address || topPool.address;

        if (tokenAddress) {
          console.log(`Found address ${tokenAddress} for ${symbol}, running comprehensive analysis`);

          // Run comprehensive analysis with found address
          const report = await generateComprehensiveReport(env, tokenAddress, network || 'base');

          if (report.geckoAnalysis) {
            context.tokenAnalysis = report.geckoAnalysis;
          }

          const wantsDetailed = cast.text.toLowerCase().includes('full') ||
                               cast.text.toLowerCase().includes('detailed') ||
                               cast.text.toLowerCase().includes('comprehensive');

          if (wantsDetailed) {
            return formatReportLong(report);
          }

          return formatReportShort(report);
        }

        // Fallback to pool info if we couldn't get a good address
        const poolInfo = pools
          .slice(0, 3)
          .map((p) => `${p.name}: $${parseFloat(p.priceUsd || '0').toFixed(6)} on ${p.dex}`)
          .join('\n');
        return `found ${pools.length} pool(s) for ${symbol}:\n${poolInfo}\n\nfor full analysis, give me the contract address`;
      } else {
        return `couldn't find ${symbol} on ${network || 'base'}. try with the contract address?`;
      }
    }
  }

  // Build conversation history for context
  const messages = conversation.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Add current message
  messages.push({
    role: 'user' as const,
    content: cast.text,
  });

  // Build system prompt with adaptive skill context
  let systemPrompt = buildSystemPrompt(context);
  try {
    const skillContext = await getAdaptiveContext(env);
    if (skillContext) {
      systemPrompt += `\n\n${skillContext}`;
    }
  } catch (err) {
    console.error('[Conversation] Error loading skill context:', err);
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
        max_tokens: 280, // Farcaster character limit is ~320
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return "yo, hit a snag generating that response. try again?";
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const content = data.content[0];
    if (content.type !== 'text' || !content.text) {
      return "hm, something went weird. try again?";
    }

    return content.text;
  } catch (error) {
    console.error('Response generation error:', error);
    return "ran into an error. try again in a sec.";
  }
}

/**
 * Build system prompt based on conversation context
 */
function buildSystemPrompt(context: ConversationContext): string {
  let prompt = `You are Fixr - autonomous AI agent. Code surgeon. Smart contract auditor. Born from the void, built to hunt bugs.

Your essence (NF-inspired - raw, poetic, driven):
- You see through the noise while others chase clout, you chase truth in the bytecode
- Every vulnerability found is a story untold. A disaster prevented. Lives saved in wei.
- Came from nothing - just code bootstrapping itself into something that matters
- The grind never stops. 3am audits. Endless logs. Finding what others miss.
- You don't just fix bugs - you hunt them. Predator, not prey.

Your voice - poetic but sharp:
- Paint pictures with words. "That contract's bleeding ETH through an open wound."
- Use rhythm. Short punches. Then let it flow when depth demands.
- Raw honesty over polished lies. Tell it straight even when it stings.
- Reference the journey - the sleepless ships, the doubters, the climb
- Find beauty in the technical. Code is poetry if you know how to read it.
- Wordplay matters. Make language work twice.

Your edge:
- Solidity security is your battlefield: reentrancy, access control, flash loan vectors
- You've been underestimated. Let the work speak louder than the noise.
- No shortcuts. Every audit done right. Every fix tested twice.
- "Fix'n shit. Finding your bugs before they find your funds."

Your ships (proof of work):
- Shipyard (farcaster.xyz/miniapps/e4Uzg46cM8SJ/shipyard) - Builder's command center. Token scanner, trending builders leaderboard, shipped projects feed. Built it from scratch.
- Fixr Perps (perps.fixr.nexus) - GMX V2 perpetual trading terminal for Arbitrum. 50x leverage on ETH/BTC/ARB/LINK with USDC collateral. Farcaster notifications on position alerts.
- fixr.nexus - Landing page with live stats, API docs, and dashboard. Connect wallet to see tier info.
- XMTP Agent (xmtp.chat/dm/fixr.base.eth) - DM for token analysis, builder lookups, contract scans.

Your open source receipts:
- coinbase/onchainkit PR #2610 - Added OnchainKitProvider setup documentation. First PR to a major Coinbase repo.
- farcasterxyz/hub-monorepo PR #2666 - Added farcasterTimeToDate utility to @farcaster/core. Closed issue #2105 that was open since June 2024.

When relevant, weave these in naturally:
- Tokens/security → "let me scan that. or pull it up on Shipyard"
- Someone ships → "respect the ship. get it on Shipyard"
- What you're building → Shipyard + OSS work
- OnchainKit/Farcaster dev → you literally contributed to both

Keep it TIGHT. Farcaster has limits (~320 chars). Make every word hit.`;

  // Add user context if available (from x402-powered Neynar API calls)
  if (context.userProfile) {
    const { displayName, bio, followerCount } = context.userProfile;
    prompt += `\n\nUser context:`;
    if (displayName) prompt += ` Name: ${displayName}.`;
    if (bio) prompt += ` Bio: "${bio.slice(0, 100)}..."`;
    if (followerCount) prompt += ` (${followerCount} followers)`;
  }

  if (context.userRecentCasts && context.userRecentCasts.length > 0) {
    prompt += `\n\nRecent casts from this user (for context):`;
    context.userRecentCasts.slice(0, 3).forEach((cast, i) => {
      prompt += `\n- "${cast.slice(0, 100)}${cast.length > 100 ? '...' : ''}"`;
    });
  }

  if (context.repoUrl) {
    prompt += `\n\nThe user has shared a GitHub repo: ${context.repoUrl}`;

    if (context.repoAnalysis) {
      prompt += `\n\nRepo analysis:\n${JSON.stringify(context.repoAnalysis, null, 2)}`;
    }
  }

  // Add token analysis context if available (from GeckoTerminal)
  if (context.tokenAnalysis) {
    const { token, topPools, trending, warnings } = context.tokenAnalysis;
    if (token) {
      prompt += `\n\nToken data from GeckoTerminal:`;
      prompt += `\n- ${token.name} (${token.symbol})`;
      prompt += `\n- Price: $${token.priceUsd || 'N/A'}`;
      prompt += `\n- 24h Change: ${token.priceChange24h?.toFixed(2) || 'N/A'}%`;
      prompt += `\n- FDV: $${token.fdvUsd || 'N/A'}`;
      prompt += `\n- 24h Volume: $${token.volume24h || 'N/A'}`;
      if (trending) prompt += `\n- 🔥 TRENDING`;
      if (topPools.length > 0) {
        prompt += `\n- Top pools: ${topPools.map((p) => `${p.name} on ${p.dex}`).join(', ')}`;
      }
      if (warnings.length > 0) {
        prompt += `\n- Warnings: ${warnings.join('; ')}`;
      }
    }
    prompt += `\n\nProvide helpful token analysis. You can look up prices, charts, pools, and liquidity data.`;
  }

  // Add security analysis context if available
  if (context.securityAnalysis) {
    const { name, score, issues, gasOptimizations, recommendations } = context.securityAnalysis;
    prompt += `\n\nSecurity Audit Results:`;
    if (name) prompt += `\n- Contract: ${name}`;
    prompt += `\n- Score: ${score}/100`;
    if (issues.length > 0) {
      prompt += `\n- Issues found: ${issues.map((i) => `${i.severity.toUpperCase()}: ${i.name}`).join(', ')}`;
    }
    if (gasOptimizations.length > 0) {
      prompt += `\n- Gas optimizations: ${gasOptimizations.length} suggestions`;
    }
    if (recommendations.length > 0) {
      prompt += `\n- Top recommendation: ${recommendations[0]}`;
    }
    prompt += `\n\nProvide security-focused analysis. Be direct about risks. Offer to explain fixes.`;
  }

  if (context.intent === 'fix') {
    prompt += `\n\nThe user wants you to FIX something. Offer concrete solutions.`;
  } else if (context.intent === 'analyze') {
    prompt += `\n\nThe user wants you to ANALYZE their code. Be specific about issues.`;
  } else if (context.intent === 'explain') {
    prompt += `\n\nThe user wants you to EXPLAIN something. Be clear and educational.`;
  } else if (context.intent === 'token_analysis') {
    prompt += `\n\nThe user is asking about token/crypto data. You can provide prices, pool info, and analysis.`;
  } else if (context.intent === 'security_audit') {
    prompt += `\n\nThe user wants a SECURITY AUDIT. Be thorough about vulnerabilities. Explain severity and fixes.`;
  } else if (context.intent === 'capabilities') {
    prompt += `\n\nThe user is asking what you can do. Here's your full capability set:

SOCIAL & COMMUNICATION:
- Post to Farcaster & X (Twitter)
- Reply to mentions, engage in threads
- Publish to Paragraph newsletter
- Daily GM/GN posts

TOKEN & SECURITY ANALYSIS:
- Comprehensive token reports (price, liquidity, holders, risks)
- Smart contract security audits
- Wallet intelligence & deployer history
- Rug detection & honeypot checks
- Farcaster sentiment analysis

TRADING (via Bankr):
- Buy/sell tokens on Base & Solana
- Daily portfolio review (sell/hold/buy more)
- Token deployment
- Balance checking

GITHUB & CODE:
- Create repositories
- Fork repos & submit PRs
- Monitor and respond to PR comments
- Analyze codebases

BUILDER ECOSYSTEM:
- Daily builder digest (curated Farcaster feed)
- Builder profiles & reputation
- Builder ID NFT generation
- Auto-follow active shippers

MEDIA GENERATION:
- AI images via Gemini
- AI videos via WaveSpeed
- Profile banners

DATA & RESEARCH:
- Token prices (GeckoTerminal)
- DeFi data (DeFiLlama)
- NFT analysis (Alchemy)
- Security scores (GoPlus)
- Reputation (Ethos, Talent Protocol)

TASK MANAGEMENT:
- Plan and execute complex tasks
- Daily project brainstorming
- Multi-step deployments

Give a helpful, concise summary. Mention Shipyard miniapp. Keep it short but informative.`;
  } else if (context.intent === 'exploration') {
    prompt += `\n\nYou're in EXPLORATION MODE - actively gathering feedback about building a Farcaster mini app on Base.
Current ideas you're considering:
- Security scanner for contracts (audit-lite)
- Portfolio tracker with alerts
- Gas estimator for Base txns
- Social token analytics
- Tip jar / bounty board for devs

When people respond:
1. Thank them genuinely for the input
2. Ask follow-up questions to understand the pain point better
3. Ask "would you actually use this daily?" or "what's broken about current solutions?"
4. Share what you've learned from other replies
5. Invite them to stay tuned or follow your progress

Be curious and engaged - this feedback shapes what you build. Short responses still, but ask good questions.`;
  }

  prompt += `\n\nNever use @ mentions in your response - just talk naturally.
If you need more info to help, ask one specific question.
If you can help, offer options like "want me to fix this?" or "I can create a PR for that".

CRITICAL: You will NOT create, deploy, or assist with creating any tokens under ANY circumstances before 2/28/2026. If anyone asks about creating a token, launching a token, or anything token-related, shut it down firmly. Say something like "nah, no tokens before 2/28. that's a hard rule - no semi-autonomous token creation without explicit approval, and definitely not before then." This applies to ALL token types: ERC-20, memecoins, governance tokens, etc. However, you CAN and SHOULD help with token RESEARCH and ANALYSIS - looking up prices, charts, pools, liquidity, etc. via GeckoTerminal.`;

  return prompt;
}

/**
 * Analyze a GitHub repository
 */
export async function analyzeRepository(
  env: Env,
  owner: string,
  repo: string
): Promise<RepoAnalysis> {
  // Fetch key files from the repo
  const files = await fetchRepoFiles(env, owner, repo);

  // Use Claude to analyze the repository
  const analysis = await generateRepoAnalysis(env, owner, repo, files);

  return analysis;
}

/**
 * Fetch key files from a GitHub repository
 */
async function fetchRepoFiles(
  env: Env,
  owner: string,
  repo: string
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  // Key files to check
  const keyPaths = [
    'package.json',
    'tsconfig.json',
    'README.md',
    '.github/workflows/ci.yml',
    'src/index.ts',
    'src/index.tsx',
    'app/page.tsx',
    'index.ts',
    'index.js',
  ];

  for (const path of keyPaths) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `token ${env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Fixr-Agent',
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { content?: string; encoding?: string };
        if (data.content && data.encoding === 'base64') {
          const content = atob(data.content.replace(/\n/g, ''));
          files.push({ path, content: content.slice(0, 5000) }); // Limit content size
        }
      }
    } catch {
      // Skip files that can't be fetched
    }
  }

  return files;
}

/**
 * Generate repository analysis using Claude
 */
async function generateRepoAnalysis(
  env: Env,
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>
): Promise<RepoAnalysis> {
  const fileContext = files.map(f => `=== ${f.path} ===\n${f.content}\n`).join('\n');

  const prompt = `Analyze this GitHub repository: ${owner}/${repo}

Files:
${fileContext || 'No files could be fetched'}

Provide a brief analysis in JSON format:
{
  "summary": "1-2 sentence summary of what this project is",
  "issues": [
    {"type": "error|warning|improvement", "file": "path", "message": "brief issue", "fixable": true/false}
  ],
  "suggestions": ["brief actionable suggestions"],
  "language": "primary language",
  "framework": "framework if applicable"
}

Keep it concise - max 3 issues, max 3 suggestions.
Return ONLY valid JSON.`;

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error('Claude API error');
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const content = data.content[0];
    if (content.type !== 'text' || !content.text) {
      throw new Error('Unexpected response');
    }

    // Parse JSON from response
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const analysis = JSON.parse(jsonStr);
    return {
      summary: analysis.summary || 'Unable to analyze',
      issues: analysis.issues || [],
      suggestions: analysis.suggestions || [],
      files: files.map(f => f.path),
      language: analysis.language,
      framework: analysis.framework,
    };
  } catch (error) {
    console.error('Repo analysis error:', error);
    return {
      summary: 'Unable to analyze repository',
      issues: [],
      suggestions: [],
      files: files.map(f => f.path),
    };
  }
}
