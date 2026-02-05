-- Zora Posts Table for Fixr Art
-- Run this in Supabase SQL Editor

-- Zora posts table - tracks all NFTs Fixr has created on Zora
CREATE TABLE IF NOT EXISTS zora_posts (
  id TEXT PRIMARY KEY,  -- format: "contractAddress-tokenId"
  contract_address TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  ipfs_image_url TEXT,
  ipfs_metadata_url TEXT,
  zora_url TEXT,  -- Link to the NFT on zora.co
  mints INTEGER DEFAULT 0,  -- Track how many times it's been minted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_zora_posts_created_at ON zora_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zora_posts_contract ON zora_posts(contract_address);

-- Update timestamp trigger
DROP TRIGGER IF EXISTS zora_posts_updated_at ON zora_posts;
CREATE TRIGGER zora_posts_updated_at
  BEFORE UPDATE ON zora_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE zora_posts ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
DROP POLICY IF EXISTS "Service role full access on zora_posts" ON zora_posts;
CREATE POLICY "Service role full access on zora_posts" ON zora_posts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Public read access for zora posts (for the API)
DROP POLICY IF EXISTS "Public read access on zora_posts" ON zora_posts;
CREATE POLICY "Public read access on zora_posts" ON zora_posts
  FOR SELECT
  USING (true);
