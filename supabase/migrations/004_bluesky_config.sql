-- Add Bluesky crosspost configuration
-- Migration: 004_bluesky_config.sql

INSERT INTO agent_config (key, value, category, description)
VALUES (
  'bluesky_crosspost_enabled',
  'true',
  'cron',
  'Enable automatic crossposting to Bluesky when posting to Farcaster'
)
ON CONFLICT (key) DO NOTHING;
