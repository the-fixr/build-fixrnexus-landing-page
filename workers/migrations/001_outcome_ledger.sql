-- Outcome Ledger — Phase 1 of Fixr Self-Improvement System
-- Records structured outcomes for every agent action
-- Run this against your Supabase database

CREATE TABLE IF NOT EXISTS outcome_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,        -- 'task' | 'post' | 'trade' | 'pr' | 'proposal' | 'deploy' | 'cron'
  action_id TEXT,                   -- FK to source (task.id, cast hash, trade id, etc.)
  skill TEXT NOT NULL,              -- 'x_post' | 'farcaster_post' | 'github_push' | 'trading_decision' | etc.
  success BOOLEAN NOT NULL,
  error_class TEXT,                 -- NULL on success, else: 'network' | 'auth' | 'rate_limit' | 'logic' | 'external_service' | 'timeout' | 'validation'
  error_message TEXT,
  context JSONB DEFAULT '{}',       -- action-specific metadata (chain, platform, token, etc.)
  outcome JSONB DEFAULT '{}',       -- result data (engagement, PnL, deploy URL, etc.)
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_outcome_skill ON outcome_ledger(skill);
CREATE INDEX IF NOT EXISTS idx_outcome_type ON outcome_ledger(action_type);
CREATE INDEX IF NOT EXISTS idx_outcome_created ON outcome_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_outcome_error ON outcome_ledger(error_class) WHERE error_class IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outcome_success ON outcome_ledger(success);

-- Enable RLS (but allow service key full access)
ALTER TABLE outcome_ledger ENABLE ROW LEVEL SECURITY;

-- Policy: service role has full access
CREATE POLICY "Service role full access" ON outcome_ledger
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
