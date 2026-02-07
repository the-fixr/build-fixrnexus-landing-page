-- Migration: Add fields for beta (visibility, description)
-- Run this in Supabase SQL Editor
--
-- BETA MODE: All oracles are free. This migration adds basic fields
-- for marketplace visibility and descriptions. Full monetization
-- tables can be added later when payment features are implemented.

-- =====================================================
-- STEP 1: Add columns to oracles table
-- =====================================================

-- Add public visibility flag (for marketplace listing)
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Add hidden flag for retired/delisted oracles
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Add description field for marketplace
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Add pricing model (for future use - not enforced during beta)
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'free';

-- Add price fields (for future use - not enforced during beta)
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS price_per_call DECIMAL(10, 6) DEFAULT NULL;

ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10, 2) DEFAULT NULL;

-- =====================================================
-- STEP 2: Create Oracle Stats table (for usage tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS oracle_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oracle_id UUID NOT NULL REFERENCES oracles(id) ON DELETE CASCADE UNIQUE,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_api_calls BIGINT DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  calls_last_24h INTEGER DEFAULT 0,
  calls_last_7d INTEGER DEFAULT 0,
  popularity_score DECIMAL(10, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_stats_popularity ON oracle_stats(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_stats_oracle_id ON oracle_stats(oracle_id);

-- =====================================================
-- STEP 3: Helper function for API usage tracking
-- =====================================================

-- Function to increment API usage counter (for analytics)
CREATE OR REPLACE FUNCTION increment_oracle_api_calls(p_oracle_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO oracle_stats (oracle_id, total_api_calls, calls_last_24h, calls_last_7d, updated_at)
  VALUES (p_oracle_id, 1, 1, 1, NOW())
  ON CONFLICT (oracle_id) DO UPDATE SET
    total_api_calls = oracle_stats.total_api_calls + 1,
    calls_last_24h = oracle_stats.calls_last_24h + 1,
    calls_last_7d = oracle_stats.calls_last_7d + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPLETE
-- =====================================================

SELECT 'Beta migration complete! All oracles are free during beta.' as status;

-- =====================================================
-- FUTURE: When monetization is implemented, add these tables:
--
-- - api_keys (for authenticated API access)
-- - oracle_subscriptions (for paid oracle access)
-- - api_usage (for detailed usage logging)
-- - creator_earnings (for revenue tracking)
-- - platform_subscriptions (for platform tier access)
--
-- See MONETIZATION_FUTURE.md for full schema when ready.
-- =====================================================
