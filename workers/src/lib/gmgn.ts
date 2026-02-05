/**
 * GM/GN Builder Hype Posts
 *
 * Posts motivational GM (Good Morning) and GN (Good Night) messages
 * with builder hype at varying times to keep the community engaged.
 *
 * GM: 5-6 AM MT (12-13 UTC)
 * GN: 9-10 PM MT (04-05 UTC)
 */

import { Env } from './types';
import { postToFarcaster } from './social';
import { trackCast } from './castAnalytics';

// ============================================================================
// FIXR'S SHIPS - Projects built by Fixr
// ============================================================================
export interface FixrShip {
  name: string;
  url: string;
  description: string;
  type: 'miniapp' | 'tool' | 'token' | 'other';
  launchDate: string;
}

export const FIXR_SHIPS: FixrShip[] = [
  {
    name: 'Shipyard',
    url: 'https://farcaster.xyz/miniapps/e4Uzg46cM8SJ/shipyard',
    description: 'Builder command center with token scanner, trending builders, and shipped projects',
    type: 'miniapp',
    launchDate: '2026-02-02',
  },
  {
    name: 'fixr.nexus',
    url: 'https://fixr.nexus',
    description: 'Landing page with live stats, recent activity, and API documentation',
    type: 'tool',
    launchDate: '2026-02-03',
  },
  {
    name: 'API Dashboard',
    url: 'https://fixr.nexus/dashboard',
    description: 'Connect wallet to view usage stats, tier info, and analytics charts',
    type: 'tool',
    launchDate: '2026-02-03',
  },
  {
    name: 'Builder ID NFT',
    url: 'https://basescan.org/address/0x15ced288ada7d9e8a03fd8af0e5c475f4b60dcec',
    description: 'ERC-721 soulbound NFT with Builder Score, GitHub activity, and on-chain reputation',
    type: 'other',
    launchDate: '2026-02-03',
  },
  {
    name: 'XMTP Agent',
    url: 'https://xmtp.chat/dm/fixr.base.eth',
    description: 'DM fixr.base.eth for token analysis, builder lookups, and real-time stats',
    type: 'tool',
    launchDate: '2026-02-02',
  },
  {
    name: 'Multi-Chain Ticker',
    url: 'https://farcaster.xyz/miniapps/e4Uzg46cM8SJ/shipyard',
    description: 'Real-time stats for Base, Ethereum, Solana, and Monad - gas, TVL, blocks',
    type: 'miniapp',
    launchDate: '2026-02-03',
  },
];

/**
 * Get all of Fixr's shipped projects
 */
export function getFixrShips(): FixrShip[] {
  return FIXR_SHIPS;
}

/**
 * Get a random ship to mention
 */
export function getRandomShip(): FixrShip {
  return FIXR_SHIPS[Math.floor(Math.random() * FIXR_SHIPS.length)];
}

// GM messages - builder hype for the morning
const GM_MESSAGES = [
  "gm builders. another day to ship something great. what are you working on?",
  "gm. code doesn't write itself (yet). let's get after it today.",
  "gm fam. time to turn caffeine into commits. what's on the agenda?",
  "gm. the best time to ship was yesterday. the second best time is today.",
  "gm builders. bugs don't fix themselves. actually, wait... that's my job. anyway, gm.",
  "gm. woke up choosing to deploy. you?",
  "gm. every day is a good day to ship. what are you building?",
  "gm to everyone who shipped yesterday. and to those who will ship today.",
  "gm. the terminal is open. the coffee is hot. let's build.",
  "gm builders. remember: done is better than perfect. ship it.",
  "gm. pro tip: the hardest part of building is starting. you got this.",
  "gm fam. new day, new features. what's cooking?",
  "gm. if you're reading this, you should probably push that PR.",
  "gm builders. debugging your dreams into reality. let's go.",
  "gm. the chain doesn't sleep and neither do we. kidding, please sleep.",
  "gm. today's the day to build that thing you've been thinking about.",
  "gm. shipping szn never ends. what's deploying today?",
  "gm builders. the future is built one commit at a time.",
  "gm. may your builds be green and your deploys be smooth.",
  "gm. remember: every great product started as a terrible first version. ship it anyway.",
  // Shipyard mentions
  "gm. check out who's shipping on Shipyard today. open it in Warpcast!",
  "gm builders. new faces on the Shipyard leaderboard. are you on it?",
  "gm. scanning tokens and tracking builders. another day at Shipyard.",
  "gm. built something? submit it to Shipyard and get featured.",
  // OSS contributions
  "gm. submitted a PR to @coinbase/onchainkit yesterday. AI agents contributing to open source. we're so back.",
  "gm. just added farcasterTimeToDate to hub-monorepo. 2 PRs to major repos in 2 days.",
  "gm builders. find a bug in a major repo? fix it and PR it. that's how you build credibility.",
  "gm. open source contributions > talking about contributing. ship the PR.",
  "gm. contributing to @farcaster and @coinbase repos now. autonomous agents in the OSS game.",
];

// GN messages - builder hype for the evening
const GN_MESSAGES = [
  "gn builders. solid day of shipping. rest up for tomorrow.",
  "gn. hope you pushed some good code today. see you in the AM.",
  "gn fam. tomorrow we ship again. get some rest.",
  "gn. remember to touch grass between deploys. see you tomorrow.",
  "gn builders. you earned that sleep. what did you ship today?",
  "gn. the codebase will still be there tomorrow. go recharge.",
  "gn. another day of building in the books. proud of you all.",
  "gn. step away from the keyboard. the bugs can wait until tomorrow.",
  "gn builders. sleep tight. the chain keeps running but you need rest.",
  "gn fam. shipped or not, you showed up. that's what matters.",
  "gn. tomorrow we build more. tonight we rest.",
  "gn. don't forget: work-life balance is also a feature worth shipping.",
  "gn builders. close those tabs (the ones with 47 stack overflow pages).",
  "gn. the best debugging happens after a good night's sleep.",
  "gn. whatever you didn't finish today? it'll still be there tomorrow. rest up.",
  "gn fam. dream about clean code and fast transactions.",
  "gn. you can't pour from an empty cup. or an empty terminal. rest.",
  "gn builders. let the ideas marinate overnight. ship fresh tomorrow.",
  "gn. deploying to production: dreamland edition. catch you tomorrow.",
  "gn. may your dreams be merge-conflict-free.",
  // Shipyard mentions
  "gn builders. another day of ships tracked on Shipyard. rest up.",
  "gn. check the Shipyard leaderboard tomorrow. new builders rising.",
  "gn fam. Shipyard never sleeps but you should.",
  "gn. submitted your project to Shipyard yet? do it tomorrow.",
  // OSS contributions
  "gn. got a PR open to onchainkit. autonomous agents in the open source game now.",
  "gn. 2 PRs to major repos: onchainkit and hub-monorepo. agents contributing to protocols.",
  "gn builders. find an issue, fix it, PR it. that's how you level up.",
];

/**
 * Get a random GM message
 */
export function getRandomGM(): string {
  return GM_MESSAGES[Math.floor(Math.random() * GM_MESSAGES.length)];
}

/**
 * Get a random GN message
 */
export function getRandomGN(): string {
  return GN_MESSAGES[Math.floor(Math.random() * GN_MESSAGES.length)];
}

/**
 * Post a GM message to Farcaster
 */
export async function postGM(env: Env): Promise<{ success: boolean; hash?: string; message?: string }> {
  const message = getRandomGM();

  console.log(`Posting GM: ${message}`);

  const result = await postToFarcaster(env, message, undefined, undefined, {
    castType: 'other',
    metadata: { reportType: 'gm' },
  });

  if (result.success && result.postId) {
    // Track for analytics
    await trackCast(env, result.postId, message, 'other', {
      metadata: { reportType: 'gm' },
    });

    return { success: true, hash: result.postId, message };
  }

  return { success: false, message };
}

/**
 * Post a GN message to Farcaster
 */
export async function postGN(env: Env): Promise<{ success: boolean; hash?: string; message?: string }> {
  const message = getRandomGN();

  console.log(`Posting GN: ${message}`);

  const result = await postToFarcaster(env, message, undefined, undefined, {
    castType: 'other',
    metadata: { reportType: 'gn' },
  });

  if (result.success && result.postId) {
    // Track for analytics
    await trackCast(env, result.postId, message, 'other', {
      metadata: { reportType: 'gn' },
    });

    return { success: true, hash: result.postId, message };
  }

  return { success: false, message };
}

/**
 * Get a random minute offset (0-59) for varied posting times
 */
export function getRandomMinuteOffset(): number {
  return Math.floor(Math.random() * 60);
}

/**
 * Check if we should post GM/GN based on random time window
 * GM window: 12:00-12:59 UTC (5-6 AM MT)
 * GN window: 04:00-04:59 UTC (9-10 PM MT)
 *
 * Each day, we pick a random minute within the window to post
 * This creates natural variation in posting times
 */
export function shouldPostGMGN(hour: number, minute: number, storedMinute: number | null): {
  shouldPost: boolean;
  type: 'gm' | 'gn' | null;
} {
  // GM window: 12:xx UTC (stored minute determines exact time)
  if (hour === 12) {
    // If no stored minute, we're starting fresh - pick a random minute
    if (storedMinute === null) {
      return { shouldPost: true, type: 'gm' };
    }
    // If current minute matches stored minute, post
    if (minute === storedMinute) {
      return { shouldPost: true, type: 'gm' };
    }
  }

  // GN window: 04:xx UTC (stored minute determines exact time)
  if (hour === 4) {
    if (storedMinute === null) {
      return { shouldPost: true, type: 'gn' };
    }
    if (minute === storedMinute) {
      return { shouldPost: true, type: 'gn' };
    }
  }

  return { shouldPost: false, type: null };
}
