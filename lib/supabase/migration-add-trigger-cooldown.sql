-- Add last_triggered_at column to oracles table
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

COMMENT ON COLUMN oracles.last_triggered_at IS 'Last time validators were manually triggered for this oracle (60min cooldown)';
