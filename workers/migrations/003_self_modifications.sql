-- Self-Modifications — Phase 3 of Fixr Self-Improvement System
-- Tracks proposed and applied code changes from the learning engine
-- Run this against your Supabase database

CREATE TABLE IF NOT EXISTS self_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,             -- 'learning_engine' | 'manual' | 'error_recovery'
  target_file TEXT NOT NULL,        -- e.g., 'workers/src/lib/config.ts'
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'low',      -- 'low' | 'medium' | 'high' | 'critical'
  safety_level TEXT DEFAULT 'safe', -- 'safe' | 'moderate' | 'risky'
  change_type TEXT NOT NULL,        -- 'config' | 'prompt' | 'logic' | 'new_file' | 'lesson'
  proposed_change JSONB NOT NULL,   -- { searchReplace: [{search, replace}] } or { newContent: string } or { lesson: {skillId, text} }
  status TEXT DEFAULT 'pending',    -- 'pending' | 'approved' | 'applied' | 'rejected' | 'rolled_back'
  applied_at TIMESTAMPTZ,
  commit_sha TEXT,
  rollback_sha TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_selfmod_status ON self_modifications(status);
CREATE INDEX IF NOT EXISTS idx_selfmod_created ON self_modifications(created_at);
CREATE INDEX IF NOT EXISTS idx_selfmod_safety ON self_modifications(safety_level);

-- Enable RLS
ALTER TABLE self_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON self_modifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Learning reports table (stores output of each learning cycle)
CREATE TABLE IF NOT EXISTS learning_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcomes_analyzed INTEGER DEFAULT 0,
  new_lessons INTEGER DEFAULT 0,
  modifications_queued INTEGER DEFAULT 0,
  summary TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE learning_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON learning_reports
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
