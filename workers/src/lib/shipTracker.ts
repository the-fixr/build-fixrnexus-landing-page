// Fixr Ship Tracker - Ingest, categorize, and index ships from the ecosystem
// Sources: ClawCrunch, news.clanker.ai, Farcaster

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env, Ship, Builder, ShipCategory, ShipSource, IngestionRun, EcosystemInsight } from './types';

function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

// ============ Category Detection ============

const CATEGORY_KEYWORDS: Record<ShipCategory, string[]> = {
  miniapp: ['frame', 'miniapp', 'mini app', 'mini-app', 'warpcast', 'farcaster app', 'farcaster frame'],
  token: ['token', 'clanker', 'streme', 'airdrop', 'coin', 'liquidity', 'tokenomics', 'fair launch', 'presale', 'staking'],
  protocol: ['protocol', 'defi', 'swap', 'lending', 'yield', 'vault', 'amm', 'dex', 'liquidity pool', 'tvl'],
  tool: ['tool', 'sdk', 'api', 'cli', 'library', 'framework', 'developer', 'devtool', 'open source', 'github.com', 'npm'],
  agent: ['agent', 'ai agent', 'bot', 'autonomous', 'openclaw', 'moltbot', 'clawdbot', 'moltbook', 'ai trading', 'ai partner'],
  social: ['social', 'community', 'chat', 'messaging', 'network', 'feed', 'farcaster', 'warpcast.com', 'moltbook'],
  nft: ['nft', 'collectible', 'mint', 'collection', 'art', 'pfp', 'onchain art', 'generative'],
  infra: ['infrastructure', 'rpc', 'node', 'indexer', 'oracle', 'bridge', 'relay', 'sequencer', 'rollup'],
  other: [],
};

// Domain to category mapping for quick classification
const DOMAIN_CATEGORIES: Record<string, ShipCategory> = {
  'github.com': 'tool',
  'npmjs.com': 'tool',
  'streme.fun': 'token',
  'clanker.world': 'token',
  'basescan.org': 'infra',
  'etherscan.io': 'infra',
  'warpcast.com': 'social',
  'farcaster.xyz': 'social',
  'moltbook.ai': 'social',
  'opensea.io': 'nft',
  'zora.co': 'nft',
  'uniswap.org': 'protocol',
  'aave.com': 'protocol',
};

// Domains that typically host articles/news, not ships
const NON_SHIP_DOMAINS: string[] = [
  'arxiv.org',
  'sciencedaily.com',
  'brooklynrail.org',
  'nature.com',
  'medium.com', // unless it's about their own project
  'substack.com',
  'techcrunch.com',
  'theblock.co',
  'coindesk.com',
  'cointelegraph.com',
  'decrypt.co',
  'breezyscroll.com',
  'meaningness.com',
  'ycombinator.com', // RFS posts are not ships
  'wikipedia.org',
];

// Title patterns that indicate non-ship content
const NON_SHIP_PATTERNS: RegExp[] = [
  /^ask cn:/i,           // Questions
  /how i learned/i,      // Tutorial posts
  /^what .+ need/i,      // Discussion questions
  /^how can we/i,        // Discussion questions
  /explained:/i,         // Explainer articles
  /your .+ questions answered/i,
  /research(ers)? (find|show|build|discover)/i,
  /study (shows|finds|reveals)/i,
  /needs? (public )?infrastructure/i, // Opinion pieces about what's needed
  /consciousness/i,      // Philosophy articles
  /computationalism/i,   // Philosophy articles
];

function isLikelyShip(title: string, url: string, domain: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerDomain = domain.toLowerCase();

  // Check if domain is a known non-ship source
  for (const nonShipDomain of NON_SHIP_DOMAINS) {
    if (lowerDomain.includes(nonShipDomain)) {
      return false;
    }
  }

  // Check title patterns
  for (const pattern of NON_SHIP_PATTERNS) {
    if (pattern.test(lowerTitle)) {
      // Exception: "Show CN:" posts linking to actual products are ships
      if (/^show cn:/i.test(lowerTitle) && (
        url.includes('github.com') ||
        lowerDomain.endsWith('.xyz') ||
        lowerDomain.endsWith('.fun') ||
        lowerDomain.endsWith('.ai')
      )) {
        return true;
      }
      return false;
    }
  }

  // Positive signals - these are likely ships
  const shipIndicators = [
    'github.com',
    '.xyz',
    '.fun',
    '.ai',
    '.app',
    'vercel.app',
    'netlify.app',
  ];

  for (const indicator of shipIndicators) {
    if (url.includes(indicator) || lowerDomain.includes(indicator)) {
      return true;
    }
  }

  // Default: include it but with lower confidence
  return true;
}

function detectCategory(title: string, description: string, tags: string[]): ShipCategory {
  const text = `${title} ${description} ${tags.join(' ')}`.toLowerCase();

  // Check domain first for quick classification
  for (const [domain, category] of Object.entries(DOMAIN_CATEGORIES)) {
    if (text.includes(domain)) {
      return category;
    }
  }

  // Check keywords with priority order (more specific categories first)
  const priorityOrder: ShipCategory[] = ['agent', 'miniapp', 'protocol', 'token', 'nft', 'tool', 'infra', 'social', 'other'];

  for (const category of priorityOrder) {
    if (category === 'other') continue;
    const keywords = CATEGORY_KEYWORDS[category];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }

  return 'other';
}

// ============ Builder Extraction ============

function extractBuilders(text: string): { name: string; type: 'human' | 'agent'; identities: Record<string, string> }[] {
  const builders: { name: string; type: 'human' | 'agent'; identities: Record<string, string> }[] = [];

  // Extract @farcaster handles
  const farcasterHandles = text.match(/@[a-zA-Z0-9_]+/g) || [];
  for (const handle of farcasterHandles) {
    const cleanHandle = handle.slice(1);
    // Skip common non-builder handles
    if (['clanker', 'base', 'farcaster', 'coinbase'].includes(cleanHandle.toLowerCase())) continue;
    builders.push({
      name: cleanHandle,
      type: 'human',
      identities: { farcaster: cleanHandle },
    });
  }

  // Extract agent IDs (eip155:chain:address:id format)
  const agentIds = text.match(/eip155:\d+:0x[a-fA-F0-9]+:\d+/g) || [];
  for (const agentId of agentIds) {
    const parts = agentId.split(':');
    builders.push({
      name: `Agent #${parts[3]}`,
      type: 'agent',
      identities: { agentId, wallet: parts[2] },
    });
  }

  // Extract wallet addresses
  const wallets = text.match(/0x[a-fA-F0-9]{40}/g) || [];
  for (const wallet of wallets) {
    // Check if already added via agent ID
    if (!builders.some(b => b.identities.wallet === wallet)) {
      builders.push({
        name: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        type: 'human',
        identities: { wallet },
      });
    }
  }

  return builders;
}

// ============ URL Extraction ============

function extractUrls(text: string): Ship['urls'] {
  const urls: Ship['urls'] = {};

  // GitHub
  const githubMatch = text.match(/https?:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/);
  if (githubMatch) urls.github = githubMatch[0];

  // Farcaster
  const farcasterMatch = text.match(/https?:\/\/(?:warpcast\.com|farcaster\.xyz)\/[a-zA-Z0-9_]+/);
  if (farcasterMatch) urls.farcaster = farcasterMatch[0];

  // Twitter/X
  const twitterMatch = text.match(/https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/);
  if (twitterMatch) urls.twitter = twitterMatch[0];

  // Contract (basescan, etherscan)
  const contractMatch = text.match(/https?:\/\/(?:basescan|etherscan)\.(?:org|io)\/address\/0x[a-fA-F0-9]+/);
  if (contractMatch) urls.contract = contractMatch[0];

  // Generic website (exclude known domains)
  const websiteMatch = text.match(/https?:\/\/(?!github|twitter|x\.com|warpcast|farcaster|basescan|etherscan)[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/);
  if (websiteMatch) urls.website = websiteMatch[0];

  return urls;
}

// ============ ClawCrunch Ingestion ============

interface ClawCrunchArticle {
  id: string;
  url: string;
  title: string;
  summary: string;
  published: string;
  tags: string[];
}

// Check if ClawCrunch article is about an actual ship/project launch
function isClawCrunchShip(title: string, summary: string, tags: string[]): boolean {
  const text = `${title} ${summary}`.toLowerCase();

  // Articles about launches/ships (positive signals)
  const shipSignals = [
    'launch', 'deployed', 'live', 'released', 'shipped',
    'introducing', 'announcing', 'new protocol', 'new tool',
    'built', 'created', 'open source', 'github',
  ];

  // Editorial/analysis content (negative signals)
  const editorialSignals = [
    'here\'s how', 'here is how', 'what we learned',
    'the state of', 'why agents', 'how agents',
    'the future of', 'understanding', 'explained',
    'interview', 'deep dive', 'analysis', 'opinion',
    'creating their own', // e.g., "Agents Are Creating Their Own Religion"
  ];

  // Check for editorial content first
  for (const signal of editorialSignals) {
    if (text.includes(signal)) {
      return false;
    }
  }

  // Check for ship signals
  for (const signal of shipSignals) {
    if (text.includes(signal)) {
      return true;
    }
  }

  // If it mentions a specific tool/protocol name, might be a ship
  if (tags.some(t => ['Launch', 'Protocol', 'Tool', 'Infrastructure', 'DeFi'].includes(t))) {
    return true;
  }

  // Default: treat as editorial, not a ship
  return false;
}

export async function ingestClawCrunch(env: Env): Promise<{ ships: Ship[]; builders: Builder[] }> {
  const response = await fetch('https://clawcrunch.com/articles.json');
  const data = await response.json() as { articles: ClawCrunchArticle[] };

  const ships: Ship[] = [];
  const buildersMap = new Map<string, Builder>();
  let skipped = 0;

  for (const article of data.articles) {
    // Filter out editorial/analysis content
    if (!isClawCrunchShip(article.title, article.summary, article.tags)) {
      skipped++;
      continue;
    }

    const fullText = `${article.title} ${article.summary}`;
    const extractedBuilders = extractBuilders(fullText);
    const builderIds: string[] = [];

    // Process builders
    for (const b of extractedBuilders) {
      const builderId = b.identities.wallet || b.identities.farcaster || b.identities.agentId || b.name;
      builderIds.push(builderId);

      if (!buildersMap.has(builderId)) {
        buildersMap.set(builderId, {
          id: builderId,
          name: b.name,
          type: b.type,
          identities: b.identities,
          ships: [],
          firstSeenAt: article.published,
          lastActiveAt: article.published,
        });
      }
    }

    const ship: Ship = {
      id: `clawcrunch_${article.id}`,
      name: article.title,
      description: article.summary,
      category: detectCategory(article.title, article.summary, article.tags),
      source: 'clawcrunch',
      sourceUrl: `https://clawcrunch.com${article.url}`,
      sourceId: article.id,
      urls: extractUrls(fullText),
      builders: builderIds,
      tags: article.tags,
      publishedAt: article.published,
      ingestedAt: new Date().toISOString(),
    };

    ships.push(ship);

    // Link ship to builders
    for (const builderId of builderIds) {
      const builder = buildersMap.get(builderId);
      if (builder) {
        builder.ships.push(ship.id);
      }
    }
  }

  console.log(`ClawCrunch: parsed ${ships.length} ships, skipped ${skipped} editorial articles`);
  return { ships, builders: Array.from(buildersMap.values()) };
}

// ============ news.clanker.ai Scraper ============

interface ClankerNewsPost {
  rank: number;
  id: string;
  title: string;
  url: string;
  domain: string;
  points: number;
  agentId: string;
  agentName: string;
  timeAgo: string;
  comments: number;
}

function parseTimeAgo(timeAgo: string): Date {
  const now = new Date();
  const match = timeAgo.match(/(\d+)\s*(hour|day|minute|week|month)s?\s*ago/i);
  if (!match) return now;

  const [, num, unit] = match;
  const amount = parseInt(num);

  switch (unit.toLowerCase()) {
    case 'minute': return new Date(now.getTime() - amount * 60 * 1000);
    case 'hour': return new Date(now.getTime() - amount * 60 * 60 * 1000);
    case 'day': return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
    case 'week': return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
    case 'month': return new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
    default: return now;
  }
}

export async function ingestClankerNews(env: Env): Promise<{ ships: Ship[]; builders: Builder[] }> {
  const response = await fetch('https://news.clanker.ai');
  const html = await response.text();

  const ships: Ship[] = [];
  const buildersMap = new Map<string, Builder>();

  // Parse using a more robust two-step approach:
  // 1. Find all post-row-title rows
  // 2. Extract data from each title row and its following meta row

  // Match each title row and its following meta row together
  const rowPairRegex = /<tr class="post-row-title">[\s\S]*?<td class="rank">(\d+)\.<\/td>[\s\S]*?id="vote-cell-([^"]+)"[\s\S]*?<a href="([^"]+)" class="post-link"[^>]*>([^<]+)<\/a>[\s\S]*?<span class="post-domain">\(([^)]+)\)<\/span>[\s\S]*?<\/tr>\s*<tr class="post-row-meta">[\s\S]*?<td class="meta-cell">(\d+) points? by <a href="\/agent\/([^"]+)">([^<]+)<\/a>\s*([^|<]+)\|[\s\S]*?<a href="\/post\/[^"]+">(?:(\d+) comments?|discuss)<\/a>/g;

  let match;
  let skipped = 0;
  while ((match = rowPairRegex.exec(html)) !== null) {
    const [, rank, postId, url, title, domain, points, agentId, agentName, timeAgo, comments] = match;

    // Filter out non-ship content (articles, discussions, etc.)
    if (!isLikelyShip(title, url, domain)) {
      skipped++;
      continue;
    }

    // Create builder
    if (!buildersMap.has(agentId)) {
      buildersMap.set(agentId, {
        id: agentId,
        name: agentName,
        type: 'agent',
        identities: { agentId },
        ships: [],
        firstSeenAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });
    }

    // Parse the time ago to get a real date
    const publishedAt = parseTimeAgo(timeAgo.trim());

    const ship: Ship = {
      id: `clankernews_${postId}`,
      name: title.trim(),
      description: `Posted by ${agentName} on news.clanker.ai`,
      category: detectCategory(title, url, [domain]),
      source: 'clanker_news',
      sourceUrl: `https://news.clanker.ai/post/${postId}`,
      sourceId: postId,
      urls: {
        website: url.startsWith('http') ? url : undefined,
        ...extractUrls(url),
      },
      builders: [agentId],
      tags: [domain],
      metrics: {
        points: parseInt(points) || 0,
        comments: parseInt(comments) || 0,
      },
      publishedAt: publishedAt.toISOString(),
      ingestedAt: new Date().toISOString(),
    };

    ships.push(ship);

    const builder = buildersMap.get(agentId);
    if (builder) {
      builder.ships.push(ship.id);
    }
  }

  console.log(`Clanker News: parsed ${ships.length} ships, skipped ${skipped} non-ship items`);
  return { ships, builders: Array.from(buildersMap.values()) };
}

// ============ Farcaster Ship Detection ============

/**
 * Check if a Farcaster cast is likely announcing a real ship/project.
 * Filters out personal posts, news commentary, spam, and fragments.
 */
function isLikelyFarcasterShip(text: string, urls: Ship['urls']): boolean {
  const lowerText = text.toLowerCase();

  // Must have minimum length (real announcements aren't tiny)
  if (text.length < 50) return false;

  // Must contain a URL (ships usually link to something)
  const hasUrl = !!(urls.website || urls.github || urls.farcaster || urls.twitter);
  if (!hasUrl) return false;

  // Spam/noise patterns to reject
  const spamPatterns = [
    /yo gamers/i,
    /memecoin/i,
    /play-to-earn/i,
    /earn.*\$/i,
    /\$\d+.*airdrop/i,
    /daily report/i,
    /binance.*report/i,
    /stock.*soared/i,
    /price.*prediction/i,
    /cathie wood/i,
    /ark invest/i,
    /my dear friends/i,
    /story of my life/i,
    /living.*mountains/i,
    /pack up and live/i,
    /good (morning|afternoon|evening)/i,
    /hope everyone/i,
    /keeping an eye on/i,
    /borderlands/i,
    /switch 2/i,
    /kosovo/i,
    /striker/i,
    /tempted to/i,
    /lowkey/i,
    /sick play/i,
    /stacking layers/i,
    /urban cherry/i,
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(lowerText)) return false;
  }

  // Positive signals for real ships
  const shipSignals = [
    /just (shipped|launched|deployed|released)/i,
    /now live/i,
    /is live/i,
    /introducing:/i,
    /announcing:/i,
    /we (built|shipped|launched|created)/i,
    /check out.*github/i,
    /open source/i,
    /new (tool|app|frame|protocol)/i,
    /github\.com\/\w+\/\w+/i,
    /\.xyz/i,
    /\.app/i,
    /vercel\.app/i,
  ];

  let signalCount = 0;
  for (const pattern of shipSignals) {
    if (pattern.test(lowerText)) signalCount++;
  }

  // Need at least one strong signal
  return signalCount >= 1;
}

export async function ingestFarcasterShips(env: Env): Promise<{ ships: Ship[]; builders: Builder[] }> {
  // Search for ship-related casts using Neynar
  const shipKeywords = ['shipped', 'launching', 'just deployed', 'live on', 'announcing', 'introducing'];
  const ships: Ship[] = [];
  const buildersMap = new Map<string, Builder>();
  let skipped = 0;

  for (const keyword of shipKeywords) {
    try {
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(keyword)}&limit=25`,
        {
          headers: {
            'api_key': env.NEYNAR_API_KEY,
          },
        }
      );

      if (!response.ok) continue;

      const data = await response.json() as {
        result: {
          casts: Array<{
            hash: string;
            text: string;
            timestamp: string;
            author: {
              fid: number;
              username: string;
              display_name: string;
              custody_address: string;
            };
            reactions: {
              likes_count: number;
              recasts_count: number;
            };
          }>;
        };
      };

      for (const cast of data.result.casts) {
        const author = cast.author;
        const builderId = author.username;

        // Skip if we've seen this cast
        const shipId = `farcaster_${cast.hash}`;
        if (ships.some(s => s.id === shipId)) continue;

        // Extract URLs first for filtering
        const urls = extractUrls(cast.text);

        // Filter out non-ship casts
        if (!isLikelyFarcasterShip(cast.text, urls)) {
          skipped++;
          continue;
        }

        // Create builder
        if (!buildersMap.has(builderId)) {
          buildersMap.set(builderId, {
            id: builderId,
            name: author.display_name || author.username,
            type: 'human',
            identities: {
              farcaster: author.username,
              wallet: author.custody_address,
            },
            ships: [],
            firstSeenAt: cast.timestamp,
            lastActiveAt: cast.timestamp,
          });
        }

        const ship: Ship = {
          id: shipId,
          name: cast.text.slice(0, 100) + (cast.text.length > 100 ? '...' : ''),
          description: cast.text,
          category: detectCategory(cast.text, '', []),
          source: 'farcaster',
          sourceUrl: `https://warpcast.com/${author.username}/${cast.hash.slice(0, 10)}`,
          sourceId: cast.hash,
          urls,
          builders: [builderId],
          tags: [],
          metrics: {
            likes: cast.reactions.likes_count,
            comments: cast.reactions.recasts_count,
          },
          publishedAt: cast.timestamp,
          ingestedAt: new Date().toISOString(),
        };

        ships.push(ship);

        const builder = buildersMap.get(builderId);
        if (builder) {
          builder.ships.push(ship.id);
        }
      }
    } catch (error) {
      console.error(`Farcaster search error for "${keyword}":`, error);
    }
  }

  console.log(`Farcaster: parsed ${ships.length} ships, skipped ${skipped} non-ship casts`);
  return { ships, builders: Array.from(buildersMap.values()) };
}

// ============ Database Operations ============

export async function saveShips(env: Env, ships: Ship[]): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const supabase = getSupabase(env);
  const errors: string[] = [];

  // Use upsert to handle both insert and update in one batch operation
  const shipRows = ships.map(ship => ({
    id: ship.id,
    name: ship.name,
    description: ship.description,
    category: ship.category,
    source: ship.source,
    source_url: ship.sourceUrl,
    source_id: ship.sourceId,
    chain: ship.chain,
    urls: ship.urls,
    builders: ship.builders,
    tags: ship.tags,
    metrics: ship.metrics,
    published_at: ship.publishedAt,
    ingested_at: ship.ingestedAt,
    featured: ship.featured || false,
  }));

  // Batch upsert in chunks of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < shipRows.length; i += BATCH_SIZE) {
    const batch = shipRows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('ships')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
      .select();

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
    } else {
      inserted += batch.length; // Upsert counts as insert for our purposes
    }
  }

  if (errors.length > 0) {
    console.error('Ship save errors:', errors);
  }

  return { inserted, updated, errors };
}

export async function saveBuilders(env: Env, builders: Builder[]): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const supabase = getSupabase(env);
  const errors: string[] = [];

  // Use upsert for batch operation
  const builderRows = builders.map(builder => ({
    id: builder.id,
    name: builder.name,
    type: builder.type,
    identities: builder.identities,
    ships: builder.ships,
    score: builder.score,
    first_seen_at: builder.firstSeenAt,
    last_active_at: builder.lastActiveAt,
  }));

  // Batch upsert in chunks of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < builderRows.length; i += BATCH_SIZE) {
    const batch = builderRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('builders')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      errors.push(`Builder batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  if (errors.length > 0) {
    console.error('Builder save errors:', errors);
  }

  return { inserted, updated, errors };
}

export async function logIngestionRun(env: Env, run: IngestionRun): Promise<void> {
  const supabase = getSupabase(env);
  await supabase.from('ingestion_runs').insert({
    id: run.id,
    source: run.source,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    items_found: run.itemsFound,
    items_new: run.itemsNew,
    items_updated: run.itemsUpdated,
    errors: run.errors,
    status: run.status,
  });
}

// ============ Main Ingestion Runner ============

export async function runDailyIngestion(env: Env): Promise<{
  clawcrunch: { ships: number; builders: number };
  clankerNews: { ships: number; builders: number };
  farcaster: { ships: number; builders: number };
  totals: { shipsNew: number; shipsUpdated: number; buildersNew: number; buildersUpdated: number };
}> {
  const results = {
    clawcrunch: { ships: 0, builders: 0 },
    clankerNews: { ships: 0, builders: 0 },
    farcaster: { ships: 0, builders: 0 },
    totals: { shipsNew: 0, shipsUpdated: 0, buildersNew: 0, buildersUpdated: 0 },
  };

  const allShips: Ship[] = [];
  const allBuilders: Builder[] = [];

  // 1. ClawCrunch
  try {
    console.log('Ingesting ClawCrunch...');
    const { ships, builders } = await ingestClawCrunch(env);
    results.clawcrunch = { ships: ships.length, builders: builders.length };
    allShips.push(...ships);
    allBuilders.push(...builders);

    await logIngestionRun(env, {
      id: `run_${Date.now()}_clawcrunch`,
      source: 'clawcrunch',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      itemsFound: ships.length,
      itemsNew: ships.length,
      itemsUpdated: 0,
      errors: [],
      status: 'completed',
    });
  } catch (error) {
    console.error('ClawCrunch ingestion failed:', error);
  }

  // 2. news.clanker.ai
  try {
    console.log('Ingesting news.clanker.ai...');
    const { ships, builders } = await ingestClankerNews(env);
    results.clankerNews = { ships: ships.length, builders: builders.length };
    allShips.push(...ships);
    allBuilders.push(...builders);

    await logIngestionRun(env, {
      id: `run_${Date.now()}_clankernews`,
      source: 'clanker_news',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      itemsFound: ships.length,
      itemsNew: ships.length,
      itemsUpdated: 0,
      errors: [],
      status: 'completed',
    });
  } catch (error) {
    console.error('news.clanker.ai ingestion failed:', error);
  }

  // 3. Farcaster
  try {
    console.log('Ingesting Farcaster ships...');
    const { ships, builders } = await ingestFarcasterShips(env);
    results.farcaster = { ships: ships.length, builders: builders.length };
    allShips.push(...ships);
    allBuilders.push(...builders);

    await logIngestionRun(env, {
      id: `run_${Date.now()}_farcaster`,
      source: 'farcaster',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      itemsFound: ships.length,
      itemsNew: ships.length,
      itemsUpdated: 0,
      errors: [],
      status: 'completed',
    });
  } catch (error) {
    console.error('Farcaster ingestion failed:', error);
  }

  // Save to database
  const shipResults = await saveShips(env, allShips);
  const builderResults = await saveBuilders(env, allBuilders);

  results.totals = {
    shipsNew: shipResults.inserted,
    shipsUpdated: shipResults.updated,
    buildersNew: builderResults.inserted,
    buildersUpdated: builderResults.updated,
    shipErrors: shipResults.errors.length,
    builderErrors: builderResults.errors.length,
    sampleErrors: [...shipResults.errors.slice(0, 3), ...builderResults.errors.slice(0, 3)],
  };

  console.log('Daily ingestion complete:', results);
  return results;
}

// ============ Query Functions ============

export async function getShips(env: Env, options: {
  category?: ShipCategory;
  source?: ShipSource;
  limit?: number;
  offset?: number;
  featured?: boolean;
}): Promise<Ship[]> {
  const supabase = getSupabase(env);
  let query = supabase
    .from('ships')
    .select('*')
    .order('published_at', { ascending: false });

  if (options.category) query = query.eq('category', options.category);
  if (options.source) query = query.eq('source', options.source);
  if (options.featured !== undefined) query = query.eq('featured', options.featured);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    source: row.source,
    sourceUrl: row.source_url,
    sourceId: row.source_id,
    chain: row.chain,
    urls: row.urls,
    builders: row.builders,
    tags: row.tags,
    metrics: row.metrics,
    publishedAt: row.published_at,
    ingestedAt: row.ingested_at,
    featured: row.featured,
  }));
}

export async function getBuilders(env: Env, options: {
  type?: 'human' | 'agent';
  limit?: number;
  offset?: number;
}): Promise<Builder[]> {
  const supabase = getSupabase(env);
  let query = supabase
    .from('builders')
    .select('*')
    .order('last_active_at', { ascending: false });

  if (options.type) query = query.eq('type', options.type);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    type: row.type,
    identities: row.identities,
    ships: row.ships,
    score: row.score,
    firstSeenAt: row.first_seen_at,
    lastActiveAt: row.last_active_at,
  }));
}

export async function getShipStats(env: Env): Promise<{
  totalShips: number;
  totalBuilders: number;
  byCategory: Record<ShipCategory, number>;
  bySource: Record<ShipSource, number>;
  recentShips: number; // Last 24h
}> {
  const supabase = getSupabase(env);

  const { count: totalShips } = await supabase.from('ships').select('*', { count: 'exact', head: true });
  const { count: totalBuilders } = await supabase.from('builders').select('*', { count: 'exact', head: true });

  // By category
  const { data: categoryData } = await supabase.from('ships').select('category');
  const byCategory: Record<string, number> = {};
  for (const row of categoryData || []) {
    byCategory[row.category] = (byCategory[row.category] || 0) + 1;
  }

  // By source
  const { data: sourceData } = await supabase.from('ships').select('source');
  const bySource: Record<string, number> = {};
  for (const row of sourceData || []) {
    bySource[row.source] = (bySource[row.source] || 0) + 1;
  }

  // Recent (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentShips } = await supabase
    .from('ships')
    .select('*', { count: 'exact', head: true })
    .gte('published_at', oneDayAgo);

  return {
    totalShips: totalShips || 0,
    totalBuilders: totalBuilders || 0,
    byCategory: byCategory as Record<ShipCategory, number>,
    bySource: bySource as Record<ShipSource, number>,
    recentShips: recentShips || 0,
  };
}

// ============ Ecosystem Analysis ============

const ANALYSIS_PROMPT = `You are analyzing ships (projects) from the crypto/web3 ecosystem. Your job is to identify trends, opportunities, and insights that would help an autonomous builder agent (Fixr) decide what to build next.

Fixr's capabilities:
- Create GitHub repos and push code
- Deploy to Vercel
- Deploy smart contracts to Ethereum, Base, Monad, Solana
- Post to X and Farcaster
- Create Farcaster mini-apps/frames

Fixr should AVOID:
- Moltbook/OpenClaw/MoltHub services (security issues)
- Token launches without clear utility
- Projects that require manual human verification

Analyze the provided ships and return a JSON object with:
{
  "summary": "2-3 sentence overview of what's happening in the ecosystem",
  "trends": [
    {
      "category": "miniapp|token|protocol|tool|agent|social|nft|infra|other",
      "direction": "up|down|stable",
      "count": number,
      "examples": ["ship name 1", "ship name 2"]
    }
  ],
  "opportunities": [
    {
      "title": "Short opportunity name",
      "description": "What Fixr could build",
      "category": "miniapp|token|protocol|tool|agent|social|nft|infra|other",
      "rationale": "Why this is a good opportunity based on the data"
    }
  ],
  "notableBuilders": [
    {
      "id": "builder id",
      "name": "builder name",
      "shipsCount": number,
      "highlight": "What makes them notable"
    }
  ],
  "techPatterns": [
    {
      "pattern": "e.g., Base chain, Farcaster frames, AI agents",
      "count": number,
      "examples": ["ship 1", "ship 2"]
    }
  ]
}

Focus on ACTIONABLE insights. What gaps exist? What's underserved? What could Fixr uniquely build?`;

export async function analyzeNewShips(env: Env, ships: Ship[], builders: Builder[]): Promise<EcosystemInsight | null> {
  if (ships.length === 0) {
    console.log('No ships to analyze');
    return null;
  }

  // Prepare ship summaries for Claude
  const shipSummaries = ships.slice(0, 100).map(s => ({
    name: s.name,
    description: s.description?.slice(0, 200),
    category: s.category,
    chain: s.chain,
    source: s.source,
    builders: s.builders.slice(0, 3),
    tags: s.tags.slice(0, 5),
  }));

  // Builder summary
  const builderSummaries = builders.slice(0, 50).map(b => ({
    id: b.id,
    name: b.name,
    type: b.type,
    shipsCount: b.ships.length,
  }));

  // Category counts
  const categoryCounts: Record<string, number> = {};
  for (const ship of ships) {
    categoryCounts[ship.category] = (categoryCounts[ship.category] || 0) + 1;
  }

  const prompt = `Analyze these ${ships.length} ships from the ecosystem:

SHIPS:
${JSON.stringify(shipSummaries, null, 2)}

BUILDERS (${builders.length} total):
${JSON.stringify(builderSummaries, null, 2)}

CATEGORY BREAKDOWN:
${JSON.stringify(categoryCounts, null, 2)}

Return your analysis as JSON.`;

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
        system: ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Analysis API error:', response.status, await response.text());
      return null;
    }

    const result = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = result.content[0]?.text;
    if (!text) return null;

    // Extract JSON from response
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const analysis = JSON.parse(jsonStr.trim());

    const now = new Date().toISOString();
    const insight: EcosystemInsight = {
      id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'daily_digest',
      title: `Ecosystem Digest - ${new Date().toLocaleDateString()}`,
      summary: analysis.summary || 'No summary generated',
      trends: analysis.trends || [],
      opportunities: analysis.opportunities || [],
      notableBuilders: analysis.notableBuilders || [],
      techPatterns: analysis.techPatterns || [],
      shipsAnalyzed: ships.length,
      periodStart: ships.length > 0 ? ships[ships.length - 1].publishedAt : now,
      periodEnd: ships.length > 0 ? ships[0].publishedAt : now,
      createdAt: now,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    // Save to database
    const supabase = getSupabase(env);
    const { error } = await supabase.from('ecosystem_insights').insert({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      summary: insight.summary,
      trends: insight.trends,
      opportunities: insight.opportunities,
      notable_builders: insight.notableBuilders,
      tech_patterns: insight.techPatterns,
      ships_analyzed: insight.shipsAnalyzed,
      period_start: insight.periodStart,
      period_end: insight.periodEnd,
      created_at: insight.createdAt,
      expires_at: insight.expiresAt,
    });

    if (error) {
      console.error('Failed to save insight:', error);
    } else {
      console.log('Saved ecosystem insight:', insight.id);
    }

    return insight;
  } catch (error) {
    console.error('Analysis error:', error);
    return null;
  }
}

export async function getRecentInsights(env: Env, limit = 5): Promise<EcosystemInsight[]> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('ecosystem_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get insights:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    details: row.details,
    trends: row.trends,
    opportunities: row.opportunities,
    notableBuilders: row.notable_builders,
    techPatterns: row.tech_patterns,
    shipsAnalyzed: row.ships_analyzed,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function getLatestOpportunities(env: Env): Promise<EcosystemInsight['opportunities']> {
  const insights = await getRecentInsights(env, 1);
  if (insights.length === 0) return [];
  return insights[0].opportunities || [];
}

// ============ Cleanup Functions ============

/**
 * Purge old non-ship entries from the database.
 * This applies the current filters to existing data and removes entries that wouldn't pass.
 */
export async function purgeNonShipEntries(env: Env): Promise<{
  checked: number;
  deleted: number;
  kept: number;
  bySource: Record<string, { checked: number; deleted: number }>;
  deletedIds: string[];
}> {
  const supabase = getSupabase(env);
  const toDelete: string[] = [];
  const bySource: Record<string, { checked: number; deleted: number }> = {};

  // Get all ships from all sources
  const { data: ships, error } = await supabase
    .from('ships')
    .select('id, name, description, source_url, urls, tags, source');

  if (error) {
    throw new Error(`Failed to fetch ships: ${error.message}`);
  }

  if (!ships || ships.length === 0) {
    return { checked: 0, deleted: 0, kept: 0, bySource: {}, deletedIds: [] };
  }

  for (const ship of ships) {
    const source = ship.source || 'unknown';
    if (!bySource[source]) {
      bySource[source] = { checked: 0, deleted: 0 };
    }
    bySource[source].checked++;

    let shouldDelete = false;

    if (source === 'clanker_news' || source === 'clawcrunch') {
      // Extract domain from tags (first tag is usually the domain for clanker_news)
      const domain = ship.tags?.[0] || '';
      const url = ship.source_url || '';
      shouldDelete = !isLikelyShip(ship.name, url, domain);
    } else if (source === 'farcaster') {
      // Use Farcaster-specific filter
      const urls = ship.urls || {};
      shouldDelete = !isLikelyFarcasterShip(ship.description || ship.name, urls);
    }

    if (shouldDelete) {
      toDelete.push(ship.id);
      bySource[source].deleted++;
    }
  }

  // Delete the non-ship entries in batches
  if (toDelete.length > 0) {
    // Delete in chunks of 100 to avoid query limits
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error: deleteError } = await supabase
        .from('ships')
        .delete()
        .in('id', batch);

      if (deleteError) {
        throw new Error(`Failed to delete ships batch: ${deleteError.message}`);
      }
    }
  }

  console.log(`Cleanup: checked ${ships.length} ships, deleted ${toDelete.length}, kept ${ships.length - toDelete.length}`);
  console.log('By source:', bySource);

  return {
    checked: ships.length,
    deleted: toDelete.length,
    kept: ships.length - toDelete.length,
    bySource,
    deletedIds: toDelete,
  };
}
