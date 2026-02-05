-- Ship Tracker Tables for Fixr
-- Run this in Supabase SQL Editor

-- Ships table - tracks all discovered ships/projects
CREATE TABLE IF NOT EXISTS ships (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('miniapp', 'token', 'protocol', 'tool', 'agent', 'social', 'nft', 'infra', 'other')),
  source TEXT NOT NULL CHECK (source IN ('clawcrunch', 'clanker_news', 'farcaster', 'github', 'manual')),
  source_url TEXT,
  source_id TEXT,
  chain TEXT CHECK (chain IN ('ethereum', 'base', 'monad', 'solana') OR chain IS NULL),
  urls JSONB DEFAULT '{}',
  builders TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Builders table - tracks builders/agents who create ships
CREATE TABLE IF NOT EXISTS builders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('human', 'agent')),
  identities JSONB DEFAULT '{}',
  ships TEXT[] DEFAULT '{}',
  score INTEGER,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion runs table - logs each ingestion attempt
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ships_category ON ships(category);
CREATE INDEX IF NOT EXISTS idx_ships_source ON ships(source);
CREATE INDEX IF NOT EXISTS idx_ships_published_at ON ships(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ships_featured ON ships(featured) WHERE featured = TRUE;

CREATE INDEX IF NOT EXISTS idx_builders_type ON builders(type);
CREATE INDEX IF NOT EXISTS idx_builders_last_active ON builders(last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON ingestion_runs(source);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started_at ON ingestion_runs(started_at DESC);

-- Full text search on ships
CREATE INDEX IF NOT EXISTS idx_ships_search ON ships USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ships_updated_at ON ships;
CREATE TRIGGER ships_updated_at
  BEFORE UPDATE ON ships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS builders_updated_at ON builders;
CREATE TRIGGER builders_updated_at
  BEFORE UPDATE ON builders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE builders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
DROP POLICY IF EXISTS "Service role full access on ships" ON ships;
CREATE POLICY "Service role full access on ships" ON ships
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on builders" ON builders;
CREATE POLICY "Service role full access on builders" ON builders
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on ingestion_runs" ON ingestion_runs;
CREATE POLICY "Service role full access on ingestion_runs" ON ingestion_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Public read access for ships and builders (for the API)
DROP POLICY IF EXISTS "Public read access on ships" ON ships;
CREATE POLICY "Public read access on ships" ON ships
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read access on builders" ON builders;
CREATE POLICY "Public read access on builders" ON builders
  FOR SELECT
  USING (true);
