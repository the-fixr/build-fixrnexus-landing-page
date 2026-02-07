-- Add target_token column to oracles table for Farcaster oracles
ALTER TABLE oracles ADD COLUMN IF NOT EXISTS target_token TEXT;

-- Add comment
COMMENT ON COLUMN oracles.target_token IS 'For Farcaster oracles: the token symbol being tracked (e.g., DEGEN, BRETT)';
