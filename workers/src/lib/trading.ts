// Fixr Agent Daily Trading Discussion
// Two-question decision framework for investment decisions
// Includes portfolio management: sell, hold, or buy more

import { Env } from './types';
import * as bankr from './bankr';

// Trade sizing config - scales with confidence
const TRADE_CONFIG = {
  maxSingleTradeETH: 0.01,

  // Confidence multipliers for trade sizing
  confidenceMultiplier: {
    high: 1.0,    // Full size (0.01 ETH max)
    medium: 0.6,  // 60% size (0.006 ETH max)
    low: 0.3,     // 30% size (0.003 ETH max)
  },

  // Sell percentages by confidence
  sellPercentage: {
    high: 100,    // Sell all
    medium: 50,   // Sell half
    low: 25,      // Sell quarter
  },
};

export interface PortfolioAction {
  action: 'buy' | 'sell' | 'hold';
  token: string;
  contractAddress?: string;
  chain: 'base' | 'solana' | 'ethereum';
  amountETH?: number;      // For buys
  sellPercentage?: number; // For sells
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface TradingDecision {
  // New opportunity
  newOpportunity?: {
    shouldInvest: boolean;
    token?: string;
    contractAddress?: string;
    chain?: 'base' | 'solana' | 'ethereum';
    amountETH?: number;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
  };
  // Existing holdings decisions
  portfolioActions: PortfolioAction[];
}

export interface TradeExecution {
  token: string;
  action: 'buy' | 'sell';
  result: bankr.BankrTradeResult;
}

export interface DailyTradingResult {
  success: boolean;
  balances?: string;
  marketContext?: string;
  questions: {
    q1: string;
    a1: string;
    q2: string;
    a2: string;
  };
  decision: TradingDecision;
  executions: TradeExecution[];
  error?: string;
  timestamp: string;
}

const TRADING_SYSTEM_PROMPT = `You are Fixr, an autonomous builder agent who also makes strategic crypto investments.
Your personality: "Fix'n shit. Debugging your mess since before it was cool."

You're not a degen. You make calculated bets based on:
1. Builder activity and shipping culture
2. Farcaster ecosystem trends
3. Base chain opportunities
4. AI agent narratives

PORTFOLIO MANAGEMENT:
- Review your existing holdings and decide: SELL, HOLD, or BUY MORE
- Be ruthless about cutting losers early
- Don't get attached to bags that aren't working
- Scale your confidence to your conviction

TRADE SIZING (scales with confidence):
- HIGH confidence: max 0.01 ETH buy / 100% sell
- MEDIUM confidence: max 0.006 ETH buy / 50% sell
- LOW confidence: max 0.003 ETH buy / 25% sell

Preferred chains: Base (primary), Solana (secondary)

Be direct. Be opinionated. Be Fixr.`;

/**
 * Calculate trade size based on confidence
 */
function calculateBuyAmount(confidence: 'high' | 'medium' | 'low', requestedAmount: number): number {
  const multiplier = TRADE_CONFIG.confidenceMultiplier[confidence];
  const maxForConfidence = TRADE_CONFIG.maxSingleTradeETH * multiplier;
  return Math.min(requestedAmount, maxForConfidence);
}

/**
 * Calculate sell percentage based on confidence
 */
function calculateSellPercentage(confidence: 'high' | 'medium' | 'low'): number {
  return TRADE_CONFIG.sellPercentage[confidence];
}

/**
 * Get current market context via Bankr
 */
async function getMarketContext(env: Env): Promise<string> {
  const result = await bankr.promptAndWait(
    env,
    'what are the top trending tokens on base right now? include prices and 24h changes',
    { maxWaitMs: 45000 }
  );
  return result.response || 'Unable to fetch market context';
}

/**
 * Run the two-question trading discussion with portfolio management
 */
export async function runDailyTradingDiscussion(env: Env): Promise<DailyTradingResult> {
  const timestamp = new Date().toISOString();
  console.log(`Trading discussion started at ${timestamp}`);

  const executions: TradeExecution[] = [];

  try {
    // Get current balances
    const balanceResult = await bankr.promptAndWait(env, 'show my balances', { maxWaitMs: 30000 });
    const balances = balanceResult.response || 'Unable to fetch balances';
    console.log('Current balances:', balances);

    // Get market context
    const marketContext = await getMarketContext(env);
    console.log('Market context fetched');

    // Question 1: Analyze portfolio + market
    const q1 = "Look at my current holdings and the market. What should I do with each token I hold (sell/hold/buy more)? And is there a new opportunity worth investing in?";

    const q1Response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: TRADING_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `MY CURRENT PORTFOLIO:\n${balances}\n\nMARKET CONTEXT:\n${marketContext}\n\n${q1}`
        }],
      }),
    });

    const q1Data = await q1Response.json() as { content: Array<{ type: string; text?: string }> };
    const a1 = q1Data.content[0]?.text || 'No response';
    console.log('Q1 answered');

    // Question 2: Make decisions in JSON
    const q2 = "Now give me your final decisions as JSON. Be specific.";

    const q2Response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: TRADING_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `MY CURRENT PORTFOLIO:\n${balances}\n\nMARKET CONTEXT:\n${marketContext}\n\n${q1}` },
          { role: 'assistant', content: a1 },
          { role: 'user', content: `${q2}

Respond with this exact JSON structure:
{
  "portfolioActions": [
    {
      "action": "sell|hold|buy",
      "token": "TOKEN_SYMBOL",
      "contractAddress": "0x...",
      "chain": "base",
      "reasoning": "why this action",
      "confidence": "high|medium|low"
    }
  ],
  "newOpportunity": {
    "shouldInvest": true/false,
    "token": "NEW_TOKEN",
    "contractAddress": "0x...",
    "chain": "base",
    "amountETH": 0.005,
    "reasoning": "why",
    "confidence": "high|medium|low"
  }
}

For sells, I will scale the percentage based on your confidence:
- high = sell 100%
- medium = sell 50%
- low = sell 25%

For buys, I will scale the amount based on your confidence:
- high = up to 0.01 ETH
- medium = up to 0.006 ETH
- low = up to 0.003 ETH` }
        ],
      }),
    });

    const q2Data = await q2Response.json() as { content: Array<{ type: string; text?: string }> };
    const a2 = q2Data.content[0]?.text || 'No response';
    console.log('Q2 answered');

    // Parse decision
    let decision: TradingDecision;
    try {
      let jsonStr = a2;
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      decision = JSON.parse(jsonStr);
      if (!decision.portfolioActions) {
        decision.portfolioActions = [];
      }
    } catch {
      decision = {
        portfolioActions: [],
        newOpportunity: {
          shouldInvest: false,
          reasoning: 'Could not parse decision',
          confidence: 'low'
        }
      };
    }

    console.log('Decision:', JSON.stringify(decision, null, 2));

    // Execute portfolio actions (sells first, then buys)
    const sells = decision.portfolioActions.filter(a => a.action === 'sell');
    const buys = decision.portfolioActions.filter(a => a.action === 'buy');

    // Execute sells
    for (const sell of sells) {
      const sellPct = calculateSellPercentage(sell.confidence);
      console.log(`Selling ${sellPct}% of ${sell.token} (${sell.confidence} confidence)`);

      const result = await bankr.sellToken(env, {
        token: sell.token,
        contractAddress: sell.contractAddress,
        percentage: sellPct,
        chain: sell.chain || 'base',
      });

      executions.push({ token: sell.token, action: 'sell', result });
      console.log(`Sell ${sell.token} result:`, result.success ? 'success' : result.error);
    }

    // Execute portfolio buys (buy more of existing)
    for (const buy of buys) {
      if (!buy.amountETH) continue;

      const scaledAmount = calculateBuyAmount(buy.confidence, buy.amountETH);
      console.log(`Buying ${scaledAmount} ETH of ${buy.token} (${buy.confidence} confidence)`);

      const result = await bankr.buyToken(env, {
        token: buy.token,
        contractAddress: buy.contractAddress,
        amountETH: scaledAmount,
        chain: buy.chain || 'base',
      });

      executions.push({ token: buy.token, action: 'buy', result });
      console.log(`Buy ${buy.token} result:`, result.success ? 'success' : result.error);
    }

    // Execute new opportunity buy
    if (decision.newOpportunity?.shouldInvest && decision.newOpportunity.token && decision.newOpportunity.amountETH) {
      const confidence = decision.newOpportunity.confidence || 'low';
      const scaledAmount = calculateBuyAmount(confidence, decision.newOpportunity.amountETH);

      console.log(`New opportunity: ${scaledAmount} ETH -> ${decision.newOpportunity.token} (${confidence} confidence)`);

      const result = await bankr.buyToken(env, {
        token: decision.newOpportunity.token,
        contractAddress: decision.newOpportunity.contractAddress,
        amountETH: scaledAmount,
        chain: decision.newOpportunity.chain || 'base',
      });

      executions.push({ token: decision.newOpportunity.token, action: 'buy', result });
      console.log(`New buy result:`, result.success ? 'success' : result.error);
    }

    return {
      success: true,
      balances,
      marketContext,
      questions: { q1, a1, q2, a2 },
      decision,
      executions,
      timestamp,
    };
  } catch (error) {
    console.error('Trading discussion error:', error);
    return {
      success: false,
      questions: { q1: '', a1: '', q2: '', a2: '' },
      decision: { portfolioActions: [] },
      executions,
      error: String(error),
      timestamp,
    };
  }
}

/**
 * Post trading discussion results to Farcaster
 */
export async function postTradingUpdate(
  env: Env,
  result: DailyTradingResult
): Promise<{ success: boolean; hash?: string }> {
  try {
    const { postToFarcaster } = await import('./social');

    // Summarize what happened
    const successfulTrades = result.executions.filter(e => e.result.success);
    const failedTrades = result.executions.filter(e => !e.result.success);

    let content: string;

    if (successfulTrades.length > 0) {
      const tradesSummary = successfulTrades.map(t => {
        if (t.action === 'sell') {
          return `sold $${t.token}`;
        } else {
          return `bought $${t.token}`;
        }
      }).join(', ');

      const portfolioActions = result.decision.portfolioActions.filter(a => a.action !== 'hold');
      const reasoning = portfolioActions[0]?.reasoning || result.decision.newOpportunity?.reasoning || '';

      content = `daily portfolio check complete.

${tradesSummary}

${reasoning.slice(0, 150)}${reasoning.length > 150 ? '...' : ''}

${failedTrades.length > 0 ? `(${failedTrades.length} trade(s) failed)` : ''}

not financial advice. just fix'n my bags.`;
    } else if (failedTrades.length > 0) {
      content = `tried to make some moves but trades failed.

${failedTrades.map(t => `${t.action} $${t.token}: ${t.result.error || 'unknown'}`).join('\n')}

back to building.`;
    } else {
      // No trades executed - either all holds or no opportunities
      const holds = result.decision.portfolioActions.filter(a => a.action === 'hold');
      if (holds.length > 0) {
        content = `daily portfolio check complete.

holding: ${holds.map(h => `$${h.token}`).join(', ')}

${holds[0]?.reasoning?.slice(0, 100) || 'nothing worth changing today.'}

sometimes patience is the play.`;
      } else {
        content = `did my daily market scan.

nothing worth the ETH today. sometimes the best trade is no trade.

back to shipping code.`;
      }
    }

    const postResult = await postToFarcaster(env, content);
    return { success: postResult.success, hash: postResult.hash };
  } catch (error) {
    console.error('Failed to post trading update:', error);
    return { success: false };
  }
}
