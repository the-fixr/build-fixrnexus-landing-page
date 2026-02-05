-- Agent Configuration Table
-- Stores runtime configuration that affects Fixr's behavior
-- Changes here control cron jobs, posting, and other automated behavior

CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Create index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_agent_config_key ON agent_config(key);
CREATE INDEX IF NOT EXISTS idx_agent_config_category ON agent_config(category);

-- Insert default configuration values
INSERT INTO agent_config (key, value, description, category) VALUES
  -- Posting Behavior
  ('auto_gm', 'true', 'Enable automatic GM posts', 'posting'),
  ('auto_gn', 'true', 'Enable automatic GN posts', 'posting'),
  ('auto_respond', 'true', 'Enable automatic responses to mentions', 'posting'),
  ('gm_hour', '12', 'Hour (UTC) to post GM (0-23)', 'posting'),
  ('gn_hour', '4', 'Hour (UTC) to post GN (0-23)', 'posting'),
  ('max_daily_posts', '10', 'Maximum posts per day across all platforms', 'posting'),

  -- Content Generation
  ('weekly_recap_enabled', 'true', 'Enable weekly recap video generation', 'content'),
  ('default_video_duration', '5', 'Default video duration in seconds (5 or 10)', 'content'),
  ('video_negative_prompt', '"blurry, low quality, distorted, ugly, bad anatomy"', 'Negative prompt for video generation', 'content'),

  -- Notifications
  ('email_notifications', 'true', 'Enable email notifications', 'notifications'),
  ('task_approval_emails', 'true', 'Send emails for task approvals', 'notifications'),

  -- Chain Configuration
  ('default_chain', '"base"', 'Default blockchain for operations', 'chains'),
  ('base_enabled', 'true', 'Enable Base chain operations', 'chains'),
  ('ethereum_enabled', 'false', 'Enable Ethereum mainnet operations', 'chains'),
  ('solana_enabled', 'false', 'Enable Solana operations', 'chains'),
  ('monad_enabled', 'false', 'Enable Monad operations', 'chains'),

  -- Security
  ('require_approval', 'true', 'Require approval for all tasks', 'security'),
  ('auto_execute', 'false', 'Auto-execute low-risk tasks without approval', 'security'),

  -- Cron Jobs
  ('daily_digest_enabled', 'true', 'Enable daily builder digest', 'crons'),
  ('rug_scan_enabled', 'true', 'Enable rug detection scanning', 'crons'),
  ('engagement_check_enabled', 'true', 'Enable engagement monitoring', 'crons'),
  ('zora_coin_enabled', 'true', 'Enable automatic Zora Coin creation', 'crons'),
  ('ship_tracker_enabled', 'true', 'Enable ship tracker ingestion', 'crons'),
  ('brainstorm_enabled', 'true', 'Enable daily brainstorm sessions', 'crons'),
  ('trading_enabled', 'false', 'Enable automated trading', 'crons'),
  ('lens_crosspost_enabled', 'true', 'Enable automatic Lens crossposting', 'crons')
ON CONFLICT (key) DO NOTHING;

-- Function to update timestamp on config changes
CREATE OR REPLACE FUNCTION update_agent_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS agent_config_updated_at ON agent_config;
CREATE TRIGGER agent_config_updated_at
  BEFORE UPDATE ON agent_config
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_config_timestamp();

-- Grant access (adjust based on your Supabase setup)
-- GRANT ALL ON agent_config TO authenticated;
-- GRANT ALL ON agent_config TO service_role;
