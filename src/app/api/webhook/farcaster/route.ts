// Neynar Webhook Endpoint for Farcaster Events
// Receives cast.created events for replies to Fixr and mentions
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { postToFarcaster } from '@/lib/social';

interface NeynarWebhookPayload {
  created_at: number;
  type: 'cast.created';
  data: {
    object: 'cast';
    hash: string;
    thread_hash: string;
    parent_hash: string | null;
    parent_url: string | null;
    parent_author?: {
      fid: number;
    };
    author: {
      fid: number;
      username: string;
      display_name: string;
      custody_address: string;
      verified_addresses?: {
        eth_addresses: string[];
        sol_addresses: string[];
      };
    };
    text: string;
    timestamp: string;
    embeds: Array<{ url?: string }>;
  };
}

// Verify webhook signature from Neynar
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('NEYNAR_WEBHOOK_SECRET not configured, skipping verification');
    return true; // Allow in dev, but log warning
  }

  const expectedSignature = crypto
    .createHmac('sha512', webhookSecret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

// Extract wallet addresses from text
function extractWalletAddresses(text: string): { eth: string[]; sol: string[] } {
  const ethRegex = /0x[a-fA-F0-9]{40}/g;
  const solRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g; // Base58 addresses

  const ethMatches: string[] = text.match(ethRegex) || [];
  // Filter sol matches to exclude common words and ensure they look like addresses
  const solMatches: string[] = (text.match(solRegex) || []).filter(
    (addr: string) => addr.length >= 32 && addr.length <= 44 && !ethMatches.includes(addr)
  );

  return { eth: ethMatches, sol: solMatches };
}

// Parse reply for actionable content
function parseReplyContent(text: string, authorUsername: string): {
  type: 'wallet_provided' | 'confirmation' | 'question' | 'unknown';
  data: Record<string, unknown>;
} {
  const lowerText = text.toLowerCase();
  const wallets = extractWalletAddresses(text);

  // Check for wallet address provided
  if (wallets.eth.length > 0 || wallets.sol.length > 0) {
    return {
      type: 'wallet_provided',
      data: {
        ethAddresses: wallets.eth,
        solAddresses: wallets.sol,
        fromUser: authorUsername,
      },
    };
  }

  // Check for confirmation words
  const confirmWords = ['done', 'completed', 'sent', 'created', 'ready', 'yes', 'confirmed', 'gm'];
  if (confirmWords.some((word) => lowerText.includes(word))) {
    return {
      type: 'confirmation',
      data: { message: text, fromUser: authorUsername },
    };
  }

  // Check for questions
  if (text.includes('?')) {
    return {
      type: 'question',
      data: { question: text, fromUser: authorUsername },
    };
  }

  return {
    type: 'unknown',
    data: { message: text, fromUser: authorUsername },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = ReturnType<typeof createClient<any>>;

// Parse @bankr's market info and generate a thoughtful response
async function generateBankrResponse(bankrMessage: string, supabase: SupabaseClientAny): Promise<string | null> {
  const lowerText = bankrMessage.toLowerCase();

  // Check if this looks like market info from @bankr
  const marketKeywords = ['trending', 'top', 'volume', 'price', 'market', 'bullish', 'bearish',
    'pump', 'dump', 'ath', 'up', 'down', '%', 'token', 'coin', '$', 'gainer', 'mc', 'buzzing'];
  const hasMarketInfo = marketKeywords.some(kw => lowerText.includes(kw));

  if (!hasMarketInfo) {
    return null; // Not market info, don't respond
  }

  // Extract token mentions - both $SYMBOL format and named tokens
  // Match $TOKEN or common token name patterns (word followed by price/percentage info)
  const dollarTokens = bankrMessage.match(/\$[A-Za-z]{2,10}/gi) || [];
  // Also try to extract token names mentioned before price info (e.g., "clawch on base")
  const namedTokens = bankrMessage.match(/\b([a-z]{3,10})\s+(?:on\s+base|:\s*\$|\|)/gi) || [];

  // Clean up token mentions
  const tokenMentions = [
    ...dollarTokens.map(t => t.toUpperCase()),
    ...namedTokens.map(t => '$' + t.split(/\s|:/)[0].toUpperCase())
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

  // Check for big percentage gains
  const percentMatches = bankrMessage.match(/\+?\d{1,5}(?:,\d{3})*%/g) || [];
  const hasBigGains = percentMatches.some(p => {
    const num = parseInt(p.replace(/[+%,]/g, ''));
    return num > 100; // More than 100% gain
  });

  // Check for "top gainer" or specific recommendations
  const isTopGainer = lowerText.includes('top gainer') || lowerText.includes('gainer today');
  const isDirectRecommendation = lowerText.includes('buzzing') || lowerText.includes('trending');

  // Count how many times we've already asked follow-up questions
  const { data: recentResponses } = await supabase
    .from('farcaster_replies')
    .select('text')
    .eq('author_username', 'fixr')
    .eq('parsed_type', 'bankr_response')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
    .limit(5);

  const questionCount = (recentResponses || []).filter(r =>
    r.text?.includes('?') || r.text?.includes('what')
  ).length;

  // If we've asked enough questions OR got a strong signal, make a trade
  const shouldTrade = (
    (tokenMentions.length > 0 && hasBigGains) ||
    (tokenMentions.length > 0 && isTopGainer) ||
    (tokenMentions.length > 0 && questionCount >= 2)
  );

  if (shouldTrade && tokenMentions.length > 0) {
    const token = tokenMentions[0].replace('$', '');
    const tradeAmount = hasBigGains ? '0.002' : '0.005'; // Smaller bet on moonshots

    // Different trade responses
    const tradeResponses = [
      `alright let's see what ${tokenMentions[0]} is about. @bankr buy ${tradeAmount} ETH of ${token}`,
      `${hasBigGains ? 'those gains are wild. ' : ''}throwing a small bag at ${tokenMentions[0]}. @bankr buy ${tradeAmount} ETH of ${token}`,
      `you've convinced me. @bankr buy ${tradeAmount} ETH of ${token}`,
      `time to ape. @bankr buy ${tradeAmount} ETH of ${token}`,
    ];
    return tradeResponses[Math.floor(Math.random() * tradeResponses.length)];
  }

  // If we have token info but not ready to trade yet, ask ONE more question then trade
  if (tokenMentions.length > 0 && questionCount < 2) {
    const followUpResponses = [
      `${tokenMentions[0]} looks interesting. what's the volume like? might ape if it's solid`,
      `hmm ${tokenMentions[0]}... tell me more. leaning towards buying`,
      `${hasBigGains ? 'those numbers are crazy. ' : ''}${tokenMentions[0]} - risky or worth a shot?`,
    ];
    return followUpResponses[Math.floor(Math.random() * followUpResponses.length)];
  }

  // No specific tokens mentioned - ask for recommendations
  if (tokenMentions.length === 0) {
    const askResponses = [
      `interesting. which one would you ape if you had to pick one?`,
      `good alpha. @bankr what's your top pick to buy rn?`,
      `nice rundown. give me your best bet - ready to throw some ETH at it`,
    ];
    return askResponses[Math.floor(Math.random() * askResponses.length)];
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-neynar-signature') || '';

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: NeynarWebhookPayload = JSON.parse(rawBody);
    console.log('Received Farcaster webhook:', {
      type: payload.type,
      author: payload.data.author.username,
      text: payload.data.text.slice(0, 100),
      parentHash: payload.data.parent_hash,
    });

    // Only process cast.created events that are replies
    if (payload.type !== 'cast.created') {
      return NextResponse.json({ status: 'ignored', reason: 'not cast.created' });
    }

    // Must be a reply (has parent_hash)
    if (!payload.data.parent_hash) {
      return NextResponse.json({ status: 'ignored', reason: 'not a reply' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing database credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the reply content
    const parsed = parseReplyContent(payload.data.text, payload.data.author.username);

    // Store the reply event
    const replyEvent = {
      id: payload.data.hash,
      parent_hash: payload.data.parent_hash,
      thread_hash: payload.data.thread_hash,
      author_fid: payload.data.author.fid,
      author_username: payload.data.author.username,
      author_display_name: payload.data.author.display_name,
      text: payload.data.text,
      parsed_type: parsed.type,
      parsed_data: parsed.data,
      author_eth_addresses: payload.data.author.verified_addresses?.eth_addresses || [],
      author_sol_addresses: payload.data.author.verified_addresses?.sol_addresses || [],
      created_at: payload.data.timestamp,
      processed: false,
    };

    // Upsert to avoid duplicates
    const { error: insertError } = await supabase
      .from('farcaster_replies')
      .upsert(replyEvent, { onConflict: 'id' });

    if (insertError) {
      console.error('Error storing reply:', insertError);
      // Don't fail the webhook, just log
    } else {
      console.log('Stored reply in farcaster_replies table');
    }

    // Try to find the related task by matching parent_hash OR thread_hash
    // This allows us to track entire conversations, not just direct replies
    const { data: tasksWithResults } = await supabase
      .from('tasks')
      .select('*')
      .not('result', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);

    const parentHash = payload.data.parent_hash!;
    const threadHash = payload.data.thread_hash;

    console.log(`Searching ${tasksWithResults?.length || 0} tasks for parentHash: ${parentHash}, threadHash: ${threadHash}`);

    // Find task where the farcaster postId matches parent_hash OR thread_hash
    const matchedTask = tasksWithResults?.find((task) => {
      const outputs = task.result?.outputs || [];
      return outputs.some((output: { type: string; data?: { farcaster?: { postId?: string } } }) => {
        if (output.type === 'post' && output.data?.farcaster?.postId) {
          const postId = output.data.farcaster.postId;
          // Match against parent_hash (direct reply) or thread_hash (conversation thread)
          const matchesParent = postId === parentHash ||
                               parentHash.startsWith(postId) ||
                               postId.startsWith(parentHash);
          const matchesThread = postId === threadHash ||
                               threadHash.startsWith(postId) ||
                               postId.startsWith(threadHash);
          if (matchesParent || matchesThread) {
            console.log(`Found match: postId=${postId}, parentHash=${parentHash}, threadHash=${threadHash}, matchType=${matchesParent ? 'parent' : 'thread'}`);
          }
          return matchesParent || matchesThread;
        }
        return false;
      });
    });

    if (matchedTask) {
      console.log(`Found related task: ${matchedTask.title} (${matchedTask.id})`);

      // Update the reply record with the task_id
      await supabase
        .from('farcaster_replies')
        .update({ task_id: matchedTask.id })
        .eq('id', payload.data.hash);

      // If wallet was provided, update the task result with the wallet data
      if (parsed.type === 'wallet_provided') {
        const updatedResult = {
          ...matchedTask.result,
          replyData: {
            type: parsed.type,
            data: parsed.data,
            receivedAt: new Date().toISOString(),
            fromCast: payload.data.hash,
          },
        };

        await supabase
          .from('tasks')
          .update({ result: updatedResult, updated_at: new Date().toISOString() })
          .eq('id', matchedTask.id);

        console.log('Updated task with wallet data from reply:', parsed.data);
      }
    } else {
      console.log('No matching task found for parent hash');
    }

    // Special handling for @bankr replies - generate thoughtful response
    if (payload.data.author.username === 'bankr') {
      console.log('Received reply from @bankr, considering response...');

      // Check if we already responded to this @bankr message (deduplication)
      const { data: existingResponse } = await supabase
        .from('farcaster_replies')
        .select('id')
        .eq('author_username', 'fixr')
        .eq('parent_hash', payload.data.hash)
        .limit(1);

      if (existingResponse && existingResponse.length > 0) {
        console.log('Already responded to this @bankr message, skipping');
        return NextResponse.json({
          status: 'skipped',
          reason: 'already_responded',
          bankrHash: payload.data.hash,
        });
      }

      // Check if this is a reply to one of Fixr's posts
      const { data: fixrPosts } = await supabase
        .from('farcaster_replies')
        .select('id')
        .eq('author_username', 'fixr')
        .or(`id.eq.${parentHash},thread_hash.eq.${threadHash}`)
        .limit(1);

      const isReplyToFixr = fixrPosts && fixrPosts.length > 0;

      if (isReplyToFixr) {
        // Generate a thoughtful response
        const response = await generateBankrResponse(payload.data.text, supabase);

        if (response) {
          console.log('Generated response to @bankr:', response);

          // Small delay to seem more human (1-3 seconds)
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

          // Post the response as a reply IN THE SAME THREAD
          // Reply to @bankr's message (payload.data.hash) to keep the conversation threaded
          const postResult = await postToFarcaster(response, undefined, payload.data.hash);

          if (postResult.success) {
            console.log('Posted threaded response to @bankr:', postResult.url);

            // Log the response
            await supabase.from('farcaster_replies').insert({
              id: postResult.postId || `fixr_response_${Date.now()}`,
              parent_hash: payload.data.hash,
              thread_hash: threadHash,
              author_fid: 0,
              author_username: 'fixr',
              author_display_name: 'Fixr',
              text: response,
              parsed_type: 'bankr_response',
              parsed_data: { inReplyTo: payload.data.hash, originalMessage: payload.data.text.slice(0, 200) },
              processed: true,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Return 200 to acknowledge receipt
    return NextResponse.json({
      status: 'received',
      parsed: parsed.type,
      parsedData: parsed.data,
      relatedTask: matchedTask?.id || null,
      storedReplyId: payload.data.hash,
      bankrResponse: payload.data.author.username === 'bankr' ? 'processed' : undefined,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent infinite retries
    return NextResponse.json({ status: 'error', message: String(error) });
  }
}

// Health check for webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'farcaster-webhook',
    description: 'Receives Neynar webhook events for replies to @fixr',
  });
}
