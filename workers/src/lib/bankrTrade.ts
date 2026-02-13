/**
 * Bankr Trading System - Daily Market Intelligence & Portfolio Management
 *
 * Once daily:
 * 1. Engage with @bankr on Farcaster
 * 2. Ask about Base & Solana markets
 * 3. Two follow-up questions for deeper intel
 * 4. Analyze all mentioned tokens (sentiment + security + price)
 * 5. Decide: buy/sell/hold based on analysis
 * 6. Track decisions and outcomes for system improvement
 */

import Anthropic from '@anthropic-ai/sdk';
import { recordOutcome, classifyError } from './outcomes';

const NEYNAR_API = 'https://api.neynar.com/v2';
const BANKR_FID = 886870; // @bankr's FID

interface Env {
  NEYNAR_API_KEY: string;
  FARCASTER_SIGNER_UUID: string;
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

interface TokenMention {
  symbol: string;
  address?: string;
  chain: 'base' | 'solana' | 'unknown';
  context: string;
}

interface TokenAnalysis {
  symbol: string;
  address?: string;
  chain: string;
  sentiment: {
    score: number;      // -1 to 1
    volume: number;     // Number of mentions
    trending: boolean;
  };
  security: {
    safe: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
  };
  price: {
    current: number;
    change24h: number;
    change7d: number;
    volume24h: number;
    liquidity: number;
  };
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;   // 0 to 1
  reasoning: string;
}

interface TradeDecision {
  id: string;
  timestamp: string;

  // Context
  bankrConversation: {
    initialQuestion: string;
    bankrResponse: string;
    followUp1: string;
    followUp1Response: string;
    followUp2: string;
    followUp2Response: string;
  };

  // Analysis
  tokensAnalyzed: TokenAnalysis[];

  // Decision
  action: 'buy' | 'sell' | 'hold' | 'rebalance';
  tokens: {
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    amount?: number;
    reasoning: string;
  }[];

  // Prices at decision time (for tracking)
  pricesAtDecision: Record<string, number>;

  // Outcome tracking (filled in later)
  pricesAfter24h?: Record<string, number>;
  pricesAfter7d?: Record<string, number>;
  pnl24h?: number;
  pnl7d?: number;
  wasSuccessful?: boolean;
}

// ============ Farcaster Interaction ============

async function castToFarcaster(env: Env, text: string, replyTo?: string): Promise<{ hash: string }> {
  const body: { signer_uuid: string; text: string; parent?: string } = {
    signer_uuid: env.FARCASTER_SIGNER_UUID,
    text,
  };

  if (replyTo) {
    body.parent = replyTo;
  }

  const response = await fetch(`${NEYNAR_API}/farcaster/cast`, {
    method: 'POST',
    headers: {
      'api_key': env.NEYNAR_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { cast: { hash: string } };
  return { hash: data.cast.hash };
}

async function getCastReplies(env: Env, castHash: string, maxWaitMs = 300000): Promise<string[]> {
  // Wait for replies, polling every 30 seconds for up to 5 minutes
  const startTime = Date.now();
  const replies: string[] = [];

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s

    const response = await fetch(
      `${NEYNAR_API}/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=1`,
      {
        headers: { 'api_key': env.NEYNAR_API_KEY },
      }
    );

    const data = await response.json() as {
      conversation: {
        cast: {
          direct_replies?: Array<{
            author: { fid: number };
            text: string;
            hash: string;
          }>;
        };
      };
    };

    const bankrReplies = data.conversation?.cast?.direct_replies?.filter(
      reply => reply.author.fid === BANKR_FID
    ) || [];

    if (bankrReplies.length > 0) {
      return bankrReplies.map(r => r.text);
    }
  }

  return replies;
}

async function waitForBankrReply(env: Env, castHash: string): Promise<{ text: string; hash: string } | null> {
  // Poll for bankr's reply
  const maxWaitMs = 300000; // 5 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, 20000)); // Wait 20s

    try {
      const response = await fetch(
        `${NEYNAR_API}/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=1`,
        {
          headers: { 'api_key': env.NEYNAR_API_KEY },
        }
      );

      const data = await response.json() as {
        conversation: {
          cast: {
            direct_replies?: Array<{
              author: { fid: number };
              text: string;
              hash: string;
            }>;
          };
        };
      };

      const bankrReply = data.conversation?.cast?.direct_replies?.find(
        reply => reply.author.fid === BANKR_FID
      );

      if (bankrReply) {
        return { text: bankrReply.text, hash: bankrReply.hash };
      }
    } catch (error) {
      console.error('Error polling for bankr reply:', error);
    }
  }

  return null;
}

// ============ Token Extraction ============

function extractTokenMentions(text: string): TokenMention[] {
  const mentions: TokenMention[] = [];

  // Common token patterns
  const patterns = [
    // $SYMBOL format
    /\$([A-Z]{2,10})\b/gi,
    // Token addresses (0x... for Base, various for Solana)
    /(0x[a-fA-F0-9]{40})/g,
    // Explicit mentions like "TOKEN token" or "TOKEN coin"
    /\b([A-Z]{2,10})\s+(?:token|coin|memecoin)\b/gi,
  ];

  // Chain context detection
  const isBaseContext = /base|ethereum|evm|0x/i.test(text);
  const isSolanaContext = /solana|sol|pump\.fun|raydium/i.test(text);

  const defaultChain = isBaseContext ? 'base' : (isSolanaContext ? 'solana' : 'unknown');

  // Extract $SYMBOL mentions
  const symbolMatches = text.matchAll(/\$([A-Z]{2,10})\b/gi);
  for (const match of symbolMatches) {
    const symbol = match[1].toUpperCase();
    // Skip common non-tokens
    if (['USD', 'ETH', 'SOL', 'BTC', 'USDC', 'USDT'].includes(symbol)) continue;

    mentions.push({
      symbol,
      chain: defaultChain,
      context: text.slice(Math.max(0, match.index! - 50), match.index! + 50),
    });
  }

  // Extract addresses
  const addressMatches = text.matchAll(/(0x[a-fA-F0-9]{40})/g);
  for (const match of addressMatches) {
    mentions.push({
      symbol: 'UNKNOWN',
      address: match[1],
      chain: 'base',
      context: text.slice(Math.max(0, match.index! - 50), match.index! + 50),
    });
  }

  // Dedupe by symbol
  const seen = new Set<string>();
  return mentions.filter(m => {
    const key = m.symbol + (m.address || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============ Token Analysis ============

async function analyzeToken(env: Env, token: TokenMention): Promise<TokenAnalysis | null> {
  try {
    // Get sentiment from Farcaster
    const sentimentResponse = await fetch(
      `https://agent.fixr.nexus/api/v1/sentiment/${token.symbol}`,
      { headers: { 'X-Wallet-Address': '0x0000000000000000000000000000000000000000' } }
    );
    const sentimentData = sentimentResponse.ok
      ? await sentimentResponse.json() as { score: number; mentions: number; trending: boolean }
      : { score: 0, mentions: 0, trending: false };

    // Get security analysis if we have an address
    let security = { safe: true, riskLevel: 'low' as const, flags: [] as string[] };
    if (token.address) {
      const rugResponse = await fetch(
        `https://agent.fixr.nexus/api/v1/rug/detect/${token.address}`,
        { headers: { 'X-Wallet-Address': '0x0000000000000000000000000000000000000000' } }
      );
      if (rugResponse.ok) {
        const rugData = await rugResponse.json() as { isRug: boolean; riskLevel: string; flags: string[] };
        security = {
          safe: !rugData.isRug,
          riskLevel: rugData.riskLevel as 'low' | 'medium' | 'high' | 'critical',
          flags: rugData.flags || [],
        };
      }
    }

    // Get price data from GeckoTerminal (mock for now, would integrate real API)
    const price = {
      current: 0,
      change24h: 0,
      change7d: 0,
      volume24h: 0,
      liquidity: 0,
    };

    // Generate recommendation using Claude
    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const analysisPrompt = `Analyze this token for trading:

Token: ${token.symbol}
Chain: ${token.chain}
Context from Bankr: "${token.context}"

Sentiment:
- Score: ${sentimentData.score} (-1 to 1)
- Mentions: ${sentimentData.mentions}
- Trending: ${sentimentData.trending}

Security:
- Safe: ${security.safe}
- Risk Level: ${security.riskLevel}
- Flags: ${security.flags.join(', ') || 'None'}

Based on this data, provide:
1. A recommendation: strong_buy, buy, hold, sell, or strong_sell
2. Confidence level: 0 to 1
3. Brief reasoning (1-2 sentences)

Respond in JSON format:
{"recommendation": "...", "confidence": 0.X, "reasoning": "..."}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    let recommendation = { recommendation: 'hold', confidence: 0.5, reasoning: 'Insufficient data' };

    if (textBlock) {
      try {
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recommendation = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Use default
      }
    }

    return {
      symbol: token.symbol,
      address: token.address,
      chain: token.chain,
      sentiment: {
        score: sentimentData.score,
        volume: sentimentData.mentions,
        trending: sentimentData.trending,
      },
      security,
      price,
      recommendation: recommendation.recommendation as TokenAnalysis['recommendation'],
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
    };
  } catch (error) {
    console.error(`Error analyzing token ${token.symbol}:`, error);
    return null;
  }
}

// ============ Decision Engine ============

async function generateTradeDecision(
  env: Env,
  conversation: TradeDecision['bankrConversation'],
  analyses: TokenAnalysis[]
): Promise<TradeDecision['tokens']> {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const prompt = `You are Fixr, an autonomous trading agent. Based on the conversation with @bankr and token analysis, decide what trades to make.

## Conversation with @bankr

**Initial Question:** ${conversation.initialQuestion}
**Bankr's Response:** ${conversation.bankrResponse}

**Follow-up 1:** ${conversation.followUp1}
**Response:** ${conversation.followUp1Response}

**Follow-up 2:** ${conversation.followUp2}
**Response:** ${conversation.followUp2Response}

## Token Analysis

${analyses.map(a => `
### ${a.symbol} (${a.chain})
- Sentiment: ${a.sentiment.score.toFixed(2)} (${a.sentiment.trending ? 'TRENDING' : 'not trending'})
- Security: ${a.security.riskLevel} risk ${a.security.flags.length > 0 ? `(${a.security.flags.join(', ')})` : ''}
- Recommendation: ${a.recommendation} (${(a.confidence * 100).toFixed(0)}% confidence)
- Reasoning: ${a.reasoning}
`).join('\n')}

## Your Task

Decide which tokens to BUY, SELL, or HOLD. Be conservative - only recommend strong actions when confidence is high. Consider:
1. Bankr's sentiment and insights
2. Security risks (avoid high-risk tokens)
3. Sentiment trends
4. Diversification

Respond in JSON format:
{
  "tokens": [
    {"symbol": "...", "action": "buy|sell|hold", "reasoning": "..."},
    ...
  ],
  "overallStrategy": "Brief summary of your strategy"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) return [];

  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.tokens || [];
    }
  } catch {
    console.error('Failed to parse trade decision');
  }

  return [];
}

// ============ Database Operations ============

async function saveDecision(env: Env, decision: TradeDecision): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/bankr_decisions`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        id: decision.id,
        timestamp: decision.timestamp,
        conversation: decision.bankrConversation,
        tokens_analyzed: decision.tokensAnalyzed,
        action: decision.action,
        token_decisions: decision.tokens,
        prices_at_decision: decision.pricesAtDecision,
      }),
    });
  } catch (error) {
    console.error('Failed to save decision:', error);
  }
}

async function getRecentDecisions(env: Env, limit = 10): Promise<TradeDecision[]> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/bankr_decisions?order=timestamp.desc&limit=${limit}`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!response.ok) return [];
    return await response.json() as TradeDecision[];
  } catch {
    return [];
  }
}

async function updateDecisionOutcome(
  env: Env,
  decisionId: string,
  prices: Record<string, number>,
  timeframe: '24h' | '7d'
): Promise<void> {
  const field = timeframe === '24h' ? 'prices_after_24h' : 'prices_after_7d';

  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/bankr_decisions?id=eq.${decisionId}`, {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ [field]: prices }),
    });
  } catch (error) {
    console.error(`Failed to update ${timeframe} prices:`, error);
  }
}

// ============ Main Entry Point ============

export interface BankrTradeResult {
  success: boolean;
  conversationCastHash?: string;
  tokensAnalyzed: number;
  decisions: { symbol: string; action: string }[];
  error?: string;
}

export async function runBankrTrade(env: Env): Promise<BankrTradeResult> {
  const result: BankrTradeResult = {
    success: false,
    tokensAnalyzed: 0,
    decisions: [],
  };

  try {
    console.log('Starting Bankr trading session...');

    // Step 1: Initial question to @bankr
    const initialQuestion = `@bankr what's cooking on Base and Solana today? Any alpha on tokens making moves? 🔍`;

    console.log('Casting initial question to @bankr...');
    const initialCast = await castToFarcaster(env, initialQuestion);
    result.conversationCastHash = initialCast.hash;

    console.log('Waiting for @bankr response...');
    const bankrResponse = await waitForBankrReply(env, initialCast.hash);

    if (!bankrResponse) {
      result.error = 'No response from @bankr within timeout';
      return result;
    }

    console.log('Got initial response, asking follow-up 1...');

    // Step 2: First follow-up - dig deeper
    const followUp1 = `Interesting! Which of those do you think has the strongest momentum right now? Any catalysts coming up?`;
    const followUp1Cast = await castToFarcaster(env, followUp1, bankrResponse.hash);

    const followUp1Response = await waitForBankrReply(env, followUp1Cast.hash);

    // Step 3: Second follow-up - risk assessment
    const followUp2 = `What about the risks? Any tokens you'd avoid or red flags you're seeing in the market?`;
    const followUp2Cast = await castToFarcaster(env, followUp2, followUp1Response?.hash || bankrResponse.hash);

    const followUp2Response = await waitForBankrReply(env, followUp2Cast.hash);

    // Build conversation record
    const conversation: TradeDecision['bankrConversation'] = {
      initialQuestion,
      bankrResponse: bankrResponse.text,
      followUp1,
      followUp1Response: followUp1Response?.text || '',
      followUp2,
      followUp2Response: followUp2Response?.text || '',
    };

    console.log('Conversation complete, extracting token mentions...');

    // Step 4: Extract all token mentions from the conversation
    const allText = Object.values(conversation).join(' ');
    const tokenMentions = extractTokenMentions(allText);

    console.log(`Found ${tokenMentions.length} token mentions, analyzing...`);

    // Step 5: Analyze each token
    const analyses: TokenAnalysis[] = [];
    for (const token of tokenMentions.slice(0, 5)) { // Limit to 5 tokens
      console.log(`Analyzing ${token.symbol}...`);
      const analysis = await analyzeToken(env, token);
      if (analysis) {
        analyses.push(analysis);
      }
    }

    result.tokensAnalyzed = analyses.length;

    // Step 6: Generate trade decisions
    console.log('Generating trade decisions...');
    const tokenDecisions = await generateTradeDecision(env, conversation, analyses);

    result.decisions = tokenDecisions.map(t => ({ symbol: t.symbol, action: t.action }));

    // Step 7: Save decision for tracking
    const decision: TradeDecision = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      bankrConversation: conversation,
      tokensAnalyzed: analyses,
      action: tokenDecisions.some(t => t.action !== 'hold') ? 'rebalance' : 'hold',
      tokens: tokenDecisions,
      pricesAtDecision: analyses.reduce((acc, a) => {
        acc[a.symbol] = a.price.current;
        return acc;
      }, {} as Record<string, number>),
    };

    await saveDecision(env, decision);

    // Step 8: Post summary to Farcaster
    const summaryText = tokenDecisions.length > 0
      ? `📊 Daily market intel from @bankr:\n\n${tokenDecisions.map(t =>
          `${t.action === 'buy' ? '🟢' : t.action === 'sell' ? '🔴' : '⚪'} ${t.symbol}: ${t.action.toUpperCase()}`
        ).join('\n')}\n\nTracking performance for system improvement 📈`
      : `📊 Checked in with @bankr today. Holding current positions - no clear signals yet.`;

    await castToFarcaster(env, summaryText);

    result.success = true;
    console.log('Bankr trading session complete!');

    // Record successful trading session
    recordOutcome(env, {
      action_type: 'trade',
      action_id: decision.id,
      skill: 'trading_decision',
      success: true,
      context: { tokensAnalyzed: analyses.length, action: decision.action },
      outcome: {
        decisions: tokenDecisions.map(t => ({ symbol: t.symbol, action: t.action })),
        pricesAtDecision: decision.pricesAtDecision,
      },
    }).catch(err => console.error('[Outcomes] Trade success recording:', err));

    return result;

  } catch (error) {
    result.error = String(error);
    console.error('Bankr trading error:', error);

    // Record failed trading session
    const errClass = classifyError(error);
    recordOutcome(env, {
      action_type: 'trade',
      skill: 'trading_decision',
      success: false,
      error_class: errClass.errorClass,
      error_message: errClass.errorMessage.slice(0, 2000),
      context: { tokensAnalyzed: result.tokensAnalyzed },
    }).catch(err => console.error('[Outcomes] Trade failure recording:', err));

    return result;
  }
}

// ============ Outcome Tracking (called by separate cron) ============

export async function trackDecisionOutcomes(env: Env): Promise<void> {
  // Get decisions from 24h and 7d ago
  const decisions = await getRecentDecisions(env, 50);

  for (const decision of decisions) {
    const decisionTime = new Date(decision.timestamp).getTime();
    const now = Date.now();
    const hoursSinceDecision = (now - decisionTime) / (1000 * 60 * 60);

    // Update 24h prices if ~24h has passed
    if (hoursSinceDecision >= 23.5 && hoursSinceDecision <= 25 && !decision.pricesAfter24h) {
      console.log(`Tracking 24h outcome for decision ${decision.id}`);
      // Would fetch current prices and compare
      // For now, just mark as tracked
      await updateDecisionOutcome(env, decision.id, {}, '24h');
    }

    // Update 7d prices if ~7d has passed
    if (hoursSinceDecision >= 167 && hoursSinceDecision <= 169 && !decision.pricesAfter7d) {
      console.log(`Tracking 7d outcome for decision ${decision.id}`);
      await updateDecisionOutcome(env, decision.id, {}, '7d');
    }
  }
}

// ============ Performance Analytics ============

export async function getTradePerformance(env: Env): Promise<{
  totalDecisions: number;
  successRate: number;
  avgPnl24h: number;
  avgPnl7d: number;
  bestTrade: { symbol: string; pnl: number } | null;
  worstTrade: { symbol: string; pnl: number } | null;
}> {
  const decisions = await getRecentDecisions(env, 100);

  // Calculate metrics from tracked outcomes
  // This would be expanded with real P&L calculations

  return {
    totalDecisions: decisions.length,
    successRate: 0, // Would calculate from pricesAfter data
    avgPnl24h: 0,
    avgPnl7d: 0,
    bestTrade: null,
    worstTrade: null,
  };
}
