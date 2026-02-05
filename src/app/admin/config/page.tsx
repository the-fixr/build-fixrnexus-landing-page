'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Cog6ToothIcon,
  BellIcon,
  ClockIcon,
  KeyIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  SunIcon,
  MoonIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, ActionButton } from '@/components/admin';

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_WORKER_URL || 'https://fixr-agent.fixr21718.workers.dev';

interface ConfigSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  settings: ConfigSetting[];
}

interface ConfigSetting {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'text' | 'number' | 'select' | 'textarea';
  value: boolean | string | number;
  options?: { value: string; label: string }[];
}

// Build config structure from API response
function buildConfigSections(apiConfig: Record<string, unknown>): ConfigSection[] {
  return [
    {
      id: 'posting',
      title: 'Posting Behavior',
      description: 'Control automatic posting settings',
      icon: ChatBubbleLeftRightIcon,
      settings: [
        {
          id: 'auto_gm',
          label: 'Auto GM Posts',
          description: 'Automatically post GM messages in the morning',
          type: 'toggle',
          value: apiConfig.auto_gm as boolean ?? true,
        },
        {
          id: 'auto_gn',
          label: 'Auto GN Posts',
          description: 'Automatically post GN messages in the evening',
          type: 'toggle',
          value: apiConfig.auto_gn as boolean ?? true,
        },
        {
          id: 'auto_respond',
          label: 'Auto Respond',
          description: 'Automatically respond to mentions',
          type: 'toggle',
          value: apiConfig.auto_respond as boolean ?? true,
        },
        {
          id: 'gm_hour',
          label: 'GM Post Hour (UTC)',
          description: 'Hour to post GM (0-23)',
          type: 'number',
          value: apiConfig.gm_hour as number ?? 12,
        },
        {
          id: 'gn_hour',
          label: 'GN Post Hour (UTC)',
          description: 'Hour to post GN (0-23)',
          type: 'number',
          value: apiConfig.gn_hour as number ?? 4,
        },
        {
          id: 'max_daily_posts',
          label: 'Max Daily Posts',
          description: 'Maximum social posts per day',
          type: 'number',
          value: apiConfig.max_daily_posts as number ?? 10,
        },
      ],
    },
    {
      id: 'cron',
      title: 'Cron Jobs',
      description: 'Enable/disable automated jobs',
      icon: ClockIcon,
      settings: [
        {
          id: 'daily_digest_enabled',
          label: 'Daily Builder Digest',
          description: 'Post daily builder activity digest',
          type: 'toggle',
          value: apiConfig.daily_digest_enabled as boolean ?? true,
        },
        {
          id: 'rug_scan_enabled',
          label: 'Rug Detection Scan',
          description: 'Scan tracked tokens for rugs',
          type: 'toggle',
          value: apiConfig.rug_scan_enabled as boolean ?? true,
        },
        {
          id: 'engagement_check_enabled',
          label: 'Engagement Check',
          description: 'Check mini app engagement',
          type: 'toggle',
          value: apiConfig.engagement_check_enabled as boolean ?? true,
        },
        {
          id: 'zora_coin_enabled',
          label: 'Zora Coin Creation',
          description: 'Auto-create Zora coins every 2 days',
          type: 'toggle',
          value: apiConfig.zora_coin_enabled as boolean ?? true,
        },
        {
          id: 'ship_tracker_enabled',
          label: 'Ship Tracker',
          description: 'Daily ship ingestion and analysis',
          type: 'toggle',
          value: apiConfig.ship_tracker_enabled as boolean ?? true,
        },
        {
          id: 'brainstorm_enabled',
          label: 'Daily Brainstorm',
          description: 'Autonomous brainstorming session',
          type: 'toggle',
          value: apiConfig.brainstorm_enabled as boolean ?? true,
        },
        {
          id: 'trading_enabled',
          label: 'Trading Discussion',
          description: 'Daily trading discussion (requires Bankr)',
          type: 'toggle',
          value: apiConfig.trading_enabled as boolean ?? false,
        },
        {
          id: 'lens_crosspost_enabled',
          label: 'Lens Crossposting',
          description: 'Auto-crosspost Farcaster posts to Lens',
          type: 'toggle',
          value: apiConfig.lens_crosspost_enabled as boolean ?? true,
        },
        {
          id: 'bluesky_crosspost_enabled',
          label: 'Bluesky Crossposting',
          description: 'Auto-crosspost Farcaster posts to Bluesky',
          type: 'toggle',
          value: apiConfig.bluesky_crosspost_enabled as boolean ?? true,
        },
      ],
    },
    {
      id: 'content',
      title: 'Content Generation',
      description: 'Configure AI content generation',
      icon: SunIcon,
      settings: [
        {
          id: 'video_negative_prompt',
          label: 'Video Negative Prompt',
          description: 'What to avoid in generated videos',
          type: 'textarea',
          value: apiConfig.video_negative_prompt as string ?? 'watermark, text, logo, glitch, noisy audio, blurry, low quality',
        },
        {
          id: 'default_video_duration',
          label: 'Default Video Duration',
          description: 'Default duration for generated videos',
          type: 'select',
          value: String(apiConfig.default_video_duration ?? 5),
          options: [
            { value: '5', label: '5 seconds' },
            { value: '10', label: '10 seconds' },
          ],
        },
        {
          id: 'weekly_recap_enabled',
          label: 'Weekly Recap',
          description: 'Auto-generate weekly recap videos',
          type: 'toggle',
          value: apiConfig.weekly_recap_enabled as boolean ?? false,
        },
      ],
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Alert and notification settings',
      icon: BellIcon,
      settings: [
        {
          id: 'email_notifications',
          label: 'Email Notifications',
          description: 'Receive email alerts for important events',
          type: 'toggle',
          value: apiConfig.email_notifications as boolean ?? true,
        },
        {
          id: 'task_approval_emails',
          label: 'Task Approval Emails',
          description: 'Get emails when tasks need approval',
          type: 'toggle',
          value: apiConfig.task_approval_emails as boolean ?? true,
        },
      ],
    },
    {
      id: 'chains',
      title: 'Chain Configuration',
      description: 'Multi-chain deployment settings',
      icon: GlobeAltIcon,
      settings: [
        {
          id: 'default_chain',
          label: 'Default Chain',
          description: 'Primary chain for deployments',
          type: 'select',
          value: apiConfig.default_chain as string ?? 'base',
          options: [
            { value: 'base', label: 'Base' },
            { value: 'ethereum', label: 'Ethereum' },
            { value: 'solana', label: 'Solana' },
            { value: 'monad', label: 'Monad' },
          ],
        },
        {
          id: 'base_enabled',
          label: 'Base Enabled',
          description: 'Enable Base chain operations',
          type: 'toggle',
          value: apiConfig.base_enabled as boolean ?? true,
        },
        {
          id: 'ethereum_enabled',
          label: 'Ethereum Enabled',
          description: 'Enable Ethereum chain operations',
          type: 'toggle',
          value: apiConfig.ethereum_enabled as boolean ?? false,
        },
        {
          id: 'solana_enabled',
          label: 'Solana Enabled',
          description: 'Enable Solana chain operations',
          type: 'toggle',
          value: apiConfig.solana_enabled as boolean ?? false,
        },
        {
          id: 'monad_enabled',
          label: 'Monad Enabled',
          description: 'Enable Monad chain operations',
          type: 'toggle',
          value: apiConfig.monad_enabled as boolean ?? false,
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Security and access control',
      icon: ShieldCheckIcon,
      settings: [
        {
          id: 'require_approval',
          label: 'Require Task Approval',
          description: 'Tasks need manual approval before execution',
          type: 'toggle',
          value: apiConfig.require_approval as boolean ?? true,
        },
        {
          id: 'auto_execute',
          label: 'Auto Execute Low Risk',
          description: 'Automatically execute low-risk tasks',
          type: 'toggle',
          value: apiConfig.auto_execute as boolean ?? false,
        },
      ],
    },
  ];
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigSection[]>([]);
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load config from API on mount
  useEffect(() => {
    loadConfigFromAPI();
  }, []);

  const loadConfigFromAPI = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/config`);
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.config) {
        setOriginalConfig(data.config);
        setConfig(buildConfigSections(data.config));
      } else {
        throw new Error(data.error || 'Failed to load config');
      }
    } catch (err) {
      console.error('Config load error:', err);
      setError(String(err));
      // Fall back to empty defaults
      setConfig(buildConfigSections({}));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (
    sectionId: string,
    settingId: string,
    newValue: boolean | string | number
  ) => {
    setConfig((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              settings: section.settings.map((setting) =>
                setting.id === settingId
                  ? { ...setting, value: newValue }
                  : setting
              ),
            }
          : section
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build values object from config sections
      const values: Record<string, unknown> = {};
      for (const section of config) {
        for (const setting of section.settings) {
          // Convert string numbers back to numbers where needed
          if (setting.type === 'number') {
            values[setting.id] = Number(setting.value);
          } else if (setting.type === 'select' && ['default_video_duration'].includes(setting.id)) {
            values[setting.id] = Number(setting.value);
          } else {
            values[setting.id] = setting.value;
          }
        }
      }

      const response = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values, updatedBy: 'admin-ui' }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save config');
      }

      // Update original config with saved values
      setOriginalConfig(data.config);
      toast.success('Configuration saved to database');
      setHasChanges(false);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(`Failed to save: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(buildConfigSections(originalConfig));
    setHasChanges(false);
    toast.success('Configuration reset to saved values');
  };

  const handleRefresh = async () => {
    await loadConfigFromAPI();
    setHasChanges(false);
    toast.success('Configuration refreshed from database');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-400">
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage agent behavior and settings
          </p>
          {error && (
            <p className="text-red-400 text-sm mt-1">
              Warning: {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ActionButton variant="ghost" onClick={handleRefresh}>
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </ActionButton>
          {hasChanges && (
            <>
              <ActionButton variant="ghost" onClick={handleReset}>
                Reset
              </ActionButton>
              <ActionButton onClick={handleSave} loading={isSaving}>
                Save Changes
              </ActionButton>
            </>
          )}
        </div>
      </div>

      {/* Config Sections */}
      <div className="space-y-6">
        {config.map((section) => (
          <AdminCard
            key={section.id}
            title={section.title}
            subtitle={section.description}
            headerAction={
              <section.icon className="w-5 h-5 text-purple-400" />
            }
          >
            <div className="space-y-4">
              {section.settings.map((setting) => (
                <motion.div
                  key={setting.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start justify-between gap-4 p-4 bg-gray-800/30 rounded-xl"
                >
                  <div className="flex-1">
                    <label className="text-sm font-medium text-white">
                      {setting.label}
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {setting.description}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {setting.type === 'toggle' && (
                      <button
                        onClick={() =>
                          handleSettingChange(
                            section.id,
                            setting.id,
                            !setting.value
                          )
                        }
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          setting.value
                            ? 'bg-purple-500'
                            : 'bg-gray-700'
                        }`}
                      >
                        <motion.div
                          animate={{ x: setting.value ? 24 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full"
                        />
                      </button>
                    )}
                    {setting.type === 'text' && (
                      <input
                        type="text"
                        value={setting.value as string}
                        onChange={(e) =>
                          handleSettingChange(
                            section.id,
                            setting.id,
                            e.target.value
                          )
                        }
                        className="w-48 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    )}
                    {setting.type === 'number' && (
                      <input
                        type="number"
                        value={setting.value as number}
                        onChange={(e) =>
                          handleSettingChange(
                            section.id,
                            setting.id,
                            Number(e.target.value)
                          )
                        }
                        className="w-24 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 text-center"
                      />
                    )}
                    {setting.type === 'select' && (
                      <select
                        value={setting.value as string}
                        onChange={(e) =>
                          handleSettingChange(
                            section.id,
                            setting.id,
                            e.target.value
                          )
                        }
                        className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                      >
                        {setting.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {setting.type === 'textarea' && (
                      <textarea
                        value={setting.value as string}
                        onChange={(e) =>
                          handleSettingChange(
                            section.id,
                            setting.id,
                            e.target.value
                          )
                        }
                        rows={2}
                        className="w-64 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </AdminCard>
        ))}
      </div>

      {/* API Keys Section */}
      <AdminCard
        title="API Keys"
        subtitle="Manage service integrations"
        headerAction={<KeyIcon className="w-5 h-5 text-purple-400" />}
      >
        <div className="space-y-3">
          {[
            { name: 'Neynar API', status: 'connected' },
            { name: 'WaveSpeed AI', status: 'connected' },
            { name: 'Livepeer', status: 'connected' },
            { name: 'Gemini', status: 'connected' },
            { name: 'Supabase', status: 'connected' },
          ].map((key) => (
            <div
              key={key.name}
              className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    key.status === 'connected' ? 'bg-green-400' : 'bg-gray-500'
                  }`}
                />
                <span className="text-sm text-white">{key.name}</span>
              </div>
              <span
                className={`text-xs font-medium capitalize ${
                  key.status === 'connected'
                    ? 'text-green-400'
                    : 'text-gray-500'
                }`}
              >
                {key.status}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          API keys are managed via Cloudflare Workers secrets
        </p>
      </AdminCard>
    </div>
  );
}
