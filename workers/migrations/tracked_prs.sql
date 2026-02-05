-- Tracked PRs Table for Fixr PR Monitoring
-- Run this in Supabase SQL Editor

-- Tracked PRs table - stores PRs that Fixr has submitted and is monitoring
CREATE TABLE IF NOT EXISTS tracked_prs (
  id TEXT PRIMARY KEY,  -- format: "owner/repo#number"
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  branch TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'merged')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  last_comment_id INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracked_prs_status ON tracked_prs(status);
CREATE INDEX IF NOT EXISTS idx_tracked_prs_owner_repo ON tracked_prs(owner, repo);
CREATE INDEX IF NOT EXISTS idx_tracked_prs_created_at ON tracked_prs(created_at DESC);

-- Update timestamp trigger
DROP TRIGGER IF EXISTS tracked_prs_updated_at ON tracked_prs;
CREATE TRIGGER tracked_prs_updated_at
  BEFORE UPDATE ON tracked_prs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE tracked_prs ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
DROP POLICY IF EXISTS "Service role full access on tracked_prs" ON tracked_prs;
CREATE POLICY "Service role full access on tracked_prs" ON tracked_prs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Public read access for tracked PRs (for the API)
DROP POLICY IF EXISTS "Public read access on tracked_prs" ON tracked_prs;
CREATE POLICY "Public read access on tracked_prs" ON tracked_prs
  FOR SELECT
  USING (true);
