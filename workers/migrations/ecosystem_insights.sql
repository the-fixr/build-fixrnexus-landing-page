-- Ecosystem Insights Table for Fixr
-- Stores AI-generated analysis from ship tracker data
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ecosystem_insights (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('daily_digest', 'trend', 'opportunity', 'builder_spotlight', 'tech_pattern')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  -- Structured insights
  trends JSONB DEFAULT '[]',           -- Array of { category, direction, count, examples }
  opportunities JSONB DEFAULT '[]',    -- Array of { title, description, category, rationale }
  notable_builders JSONB DEFAULT '[]', -- Array of { id, name, ships_count, highlight }
  tech_patterns JSONB DEFAULT '[]',    -- Array of { pattern, count, examples }
  -- Metadata
  ships_analyzed INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- Insights can expire to keep context fresh
);

-- Index for quick lookups by type and recency
CREATE INDEX IF NOT EXISTS idx_insights_type ON ecosystem_insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_created ON ecosystem_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_expires ON ecosystem_insights(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE ecosystem_insights ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on ecosystem_insights" ON ecosystem_insights;
CREATE POLICY "Service role full access on ecosystem_insights" ON ecosystem_insights
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Public read access (for API)
DROP POLICY IF EXISTS "Public read access on ecosystem_insights" ON ecosystem_insights;
CREATE POLICY "Public read access on ecosystem_insights" ON ecosystem_insights
  FOR SELECT
  USING (true);
