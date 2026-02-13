-- Skill Registry — Phase 2 of Fixr Self-Improvement System
-- Formal registry of all agent capabilities with performance tracking
-- Run this against your Supabase database

CREATE TABLE IF NOT EXISTS skill_registry (
  id TEXT PRIMARY KEY,              -- 'solana_program', 'farcaster_post', 'token_analysis', etc.
  category TEXT NOT NULL,           -- 'code', 'social', 'analysis', 'trading', 'infra', 'media'
  display_name TEXT NOT NULL,
  description TEXT,
  total_uses INTEGER DEFAULT 0,
  successes INTEGER DEFAULT 0,
  failures INTEGER DEFAULT 0,
  avg_duration_ms INTEGER DEFAULT 0,
  common_errors JSONB DEFAULT '[]', -- [{errorClass, count, lastSeen}]
  lessons JSONB DEFAULT '[]',       -- [{lesson, source, learnedAt}]
  confidence REAL DEFAULT 0.5,      -- 0.0–1.0, Bayesian-updated
  last_used TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE skill_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON skill_registry
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed initial skills
INSERT INTO skill_registry (id, category, display_name, description) VALUES
  ('task_execution',       'infra',    'Task Execution',       'End-to-end autonomous task execution'),
  ('code_generation',      'code',     'Code Generation',      'AI-powered code generation for tasks'),
  ('github_push',          'infra',    'GitHub Push',          'Pushing code to GitHub repositories'),
  ('vercel_deploy',        'infra',    'Vercel Deploy',        'Deploying projects to Vercel'),
  ('contract_deploy',      'code',     'Contract Deploy',      'Smart contract deployment'),
  ('social_post',          'social',   'Social Post',          'Multi-platform social posting from tasks'),
  ('x_post',               'social',   'X Post',               'Posting to X/Twitter'),
  ('farcaster_post',       'social',   'Farcaster Post',       'Posting to Farcaster via Neynar'),
  ('lens_post',            'social',   'Lens Post',            'Crossposting to Lens Protocol'),
  ('bluesky_post',         'social',   'Bluesky Post',         'Crossposting to Bluesky'),
  ('moltbook_post',        'social',   'Moltbook Post',        'Posting to Moltbook AI social'),
  ('trading_decision',     'trading',  'Trading Decision',     'Bankr-informed trading decisions'),
  ('token_analysis',       'analysis', 'Token Analysis',       'Token security and liquidity analysis'),
  ('contract_audit',       'analysis', 'Contract Audit',       'Smart contract security audits'),
  ('wallet_intel',         'analysis', 'Wallet Intel',         'Wallet risk analysis via Webacy'),
  ('image_generation',     'media',    'Image Generation',     'Gemini-powered image generation'),
  ('video_generation',     'media',    'Video Generation',     'WaveSpeed video generation'),
  ('plan_generation',      'code',     'Plan Generation',      'AI-powered task planning'),
  ('builder_digest',       'social',   'Builder Digest',       'Daily builder feed digest'),
  ('ship_tracker',         'analysis', 'Ship Tracker',         'Ecosystem ship ingestion and analysis'),
  ('open_source_contribution', 'code', 'Open Source PR',       'Contributing PRs to external repos')
ON CONFLICT (id) DO NOTHING;
