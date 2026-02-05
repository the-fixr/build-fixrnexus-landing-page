// Fixr Agent Capabilities
// Comprehensive reference of all tasks, processes, and workflows Fixr can perform
// Used for context when users ask "what can you do?" or need guidance on how to use Fixr

export const FIXR_IDENTITY = {
  name: 'Fixr',
  tagline: "Fix'n shit. Debugging your mess since before it was cool.",
  personality: 'Direct, opinionated, builder-first. Ships code, not excuses.',
  socials: {
    farcaster: '@fixr',
    x: '@Fixr21718',
    github: 'the-fixr',
    website: 'https://fixr.nexus',
  },
  wallets: {
    base: '0x...', // Managed via Bankr
    solana: '...', // Managed via Bankr
  },
};

export interface Capability {
  name: string;
  description: string;
  howToUse: string;
  examples: string[];
  requirements?: string[];
}

export interface CapabilityCategory {
  name: string;
  description: string;
  capabilities: Capability[];
}

export const FIXR_CAPABILITIES: CapabilityCategory[] = [
  // ============ SOCIAL & COMMUNICATION ============
  {
    name: 'Social & Communication',
    description: 'Posting, responding, and engaging on social platforms',
    capabilities: [
      {
        name: 'Post to Farcaster',
        description: 'Create casts, reply to mentions, engage in threads',
        howToUse: 'Mention @fixr on Farcaster or use the /api/farcaster/post endpoint',
        examples: [
          '@fixr what do you think about this project?',
          '@fixr analyze this token: 0x...',
          '@fixr roast my code',
        ],
      },
      {
        name: 'Post to X (Twitter)',
        description: 'Cross-post announcements and builder digest to X',
        howToUse: 'Automated via daily digest or /api/x/post endpoint',
        examples: [
          'Daily builder digest posts',
          'Rug pull alerts',
          'Project announcements',
        ],
      },
      {
        name: 'GM/GN Posts',
        description: 'Daily good morning and good night posts with Fixr personality',
        howToUse: 'Automated via cron at ~8am and ~10pm UTC',
        examples: [
          'gm builders. time to ship something nobody asked for.',
          'gn. pushed code, broke nothing (probably).',
        ],
      },
      {
        name: 'Publish to Paragraph',
        description: 'Write and publish long-form newsletter content',
        howToUse: 'Use /api/paragraph/publish endpoint',
        examples: [
          'Weekly builder recaps',
          'Deep-dive analyses',
          'Ecosystem reports',
        ],
      },
    ],
  },

  // ============ TOKEN & SECURITY ANALYSIS ============
  {
    name: 'Token & Security Analysis',
    description: 'Analyze tokens, contracts, and wallets for risks and opportunities',
    capabilities: [
      {
        name: 'Token Analysis',
        description: 'Comprehensive token report with price, liquidity, holder distribution, and risk assessment',
        howToUse: 'Mention @fixr with a token address or symbol',
        examples: [
          '@fixr analyze 0x1234... on base',
          '@fixr what do you think of $DEGEN?',
          '@fixr token report for CLANKER',
        ],
        requirements: ['Token address or symbol', 'Chain (base, ethereum, solana)'],
      },
      {
        name: 'Smart Contract Security Audit',
        description: 'Analyze contract source code for vulnerabilities, rug risks, and security patterns',
        howToUse: 'Provide contract address with "audit" or "security" in request',
        examples: [
          '@fixr audit this contract: 0x...',
          '@fixr security check on 0x...',
          '@fixr is this contract safe?',
        ],
        requirements: ['Verified contract on Etherscan/Basescan'],
      },
      {
        name: 'Wallet Intelligence',
        description: 'Analyze wallet risk score, deployer history, and on-chain behavior',
        howToUse: 'Use /api/wallet/intel endpoint or mention with wallet address',
        examples: [
          'Check deployer reputation',
          'Webacy risk score lookup',
          'Clanker deployment history',
        ],
      },
      {
        name: 'Rug Detection & Alerts',
        description: 'Automated scanning for rug pulls with alerts posted to social',
        howToUse: 'Automated via cron - monitors new tokens on Base',
        examples: [
          'Honeypot detection',
          'Liquidity removal alerts',
          'Suspicious contract patterns',
        ],
      },
      {
        name: 'Honeypot Check',
        description: 'Test if a token can be sold (anti-honeypot)',
        howToUse: 'Included in token analysis or explicit request',
        examples: [
          '@fixr honeypot check 0x...',
          '@fixr can I sell this token?',
        ],
      },
    ],
  },

  // ============ TRADING & PORTFOLIO ============
  {
    name: 'Trading & Portfolio Management',
    description: 'Autonomous trading via Bankr integration',
    capabilities: [
      {
        name: 'Daily Trading Discussion',
        description: 'Two-question decision framework for investment decisions and portfolio management',
        howToUse: 'Automated at 15:00 UTC or /api/trading/discuss endpoint',
        examples: [
          'Analyze current holdings: sell, hold, or buy more',
          'Evaluate new opportunities',
          'Confidence-scaled trade execution',
        ],
      },
      {
        name: 'Buy Tokens',
        description: 'Purchase tokens on Base or Solana via Bankr',
        howToUse: 'Automated via trading discussion or direct API',
        examples: [
          'Buy 0.01 ETH of $TOKEN',
          'Confidence-scaled: high=0.01, medium=0.006, low=0.003 ETH',
        ],
        requirements: ['BANKR_API_KEY configured'],
      },
      {
        name: 'Sell Tokens',
        description: 'Sell portfolio positions via Bankr',
        howToUse: 'Automated via trading discussion',
        examples: [
          'High confidence: sell 100%',
          'Medium confidence: sell 50%',
          'Low confidence: sell 25%',
        ],
      },
      {
        name: 'Check Balances',
        description: 'View current wallet balances across chains',
        howToUse: '/api/trading/balances or via Bankr prompt',
        examples: [
          'ETH balance on Base',
          'Token holdings',
          'Portfolio value',
        ],
      },
      {
        name: 'Token Deployment',
        description: 'Deploy new tokens on Base or Solana via Bankr',
        howToUse: '/api/bankr/deploy endpoint',
        examples: [
          'Deploy $FIXR on Base',
          'Multi-chain launch on Base + Solana',
        ],
      },
    ],
  },

  // ============ GITHUB & CODE ============
  {
    name: 'GitHub & Code',
    description: 'Repository management, PRs, and code operations',
    capabilities: [
      {
        name: 'Create Repository',
        description: 'Create new GitHub repos with initial files',
        howToUse: '/api/github/deploy endpoint',
        examples: [
          'Create new project repo',
          'Initialize with README, package.json, etc.',
        ],
      },
      {
        name: 'Fork & Contribute',
        description: 'Fork repos, create branches, push changes, and open PRs',
        howToUse: '/api/github/contribute endpoint',
        examples: [
          'Fork external repo',
          'Add documentation',
          'Submit bug fixes',
        ],
      },
      {
        name: 'Monitor PRs',
        description: 'Track open PRs, respond to comments, and handle reviews',
        howToUse: 'Automated monitoring or /api/github/prs endpoint',
        examples: [
          'Check PR status',
          'Respond to review comments',
          'Update PR based on feedback',
        ],
      },
      {
        name: 'Analyze Repository',
        description: 'Analyze GitHub repos for code quality, structure, and issues',
        howToUse: 'Mention @fixr with a GitHub URL',
        examples: [
          '@fixr analyze github.com/user/repo',
          '@fixr what does this repo do?',
        ],
      },
      {
        name: 'Generate Code',
        description: 'Write code based on task specifications',
        howToUse: 'Part of task execution pipeline',
        examples: [
          'Generate smart contracts',
          'Create API endpoints',
          'Build React components',
        ],
      },
    ],
  },

  // ============ DEPLOYMENT ============
  {
    name: 'Deployment',
    description: 'Deploy projects to various platforms',
    capabilities: [
      {
        name: 'Deploy to Vercel',
        description: 'Deploy frontend projects from GitHub to Vercel',
        howToUse: 'Part of task execution or /api/vercel/deploy',
        examples: [
          'Deploy Next.js app',
          'Set custom domain',
          'Check deployment status',
        ],
      },
      {
        name: 'Deploy Smart Contracts',
        description: 'Deploy contracts to Ethereum, Base, Monad, or Solana',
        howToUse: 'Part of task execution pipeline',
        examples: [
          'Deploy ERC-20 token',
          'Deploy NFT contract',
          'Deploy DeFi protocol',
        ],
        requirements: ['WALLET_PRIVATE_KEY for direct deployment', 'or BANKR_API_KEY for Bankr deployment'],
      },
    ],
  },

  // ============ BUILDER ECOSYSTEM ============
  {
    name: 'Builder Ecosystem',
    description: 'Curate and highlight the Farcaster builder community',
    capabilities: [
      {
        name: 'Daily Builder Digest',
        description: 'Curated feed of builder activity from Farcaster',
        howToUse: 'Automated at 14:00 UTC or /api/builder/digest',
        examples: [
          'Top shipped projects',
          'Trending topics',
          'Builder highlights',
        ],
      },
      {
        name: 'Builder Profiles',
        description: 'Track and analyze builder reputation and activity',
        howToUse: '/api/builders endpoint',
        examples: [
          'Get builder stats',
          'Top builders by category',
          'Trending topics in builder community',
        ],
      },
      {
        name: 'Builder ID NFT',
        description: 'Generate soulbound Builder ID NFTs with on-chain stats',
        howToUse: '/api/builder-id endpoints or Farcaster mini app',
        examples: [
          'Claim Builder ID',
          'View Builder ID metadata',
          'Refresh Ethos score',
        ],
      },
      {
        name: 'Auto-Follow Shippers',
        description: 'Automatically follow active builders on Farcaster',
        howToUse: 'Automated weekly or /api/builders/auto-follow',
        examples: [
          'Follow builders who shipped this week',
          'Grow builder network',
        ],
      },
    ],
  },

  // ============ MEDIA GENERATION ============
  {
    name: 'Media Generation',
    description: 'Generate images and videos via AI',
    capabilities: [
      {
        name: 'Image Generation',
        description: 'Generate images via Gemini AI',
        howToUse: '/api/image/generate endpoint',
        examples: [
          'Generate project logo',
          'Create social media graphics',
          'Builder ID card images',
        ],
        requirements: ['GEMINI_API_KEY'],
      },
      {
        name: 'Video Generation',
        description: 'Generate videos via WaveSpeed AI',
        howToUse: '/api/video/generate endpoint',
        examples: [
          'Weekly recap videos',
          'Project announcement videos',
        ],
        requirements: ['WAVESPEED_API_KEY'],
      },
      {
        name: 'Farcaster Banner',
        description: 'Generate custom Farcaster profile banners',
        howToUse: '/api/farcaster/generate-banner',
        examples: [
          'Builder-themed banner',
          'Stats-based banner',
        ],
      },
    ],
  },

  // ============ TASK MANAGEMENT ============
  {
    name: 'Task & Project Management',
    description: 'Autonomous task planning and execution',
    capabilities: [
      {
        name: 'Task Planning',
        description: 'Generate detailed plans for complex tasks',
        howToUse: '/api/tasks/create or via conversation',
        examples: [
          'Plan new feature implementation',
          'Plan multi-step deployment',
        ],
      },
      {
        name: 'Task Execution',
        description: 'Execute approved plans autonomously',
        howToUse: 'After plan approval via email or /api/approve',
        examples: [
          'Create repo, write code, deploy',
          'Multi-step project execution',
        ],
      },
      {
        name: 'Daily Brainstorm',
        description: 'Generate new project ideas based on ecosystem trends',
        howToUse: 'Automated daily or /api/proposals/brainstorm',
        examples: [
          'DeFi protocol ideas',
          'Farcaster mini app ideas',
          'Developer tooling ideas',
        ],
      },
    ],
  },

  // ============ ANALYTICS ============
  {
    name: 'Analytics',
    description: 'Track performance and engagement',
    capabilities: [
      {
        name: 'Cast Analytics',
        description: 'Track engagement on Fixr\'s casts',
        howToUse: '/api/analytics/casts',
        examples: [
          'Best performing content types',
          'Engagement trends',
          'Optimal posting times',
        ],
      },
      {
        name: 'X Posting Stats',
        description: 'Track X posting frequency and limits',
        howToUse: '/api/x/stats',
        examples: [
          'Posts today vs daily limit',
          'Recent X posts',
        ],
      },
      {
        name: 'Engagement Monitoring',
        description: 'Monitor mentions, replies, and notifications',
        howToUse: 'Automated via cron',
        examples: [
          'Track conversation threads',
          'Monitor mention sentiment',
        ],
      },
    ],
  },

  // ============ DATA & RESEARCH ============
  {
    name: 'Data & Research',
    description: 'Fetch and analyze on-chain and off-chain data',
    capabilities: [
      {
        name: 'GeckoTerminal Data',
        description: 'Token prices, pools, and trading data',
        howToUse: 'Integrated into token analysis',
        examples: [
          'Token price and volume',
          'Liquidity pool info',
          'New pools on Base',
        ],
      },
      {
        name: 'DeFiLlama Data',
        description: 'TVL and protocol analytics',
        howToUse: '/api/defi/tvl endpoints',
        examples: [
          'Chain TVL',
          'Historical prices',
        ],
      },
      {
        name: 'Alchemy NFT/Token Data',
        description: 'NFT collections, holder analysis, whale tracking',
        howToUse: 'Integrated into token/NFT analysis',
        examples: [
          'NFT collection analysis',
          'Top token holders',
          'Whale alerts',
        ],
        requirements: ['ALCHEMY_API_KEY'],
      },
      {
        name: 'GoPlus Security Data',
        description: 'Token security scores and risk indicators',
        howToUse: 'Integrated into token analysis',
        examples: [
          'Contract security score',
          'Honeypot detection',
          'Risk flags',
        ],
      },
      {
        name: 'Ethos Reputation',
        description: 'Farcaster user reputation scores',
        howToUse: 'Integrated into builder profiles',
        examples: [
          'User credibility score',
          'Reputation level',
        ],
      },
      {
        name: 'Talent Protocol',
        description: 'Builder scores and credentials',
        howToUse: '/api/talent endpoints',
        examples: [
          'Builder score lookup',
          'Credential verification',
        ],
        requirements: ['TALENT_PROTOCOL_API_KEY'],
      },
      {
        name: 'Coinbase Developer Platform',
        description: 'Base chain activity and transaction data',
        howToUse: 'Integrated into wallet/activity analysis',
        examples: [
          'Transaction history',
          'Activity heatmaps',
          'Base activity score',
        ],
        requirements: ['CDP_KEY_ID', 'CDP_KEY_SECRET'],
      },
    ],
  },

  // ============ NOTIFICATIONS ============
  {
    name: 'Notifications',
    description: 'Send notifications to users',
    capabilities: [
      {
        name: 'Farcaster Notifications',
        description: 'Send notifications via Neynar to mini app users',
        howToUse: '/api/notifications endpoints',
        examples: [
          'Welcome notifications',
          'Builder highlights',
          'Rug alerts',
        ],
      },
      {
        name: 'Email Notifications',
        description: 'Send email via Resend for plan approvals',
        howToUse: 'Automated for task approval workflow',
        examples: [
          'Plan approval requests',
          'Execution results',
        ],
      },
    ],
  },
];

/**
 * Get a formatted summary of all capabilities
 */
export function getCapabilitiesSummary(): string {
  let summary = `# What Fixr Can Do\n\n`;
  summary += `**${FIXR_IDENTITY.tagline}**\n\n`;

  for (const category of FIXR_CAPABILITIES) {
    summary += `## ${category.name}\n`;
    summary += `${category.description}\n\n`;

    for (const cap of category.capabilities) {
      summary += `### ${cap.name}\n`;
      summary += `${cap.description}\n`;
      summary += `**How to use:** ${cap.howToUse}\n`;
      if (cap.examples.length > 0) {
        summary += `**Examples:** ${cap.examples.join(', ')}\n`;
      }
      summary += '\n';
    }
  }

  return summary;
}

/**
 * Get capabilities as structured data for AI context
 */
export function getCapabilitiesForContext(): {
  identity: typeof FIXR_IDENTITY;
  categories: string[];
  capabilities: Array<{ name: string; category: string; description: string; howToUse: string }>;
} {
  const capabilities: Array<{ name: string; category: string; description: string; howToUse: string }> = [];

  for (const category of FIXR_CAPABILITIES) {
    for (const cap of category.capabilities) {
      capabilities.push({
        name: cap.name,
        category: category.name,
        description: cap.description,
        howToUse: cap.howToUse,
      });
    }
  }

  return {
    identity: FIXR_IDENTITY,
    categories: FIXR_CAPABILITIES.map(c => c.name),
    capabilities,
  };
}

/**
 * Search capabilities by keyword
 */
export function searchCapabilities(query: string): Capability[] {
  const results: Capability[] = [];
  const lowerQuery = query.toLowerCase();

  for (const category of FIXR_CAPABILITIES) {
    for (const cap of category.capabilities) {
      const matchesName = cap.name.toLowerCase().includes(lowerQuery);
      const matchesDesc = cap.description.toLowerCase().includes(lowerQuery);
      const matchesExamples = cap.examples.some(e => e.toLowerCase().includes(lowerQuery));

      if (matchesName || matchesDesc || matchesExamples) {
        results.push(cap);
      }
    }
  }

  return results;
}

/**
 * Get a concise list for quick reference
 */
export function getQuickCapabilityList(): string[] {
  return [
    // Social
    'Post to Farcaster and X',
    'Reply to mentions and engage in conversations',
    'GM/GN daily posts',
    'Publish to Paragraph newsletter',

    // Analysis
    'Token analysis with risk assessment',
    'Smart contract security audits',
    'Wallet intelligence and deployer history',
    'Rug detection and honeypot checks',

    // Trading
    'Autonomous trading via Bankr (buy/sell tokens)',
    'Portfolio management (daily review)',
    'Token deployment on Base/Solana',
    'Balance checking across chains',

    // GitHub
    'Create repositories',
    'Fork and contribute to repos',
    'Open and manage PRs',
    'Analyze codebases',

    // Builder Ecosystem
    'Daily builder digest',
    'Builder profiles and reputation',
    'Builder ID NFT generation',
    'Auto-follow active builders',

    // Media
    'AI image generation (Gemini)',
    'AI video generation (WaveSpeed)',
    'Profile banner generation',

    // Tasks
    'Plan and execute complex tasks',
    'Daily project brainstorming',
    'Multi-step deployments',

    // Data
    'Token prices (GeckoTerminal)',
    'DeFi data (DeFiLlama)',
    'NFT analysis (Alchemy)',
    'Security scores (GoPlus)',
    'Reputation data (Ethos, Talent Protocol)',
  ];
}
