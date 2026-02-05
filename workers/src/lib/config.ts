/**
 * Agent Configuration System
 * Loads and manages runtime configuration from Supabase
 * Used by cron jobs and other automated behavior to respect admin settings
 */

import { Env } from './types';

export interface AgentConfig {
  // Posting Behavior
  auto_gm: boolean;
  auto_gn: boolean;
  auto_respond: boolean;
  gm_hour: number;
  gn_hour: number;
  max_daily_posts: number;

  // Content Generation
  weekly_recap_enabled: boolean;
  default_video_duration: number;
  video_negative_prompt: string;

  // Notifications
  email_notifications: boolean;
  task_approval_emails: boolean;

  // Chain Configuration
  default_chain: 'base' | 'ethereum' | 'solana' | 'monad';
  base_enabled: boolean;
  ethereum_enabled: boolean;
  solana_enabled: boolean;
  monad_enabled: boolean;

  // Security
  require_approval: boolean;
  auto_execute: boolean;

  // Cron Jobs
  daily_digest_enabled: boolean;
  rug_scan_enabled: boolean;
  engagement_check_enabled: boolean;
  zora_coin_enabled: boolean;
  ship_tracker_enabled: boolean;
  brainstorm_enabled: boolean;
  trading_enabled: boolean;
  lens_crosspost_enabled: boolean;
  bluesky_crosspost_enabled: boolean;
}

// Default configuration (used if database is unavailable)
const DEFAULT_CONFIG: AgentConfig = {
  auto_gm: true,
  auto_gn: true,
  auto_respond: true,
  gm_hour: 12,
  gn_hour: 4,
  max_daily_posts: 10,
  weekly_recap_enabled: true,
  default_video_duration: 5,
  video_negative_prompt: 'blurry, low quality, distorted, ugly, bad anatomy',
  email_notifications: true,
  task_approval_emails: true,
  default_chain: 'base',
  base_enabled: true,
  ethereum_enabled: false,
  solana_enabled: false,
  monad_enabled: false,
  require_approval: true,
  auto_execute: false,
  daily_digest_enabled: true,
  rug_scan_enabled: true,
  engagement_check_enabled: true,
  zora_coin_enabled: true,
  ship_tracker_enabled: true,
  brainstorm_enabled: true,
  trading_enabled: false,
  lens_crosspost_enabled: true,
  bluesky_crosspost_enabled: true,
};

// Cache config in memory with TTL
let configCache: AgentConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Load configuration from Supabase
 * Caches results to avoid repeated database calls
 */
export async function loadConfig(env: Env): Promise<AgentConfig> {
  // Return cached config if still valid
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return configCache;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('agent_config')
      .select('key, value');

    if (error) {
      console.error('Failed to load config from database:', error);
      return DEFAULT_CONFIG;
    }

    if (!data || data.length === 0) {
      console.log('No config found in database, using defaults');
      return DEFAULT_CONFIG;
    }

    // Parse config values from database
    const config: AgentConfig = { ...DEFAULT_CONFIG };

    for (const row of data) {
      const key = row.key as keyof AgentConfig;
      let value = row.value;

      // Handle JSONB values - they might be strings or already parsed
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          // Value is already a plain string, use as-is
        }
      }

      // Type-safe assignment based on expected types
      if (key in config) {
        if (typeof DEFAULT_CONFIG[key] === 'boolean') {
          (config as Record<string, unknown>)[key] = value === true || value === 'true';
        } else if (typeof DEFAULT_CONFIG[key] === 'number') {
          (config as Record<string, unknown>)[key] = Number(value) || DEFAULT_CONFIG[key];
        } else {
          (config as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Update cache
    configCache = config;
    configCacheTime = now;

    return config;
  } catch (error) {
    console.error('Config load error:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Get a single config value
 */
export async function getConfigValue<K extends keyof AgentConfig>(
  env: Env,
  key: K
): Promise<AgentConfig[K]> {
  const config = await loadConfig(env);
  return config[key];
}

/**
 * Update a config value in the database
 */
export async function setConfigValue<K extends keyof AgentConfig>(
  env: Env,
  key: K,
  value: AgentConfig[K],
  updatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { error } = await supabase
      .from('agent_config')
      .upsert({
        key,
        value: JSON.stringify(value),
        updated_by: updatedBy || 'system',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // Invalidate cache
    configCache = null;

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Update multiple config values at once
 */
export async function setConfigValues(
  env: Env,
  values: Partial<AgentConfig>,
  updatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const updates = Object.entries(values).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
      updated_by: updatedBy || 'system',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('agent_config')
      .upsert(updates, { onConflict: 'key' });

    if (error) {
      return { success: false, error: error.message };
    }

    // Invalidate cache
    configCache = null;

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get all config values grouped by category
 */
export async function getConfigByCategory(env: Env): Promise<{
  success: boolean;
  config?: Record<string, Array<{ key: string; value: unknown; description?: string }>>;
  error?: string;
}> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('agent_config')
      .select('key, value, description, category')
      .order('key');

    if (error) {
      return { success: false, error: error.message };
    }

    // Group by category
    const grouped: Record<string, Array<{ key: string; value: unknown; description?: string }>> = {};

    for (const row of data || []) {
      const category = row.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      let value = row.value;
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
      }

      grouped[category].push({
        key: row.key,
        value,
        description: row.description,
      });
    }

    return { success: true, config: grouped };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Clear the config cache (force reload on next access)
 */
export function clearConfigCache(): void {
  configCache = null;
  configCacheTime = 0;
}

/**
 * Check if a cron job should run based on config
 */
export async function shouldRunCron(
  env: Env,
  cronType: 'gm' | 'gn' | 'digest' | 'rug_scan' | 'engagement' | 'zora' | 'ship_tracker' | 'brainstorm' | 'trading' | 'weekly_recap'
): Promise<boolean> {
  const config = await loadConfig(env);

  switch (cronType) {
    case 'gm':
      return config.auto_gm;
    case 'gn':
      return config.auto_gn;
    case 'digest':
      return config.daily_digest_enabled;
    case 'rug_scan':
      return config.rug_scan_enabled;
    case 'engagement':
      return config.engagement_check_enabled;
    case 'zora':
      return config.zora_coin_enabled;
    case 'ship_tracker':
      return config.ship_tracker_enabled;
    case 'brainstorm':
      return config.brainstorm_enabled;
    case 'trading':
      return config.trading_enabled;
    case 'weekly_recap':
      return config.weekly_recap_enabled;
    default:
      return true;
  }
}
