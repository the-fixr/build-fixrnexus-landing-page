-- Migration: API Keys and Usage Tracking for Paid Access
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: API Keys table
-- =====================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'Default',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  -- Signature verification
  signature TEXT NOT NULL,
  message TEXT NOT NULL,

  UNIQUE(user_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_wallet ON api_keys(wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- =====================================================
-- STEP 2: API Usage table (per-call tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  oracle_address TEXT,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_wallet ON api_usage(wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key_id);

-- =====================================================
-- STEP 3: Daily usage aggregation (for billing)
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  date DATE NOT NULL,
  call_count INTEGER DEFAULT 0,
  total_cost_wei BIGINT DEFAULT 0,
  deducted BOOLEAN DEFAULT false,
  deducted_at TIMESTAMPTZ,
  tx_hash TEXT,

  UNIQUE(wallet_address, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_wallet_date ON daily_usage(wallet_address, date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_pending ON daily_usage(deducted) WHERE deducted = false;

-- =====================================================
-- STEP 4: Pricing config
-- =====================================================

CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_per_call_wei BIGINT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing: $0.001 per call at ~$3000 ETH = 333333333333333 wei (~0.00000033 ETH)
-- Simplified: 1000000000000 wei = 0.000001 ETH = $0.003 at $3k ETH
-- Let's use 300000000000000 wei = 0.0003 ETH = ~$0.001 at $3k ETH
INSERT INTO pricing_config (name, price_per_call_wei, description)
VALUES ('default', 300000000000000, '$0.001 per API call (at ~$3k ETH)')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 5: Helper function to generate API key
-- =====================================================

CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
  key TEXT;
BEGIN
  key := 'feeds_' || encode(gen_random_bytes(24), 'hex');
  RETURN key;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 6: Function to record API usage
-- =====================================================

CREATE OR REPLACE FUNCTION record_api_usage(
  p_api_key TEXT,
  p_endpoint TEXT,
  p_oracle_address TEXT,
  p_status_code INTEGER,
  p_response_time_ms INTEGER
) RETURNS void AS $$
DECLARE
  v_key_record RECORD;
  v_today DATE := CURRENT_DATE;
  v_price_wei BIGINT;
BEGIN
  -- Get API key info
  SELECT * INTO v_key_record FROM api_keys WHERE api_key = p_api_key AND is_active = true;

  IF v_key_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive API key';
  END IF;

  -- Get current pricing
  SELECT price_per_call_wei INTO v_price_wei FROM pricing_config WHERE name = 'default' AND is_active = true;

  -- Record individual usage
  INSERT INTO api_usage (api_key_id, wallet_address, endpoint, oracle_address, status_code, response_time_ms)
  VALUES (v_key_record.id, v_key_record.wallet_address, p_endpoint, p_oracle_address, p_status_code, p_response_time_ms);

  -- Update daily aggregation
  INSERT INTO daily_usage (wallet_address, date, call_count, total_cost_wei)
  VALUES (v_key_record.wallet_address, v_today, 1, v_price_wei)
  ON CONFLICT (wallet_address, date) DO UPDATE SET
    call_count = daily_usage.call_count + 1,
    total_cost_wei = daily_usage.total_cost_wei + v_price_wei;

  -- Update last used timestamp
  UPDATE api_keys SET last_used_at = NOW() WHERE id = v_key_record.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPLETE
-- =====================================================

SELECT 'API keys and usage tracking migration complete!' as status;
