-- Migration: Add API call tracking table
-- This table will track every API call made to oracle endpoints

CREATE TABLE IF NOT EXISTS api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oracle_id UUID NOT NULL REFERENCES oracles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_api_calls_oracle_id ON api_calls(oracle_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_user_id ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_created_at ON api_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_calls_oracle_created ON api_calls(oracle_id, created_at DESC);

-- Add call count cache to oracles table for performance
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS total_api_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_this_week INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ;

-- Function to increment oracle call counters
CREATE OR REPLACE FUNCTION increment_oracle_call_count()
RETURNS TRIGGER AS $$
DECLARE
  last_call_date DATE;
BEGIN
  -- Get the last call date for this oracle
  SELECT DATE(last_call_at) INTO last_call_date
  FROM oracles
  WHERE id = NEW.oracle_id;

  -- Update the oracle's call counters
  UPDATE oracles
  SET
    total_api_calls = total_api_calls + 1,
    -- Reset daily counter if it's a new day, otherwise increment
    calls_today = CASE
      WHEN last_call_date IS NULL OR last_call_date < CURRENT_DATE THEN 1
      ELSE calls_today + 1
    END,
    -- Reset weekly counter if it's a new week, otherwise increment
    calls_this_week = CASE
      WHEN last_call_date IS NULL OR DATE_TRUNC('week', last_call_date) < DATE_TRUNC('week', CURRENT_DATE) THEN 1
      ELSE calls_this_week + 1
    END,
    -- Reset monthly counter if it's a new month, otherwise increment
    calls_this_month = CASE
      WHEN last_call_date IS NULL OR DATE_TRUNC('month', last_call_date) < DATE_TRUNC('month', CURRENT_DATE) THEN 1
      ELSE calls_this_month + 1
    END,
    last_call_at = NEW.created_at
  WHERE id = NEW.oracle_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment counters on new API call
DROP TRIGGER IF EXISTS trigger_increment_oracle_calls ON api_calls;
CREATE TRIGGER trigger_increment_oracle_calls
  AFTER INSERT ON api_calls
  FOR EACH ROW
  EXECUTE FUNCTION increment_oracle_call_count();

-- Function to reset daily/weekly/monthly counters (run via cron)
CREATE OR REPLACE FUNCTION reset_oracle_call_periods()
RETURNS void AS $$
BEGIN
  -- Reset daily counters at midnight
  UPDATE oracles
  SET calls_today = 0
  WHERE last_call_at < CURRENT_DATE;

  -- Reset weekly counters on Mondays
  UPDATE oracles
  SET calls_this_week = 0
  WHERE last_call_at < date_trunc('week', CURRENT_DATE);

  -- Reset monthly counters on 1st of month
  UPDATE oracles
  SET calls_this_month = 0
  WHERE last_call_at < date_trunc('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for api_calls table
ALTER TABLE api_calls ENABLE ROW LEVEL SECURITY;

-- Users can view their own oracle's API calls
CREATE POLICY "Users can view their oracle API calls"
  ON api_calls FOR SELECT
  USING (
    oracle_id IN (
      SELECT id FROM oracles WHERE user_id = auth.uid()
    )
  );

-- Service role can insert API calls
CREATE POLICY "Service role can insert API calls"
  ON api_calls FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE api_calls IS 'Tracks every API call made to oracle endpoints for analytics and billing';
COMMENT ON COLUMN api_calls.response_time_ms IS 'Time taken to process the request in milliseconds';
COMMENT ON COLUMN oracles.total_api_calls IS 'Total number of API calls since oracle deployment';
COMMENT ON COLUMN oracles.calls_today IS 'Number of calls today (resets at midnight UTC)';
COMMENT ON COLUMN oracles.calls_this_week IS 'Number of calls this week (resets Monday)';
COMMENT ON COLUMN oracles.calls_this_month IS 'Number of calls this month (resets 1st)';
