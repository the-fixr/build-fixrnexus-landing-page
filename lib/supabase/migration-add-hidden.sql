-- Add is_hidden column to oracles table for soft-hiding oracles in UI
ALTER TABLE oracles ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add index for faster queries filtering hidden oracles
CREATE INDEX IF NOT EXISTS idx_oracles_hidden ON oracles(is_hidden);

-- Add comment
COMMENT ON COLUMN oracles.is_hidden IS 'When true, oracle is hidden from main UI but still accessible via direct link';
