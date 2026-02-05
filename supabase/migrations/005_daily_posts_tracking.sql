-- Track daily posts to prevent duplicates from multiple cron triggers
-- Migration: 005_daily_posts_tracking.sql

CREATE TABLE IF NOT EXISTS daily_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type TEXT NOT NULL,
  cast_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by post_type and date
CREATE INDEX IF NOT EXISTS idx_daily_posts_type_date
  ON daily_posts (post_type, created_at);

-- Clean up old records (keep last 30 days)
-- This can be run periodically via a maintenance job
-- DELETE FROM daily_posts WHERE created_at < NOW() - INTERVAL '30 days';
