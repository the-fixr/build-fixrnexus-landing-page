-- Migration: Add Oracles Tables
-- Run this in Supabase SQL Editor

-- Oracles table
CREATE TABLE IF NOT EXISTS oracles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT,
  oracle_type TEXT NOT NULL, -- 'price', 'weather', 'custom'

  -- Deployment info
  contract_address TEXT UNIQUE,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  deployment_tx_hash TEXT,
  deployed_at TIMESTAMP WITH TIME ZONE,

  -- Configuration
  config JSONB NOT NULL, -- stores full oracle configuration
  update_frequency INTEGER NOT NULL, -- in seconds
  consensus_threshold INTEGER NOT NULL, -- percentage 51-100

  -- Data source
  data_source_primary TEXT NOT NULL,
  data_source_backup TEXT,
  api_endpoint TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'deploying', 'active', 'paused', 'error'
  is_active BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- Metrics
  total_updates INTEGER DEFAULT 0,
  last_update_at TIMESTAMP WITH TIME ZONE,
  last_price NUMERIC,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE oracles ENABLE ROW LEVEL SECURITY;

-- Policies for oracles
CREATE POLICY "Users can view their own oracles"
  ON oracles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own oracles"
  ON oracles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own oracles"
  ON oracles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oracles"
  ON oracles FOR DELETE
  USING (auth.uid() = user_id);

-- Oracle updates table (stores historical data)
CREATE TABLE IF NOT EXISTS oracle_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oracle_id UUID REFERENCES oracles(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC NOT NULL,
  decimals INTEGER NOT NULL,
  validator_address TEXT NOT NULL,
  block_number BIGINT,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE oracle_updates ENABLE ROW LEVEL SECURITY;

-- Policies for oracle_updates
CREATE POLICY "Users can view updates for their oracles"
  ON oracle_updates FOR SELECT
  USING (
    oracle_id IN (
      SELECT id FROM oracles WHERE user_id = auth.uid()
    )
  );

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_oracles_user_id ON oracles(user_id);
CREATE INDEX IF NOT EXISTS idx_oracles_contract_address ON oracles(contract_address);
CREATE INDEX IF NOT EXISTS idx_oracles_status ON oracles(status);
CREATE INDEX IF NOT EXISTS idx_oracle_updates_oracle_id ON oracle_updates(oracle_id);
CREATE INDEX IF NOT EXISTS idx_oracle_updates_created_at ON oracle_updates(created_at DESC);
