-- API Call Tracking Table
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS api_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  wallet TEXT,
  ip TEXT,
  tier TEXT NOT NULL DEFAULT 'FREE',
  paid_tx TEXT,
  response_status INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_calls_wallet ON api_calls(wallet) WHERE wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_calls_tier ON api_calls(tier);
CREATE INDEX IF NOT EXISTS idx_api_calls_endpoint ON api_calls(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_calls_paid ON api_calls(paid_tx) WHERE paid_tx IS NOT NULL;

-- Composite index for time-range queries with tier
CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp_tier ON api_calls(timestamp DESC, tier);

-- Function to clean old records (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_api_calls(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_calls
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for daily stats
CREATE OR REPLACE VIEW api_calls_daily_stats AS
SELECT
  day,
  total_calls,
  unique_wallets,
  unique_ips,
  paid_calls,
  paid_calls * 0.01 as revenue_usdc,
  avg_response_ms,
  (
    SELECT jsonb_object_agg(tier, cnt)
    FROM (
      SELECT tier, COUNT(*) as cnt
      FROM api_calls a2
      WHERE DATE_TRUNC('day', a2.timestamp) = daily.day
      GROUP BY tier
    ) tier_counts
  ) as calls_by_tier
FROM (
  SELECT
    DATE_TRUNC('day', timestamp) as day,
    COUNT(*) as total_calls,
    COUNT(DISTINCT wallet) as unique_wallets,
    COUNT(DISTINCT ip) as unique_ips,
    COUNT(paid_tx) as paid_calls,
    AVG(response_time_ms)::INTEGER as avg_response_ms
  FROM api_calls
  GROUP BY DATE_TRUNC('day', timestamp)
) daily
ORDER BY day DESC;

-- View for hourly stats (last 48 hours)
CREATE OR REPLACE VIEW api_calls_hourly_stats AS
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as calls,
  COUNT(paid_tx) as paid_calls,
  COUNT(DISTINCT wallet) as unique_wallets
FROM api_calls
WHERE timestamp > NOW() - INTERVAL '48 hours'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT ON api_calls TO authenticated;
-- GRANT SELECT ON api_calls_daily_stats TO authenticated;
-- GRANT SELECT ON api_calls_hourly_stats TO authenticated;

COMMENT ON TABLE api_calls IS 'API usage tracking for FIXR staking tiers and x402 payments';
COMMENT ON COLUMN api_calls.tier IS 'Staking tier: FREE, BUILDER, PRO, ELITE';
COMMENT ON COLUMN api_calls.paid_tx IS 'x402 payment transaction hash if paid per call';
