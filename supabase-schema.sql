-- Fixr Agent Supabase Schema
-- Run this in your Supabase SQL Editor

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  chain TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  plan JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval requests table
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ
);

-- Completed projects table
CREATE TABLE IF NOT EXISTS completed_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  chain TEXT,
  urls JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_projects ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for server-side operations)
CREATE POLICY "Service role has full access to tasks" ON tasks
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to approval_requests" ON approval_requests
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to completed_projects" ON completed_projects
  FOR ALL USING (true);

-- Farcaster replies table (for webhook events)
CREATE TABLE IF NOT EXISTS farcaster_replies (
  id TEXT PRIMARY KEY,  -- cast hash
  parent_hash TEXT NOT NULL,
  thread_hash TEXT NOT NULL,
  author_fid INTEGER NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  text TEXT NOT NULL,
  parsed_type TEXT,  -- wallet_provided, confirmation, question, unknown
  parsed_data JSONB,
  author_eth_addresses TEXT[],
  author_sol_addresses TEXT[],
  task_id TEXT REFERENCES tasks(id),  -- linked task if found
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_parent ON farcaster_replies(parent_hash);
CREATE INDEX IF NOT EXISTS idx_replies_processed ON farcaster_replies(processed);
CREATE INDEX IF NOT EXISTS idx_replies_task ON farcaster_replies(task_id);

ALTER TABLE farcaster_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to farcaster_replies" ON farcaster_replies
  FOR ALL USING (true);

-- Conversations table (for conversational bot)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  fid INTEGER NOT NULL,  -- Farcaster user ID
  username TEXT NOT NULL,
  thread_hash TEXT NOT NULL UNIQUE,  -- Thread identifier
  context JSONB DEFAULT '{}',  -- Repo URL, analysis, intent, etc.
  messages JSONB DEFAULT '[]',  -- Conversation history
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_fid ON conversations(fid);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(thread_hash);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to conversations" ON conversations
  FOR ALL USING (true);

-- ============================================================================
-- Builder Feed Tables (for tracking builder activity from Farcaster channels)
-- ============================================================================

-- Builder casts - individual posts from builder channels
CREATE TABLE IF NOT EXISTS builder_casts (
  hash TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  author_fid INTEGER NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  author_follower_count INTEGER DEFAULT 0,
  author_pfp_url TEXT,
  channel TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  likes INTEGER DEFAULT 0,
  recasts INTEGER DEFAULT 0,
  embeds TEXT[] DEFAULT '{}',
  parent_hash TEXT,
  category TEXT NOT NULL,  -- shipped, insight, discussion
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_casts_timestamp ON builder_casts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_builder_casts_channel ON builder_casts(channel);
CREATE INDEX IF NOT EXISTS idx_builder_casts_category ON builder_casts(category);
CREATE INDEX IF NOT EXISTS idx_builder_casts_author ON builder_casts(author_fid);
CREATE INDEX IF NOT EXISTS idx_builder_casts_topics ON builder_casts USING GIN(topics);

ALTER TABLE builder_casts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to builder_casts" ON builder_casts
  FOR ALL USING (true);

-- Builder digests - daily summaries
CREATE TABLE IF NOT EXISTS builder_digests (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  shipped_count INTEGER DEFAULT 0,
  insights_count INTEGER DEFAULT 0,
  discussions_count INTEGER DEFAULT 0,
  top_shipped_hashes TEXT[] DEFAULT '{}',
  top_insight_hashes TEXT[] DEFAULT '{}',
  top_discussion_hashes TEXT[] DEFAULT '{}',
  active_builders JSONB DEFAULT '[]',
  trending_topics JSONB DEFAULT '[]',
  summary TEXT,
  post_hash TEXT,  -- Farcaster post hash if posted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_digests_date ON builder_digests(date DESC);

ALTER TABLE builder_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to builder_digests" ON builder_digests
  FOR ALL USING (true);

-- Builder profiles - accumulated stats for each builder
CREATE TABLE IF NOT EXISTS builder_profiles (
  fid INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  pfp_url TEXT,
  follower_count INTEGER DEFAULT 0,
  total_casts INTEGER DEFAULT 0,
  shipped_count INTEGER DEFAULT 0,
  insight_count INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  top_topics TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_profiles_username ON builder_profiles(username);
CREATE INDEX IF NOT EXISTS idx_builder_profiles_engagement ON builder_profiles(total_engagement DESC);
CREATE INDEX IF NOT EXISTS idx_builder_profiles_shipped ON builder_profiles(shipped_count DESC);
CREATE INDEX IF NOT EXISTS idx_builder_profiles_topics ON builder_profiles USING GIN(top_topics);

ALTER TABLE builder_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to builder_profiles" ON builder_profiles
  FOR ALL USING (true);

-- ============================================================================
-- Cast Analytics Tables (for tracking Fixr's own post performance)
-- ============================================================================

-- Fixr's cast analytics - track engagement on our posts
CREATE TABLE IF NOT EXISTS fixr_cast_analytics (
  hash TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  cast_type TEXT NOT NULL,  -- digest, analysis, reply, daily_report, follow_notification, incident, other
  posted_at TIMESTAMPTZ NOT NULL,
  likes INTEGER DEFAULT 0,
  recasts INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  parent_hash TEXT,
  channel_id TEXT,
  metadata JSONB DEFAULT '{}',  -- token_address, token_symbol, builder_fid, etc.
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixr_casts_posted ON fixr_cast_analytics(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_fixr_casts_type ON fixr_cast_analytics(cast_type);
CREATE INDEX IF NOT EXISTS idx_fixr_casts_engagement ON fixr_cast_analytics((likes + recasts + replies) DESC);

ALTER TABLE fixr_cast_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to fixr_cast_analytics" ON fixr_cast_analytics
  FOR ALL USING (true);

-- ============================================================================
-- Token Tracking & Rug Detection Tables
-- ============================================================================

-- Tracked tokens - tokens Fixr has analyzed
CREATE TABLE IF NOT EXISTS tracked_tokens (
  address TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  network TEXT NOT NULL,
  -- Original analysis data
  original_score INTEGER NOT NULL,
  original_price NUMERIC NOT NULL,
  original_liquidity NUMERIC NOT NULL,
  original_analyzed_at TIMESTAMPTZ NOT NULL,
  -- Current state
  current_price NUMERIC,
  current_liquidity NUMERIC,
  price_change_24h NUMERIC,
  last_checked_at TIMESTAMPTZ,
  -- Status
  status TEXT NOT NULL DEFAULT 'active',  -- active, suspicious, rugged, delisted
  rug_indicators TEXT[] DEFAULT '{}',
  incident_posted_at TIMESTAMPTZ,
  incident_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_tokens_status ON tracked_tokens(status);
CREATE INDEX IF NOT EXISTS idx_tracked_tokens_score ON tracked_tokens(original_score);
CREATE INDEX IF NOT EXISTS idx_tracked_tokens_network ON tracked_tokens(network);
CREATE INDEX IF NOT EXISTS idx_tracked_tokens_checked ON tracked_tokens(last_checked_at);

ALTER TABLE tracked_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to tracked_tokens" ON tracked_tokens
  FOR ALL USING (true);

-- Rug incidents - confirmed rugs that Fixr detected
CREATE TABLE IF NOT EXISTS rug_incidents (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_name TEXT NOT NULL,
  network TEXT NOT NULL,
  -- What happened
  rug_type TEXT NOT NULL,  -- price_crash, liquidity_pull, honeypot_flip, owner_dump, trading_disabled
  severity TEXT NOT NULL,  -- warning, confirmed, critical
  -- Evidence
  original_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL,
  price_drop_percent NUMERIC NOT NULL,
  original_liquidity NUMERIC NOT NULL,
  current_liquidity NUMERIC NOT NULL,
  liquidity_drop_percent NUMERIC NOT NULL,
  indicators TEXT[] DEFAULT '{}',
  -- Our original call
  original_score INTEGER NOT NULL,
  original_analyzed_at TIMESTAMPTZ NOT NULL,
  we_predicted_it BOOLEAN DEFAULT FALSE,
  -- Timestamps
  detected_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  post_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rug_incidents_detected ON rug_incidents(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rug_incidents_severity ON rug_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_rug_incidents_predicted ON rug_incidents(we_predicted_it);

ALTER TABLE rug_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to rug_incidents" ON rug_incidents
  FOR ALL USING (true);

-- ============================================================================
-- X (Twitter) Posts Tracking (for cost management at $0.02/post)
-- ============================================================================

-- X posts - track all posts to X for cost management
CREATE TABLE IF NOT EXISTS x_posts (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  post_type TEXT NOT NULL,  -- digest, rug_alert, manual, announcement
  tweet_id TEXT,
  tweet_url TEXT,
  cost NUMERIC DEFAULT 0.02,
  posted_at TIMESTAMPTZ NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_x_posts_posted ON x_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_x_posts_type ON x_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_x_posts_success ON x_posts(success);
CREATE INDEX IF NOT EXISTS idx_x_posts_date ON x_posts(DATE(posted_at));

ALTER TABLE x_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to x_posts" ON x_posts
  FOR ALL USING (true);

-- ============================================================================
-- Builder ID NFT Records
-- ============================================================================

-- Builder IDs - soulbound NFTs for Farcaster builders
CREATE TABLE IF NOT EXISTS builder_ids (
  id SERIAL PRIMARY KEY,
  fid INTEGER NOT NULL UNIQUE,
  username TEXT NOT NULL,
  token_id INTEGER,
  image_url TEXT NOT NULL,
  metadata_url TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  -- Scores at time of mint
  builder_score INTEGER,
  neynar_score NUMERIC,
  talent_score INTEGER,
  shipped_count INTEGER DEFAULT 0,
  power_badge BOOLEAN DEFAULT FALSE,
  -- Timestamps
  minted_at TIMESTAMPTZ,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_ids_fid ON builder_ids(fid);
CREATE INDEX IF NOT EXISTS idx_builder_ids_username ON builder_ids(username);
CREATE INDEX IF NOT EXISTS idx_builder_ids_wallet ON builder_ids(wallet_address);
CREATE INDEX IF NOT EXISTS idx_builder_ids_minted ON builder_ids(minted_at DESC);
CREATE INDEX IF NOT EXISTS idx_builder_ids_token ON builder_ids(token_id);

ALTER TABLE builder_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to builder_ids" ON builder_ids
  FOR ALL USING (true);
