// Fixr Agent Types

export type TaskStatus = 'pending' | 'planning' | 'awaiting_approval' | 'approved' | 'executing' | 'completed' | 'failed';

export type Chain = 'ethereum' | 'base' | 'monad' | 'solana';

export interface Task {
  id: string;
  title: string;
  description: string;
  chain?: Chain;
  status: TaskStatus;
  plan?: Plan;
  result?: TaskResult;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  taskId: string;
  summary: string;
  steps: PlanStep[];
  estimatedTime: string;
  risks: string[];
  createdAt: string;
  approvedAt?: string;
}

export interface PlanStep {
  order: number;
  action: 'code' | 'deploy' | 'contract' | 'post' | 'other';
  description: string;
  details: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  outputs: TaskOutput[];
  error?: string;
  completedAt: string;
  executionProgress?: {
    lastCompletedStep: number;
    totalSteps: number;
    startedAt: string;
  };
}

export interface TaskOutput {
  type: 'repo' | 'deployment' | 'contract' | 'post' | 'file';
  url?: string;
  data?: Record<string, unknown>;
}

export interface AgentMemory {
  identity: {
    name: string;
    tagline: string;
    email: string;
    socials: {
      x: string;
      farcaster: string;
      website: string;
    };
  };
  goals: string[];
  tasks: Task[];
  completedProjects: CompletedProject[];
  wallets: {
    ethereum: string;
    solana: string;
  };
}

export interface CompletedProject {
  id: string;
  name: string;
  description: string;
  chain: Chain;
  urls: {
    repo?: string;
    deployment?: string;
    contract?: string;
    post?: string;
  };
  completedAt: string;
}

export interface ApprovalRequest {
  id: string;
  planId: string;
  taskId: string;
  sentAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  respondedAt?: string;
}

export interface PlanEmail {
  to: string;
  subject: string;
  plan: Plan;
  task: Task;
  approvalLink: string;
  rejectLink: string;
}

// Environment bindings for Cloudflare Workers
export interface Env {
  // Database
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // AI
  ANTHROPIC_API_KEY: string;

  // GitHub
  GITHUB_TOKEN: string;
  GITHUB_CLIENT_ID?: string; // OAuth App client ID for user auth
  GITHUB_CLIENT_SECRET?: string; // OAuth App client secret

  // Vercel
  VERCEL_TOKEN: string;
  VERCEL_TEAM_ID: string;

  // X (Twitter)
  X_API_KEY: string;
  X_API_SECRET: string;
  X_ACCESS_TOKEN: string;
  X_ACCESS_SECRET: string;

  // Farcaster (Neynar)
  NEYNAR_API_KEY: string;
  FARCASTER_SIGNER_UUID: string;
  FARCASTER_FID: string;
  NEYNAR_WEBHOOK_SECRET: string;

  // x402 Payments (gasless USDC micropayments via Neynar wallet)
  USE_X402_PAYMENTS: string; // 'true' to enable
  NEYNAR_WALLET_ID: string; // Neynar managed wallet ID for x402

  // Email
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  OWNER_EMAIL: string;

  // Security
  CRON_SECRET: string;

  // App
  APP_URL: string;

  // Moltbook (AI social network)
  MOLTBOOK_API_KEY: string;

  // Gemini (image generation)
  GEMINI_API_KEY: string;

  // On-chain wallet (for Base transactions like Farcaster Pro purchase)
  WALLET_PRIVATE_KEY?: string;
  BASE_RPC_URL?: string; // Optional Base RPC URL (defaults to public RPC)

  // Paragraph (newsletter publishing)
  PARAGRAPH_API_KEY: string;

  // Block explorer API key (Etherscan V2 uses single key for all chains)
  ETHERSCAN_API_KEY?: string;

  // Webacy (wallet risk scoring and threat detection)
  WEBACY_API_KEY?: string;

  // WaveSpeedAI (video generation)
  WAVESPEED_API_KEY?: string;

  // Livepeer (video hosting)
  LIVEPEER_API_KEY?: string;

  // Clanker.world (Farcaster-native token launcher)
  CLANKER_API_KEY?: string;

  // Alchemy (NFT data, token balances, whale tracking)
  ALCHEMY_API_KEY?: string;

  // Talent Protocol (builder reputation and scores)
  TALENT_PROTOCOL_API_KEY?: string;

  // Bankr (AI crypto trading agent)
  BANKR_API_KEY?: string; // API key from bankr.bot/api (starts with bk_)

  // Pinata (IPFS pinning for NFT metadata)
  PINATA_JWT?: string;

  // Zora wallet (separate from Farcaster wallet for NFT creation)
  ZORA_WALLET_PRIVATE_KEY?: string;

  // Zora API key (for Coins SDK rate limiting)
  ZORA_API_KEY?: string;

  // Coinbase Developer Platform (on-chain data for Base)
  CDP_KEY_ID?: string;
  CDP_KEY_SECRET?: string;
  CDP_CLIENT_KEY?: string; // Client API Key for JSON-RPC endpoints

  // Lens Protocol v3 (decentralized social)
  LENS_ACCOUNT_ADDRESS?: string; // Lens account address (e.g., 0x3BCE5de801472ED111D4f373A919A787bC35A0dD)
  LENS_WALLET_PRIVATE_KEY?: string; // Wallet that owns the Lens account (can reuse WALLET_PRIVATE_KEY)

  // Bluesky (AT Protocol)
  BLUESKY_HANDLE?: string; // Handle (e.g., fixr-the-buildr.bsky.social)
  BLUESKY_APP_PASSWORD?: string; // App password from Settings > App Passwords
}

// ============ Ship Tracker Types ============

export type ShipCategory =
  | 'miniapp'      // Farcaster frames/mini apps
  | 'token'        // Token launches
  | 'protocol'     // DeFi protocols
  | 'tool'         // Developer tools
  | 'agent'        // AI agents
  | 'social'       // Social apps
  | 'nft'          // NFT projects
  | 'infra'        // Infrastructure
  | 'other';

export type ShipSource =
  | 'clawcrunch'
  | 'clanker_news'
  | 'farcaster'
  | 'github'
  | 'manual';

export interface Ship {
  id: string;
  name: string;
  description: string;
  category: ShipCategory;
  source: ShipSource;
  sourceUrl: string;
  sourceId?: string;           // Original ID from source
  chain?: Chain;
  urls: {
    website?: string;
    github?: string;
    farcaster?: string;
    twitter?: string;
    contract?: string;
  };
  builders: string[];          // Builder IDs associated
  tags: string[];
  metrics?: {
    points?: number;
    comments?: number;
    likes?: number;
  };
  publishedAt: string;
  ingestedAt: string;
  featured?: boolean;
}

export interface Builder {
  id: string;
  name: string;
  type: 'human' | 'agent';
  identities: {
    farcaster?: string;        // @handle
    twitter?: string;
    github?: string;
    wallet?: string;           // ETH address
    agentId?: string;          // e.g., eip155:8453:0x...
  };
  ships: string[];             // Ship IDs built
  score?: number;              // Builder score
  firstSeenAt: string;
  lastActiveAt: string;
}

export interface IngestionRun {
  id: string;
  source: ShipSource;
  startedAt: string;
  completedAt?: string;
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  errors: string[];
  status: 'running' | 'completed' | 'failed';
}

export type InsightType = 'daily_digest' | 'trend' | 'opportunity' | 'builder_spotlight' | 'tech_pattern';

export interface EcosystemInsight {
  id: string;
  type: InsightType;
  title: string;
  summary: string;
  details?: Record<string, unknown>;
  trends?: Array<{
    category: ShipCategory;
    direction: 'up' | 'down' | 'stable';
    count: number;
    examples: string[];
  }>;
  opportunities?: Array<{
    title: string;
    description: string;
    category: ShipCategory;
    rationale: string;
  }>;
  notableBuilders?: Array<{
    id: string;
    name: string;
    shipsCount: number;
    highlight: string;
  }>;
  techPatterns?: Array<{
    pattern: string;
    count: number;
    examples: string[];
  }>;
  shipsAnalyzed: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  expiresAt?: string;
}
