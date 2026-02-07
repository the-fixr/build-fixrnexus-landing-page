'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell } from 'lucide-react';

interface NotificationPreferences {
  email_oracle_updates: boolean;
  email_price_alerts: boolean;
  email_consensus_failures: boolean;
  email_weekly_summary: boolean;
  email_security_alerts: boolean;
}

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_oracle_updates: true,
    email_price_alerts: true,
    email_consensus_failures: true,
    email_weekly_summary: true,
    email_security_alerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setPreferences({
          email_oracle_updates: data.email_oracle_updates,
          email_price_alerts: data.email_price_alerts,
          email_consensus_failures: data.email_consensus_failures,
          email_weekly_summary: data.email_weekly_summary,
          email_security_alerts: data.email_security_alerts,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notification_preferences')
        .update({
          email_oracle_updates: preferences.email_oracle_updates,
          email_price_alerts: preferences.email_price_alerts,
          email_consensus_failures: preferences.email_consensus_failures,
          email_weekly_summary: preferences.email_weekly_summary,
          email_security_alerts: preferences.email_security_alerts,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setMessage('Preferences saved successfully');
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
        <p className="text-gray-500">Loading preferences...</p>
      </div>
    );
  }

  const notificationOptions = [
    {
      key: 'email_oracle_updates' as keyof NotificationPreferences,
      label: 'ORACLE UPDATES',
      description: 'Get notified when your oracles update or change status',
    },
    {
      key: 'email_price_alerts' as keyof NotificationPreferences,
      label: 'PRICE ALERTS',
      description: 'Receive alerts for significant price movements',
    },
    {
      key: 'email_consensus_failures' as keyof NotificationPreferences,
      label: 'CONSENSUS FAILURES',
      description: 'Alert when consensus verification fails',
    },
    {
      key: 'email_weekly_summary' as keyof NotificationPreferences,
      label: 'WEEKLY SUMMARY',
      description: 'Weekly digest of oracle activity and performance',
    },
    {
      key: 'email_security_alerts' as keyof NotificationPreferences,
      label: 'SECURITY ALERTS',
      description: 'Critical security notifications (always recommended)',
    },
  ];

  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      {/* Header */}
      <div className="flex items-center" style={{ marginBottom: '32px' }}>
        <Bell size={24} style={{ color: 'rgb(255, 0, 110)' }} />
        <h2 className="text-xl font-bold text-white" style={{ marginLeft: '12px' }}>
          NOTIFICATION PREFERENCES
        </h2>
      </div>

      {/* Success/Error message */}
      {message && (
        <div
          className="border text-sm"
          style={{
            borderColor: 'rgb(255, 0, 110)',
            color: 'rgb(255, 0, 110)',
            padding: '12px',
            marginBottom: '24px',
            backgroundColor: 'rgba(255, 0, 110, 0.1)'
          }}
        >
          {message}
        </div>
      )}

      {/* Notification toggles */}
      <div className="space-y-6">
        {notificationOptions.map((option) => (
          <div key={option.key} className="border-b border-gray-900" style={{ paddingBottom: '24px' }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white" style={{ marginBottom: '4px' }}>
                  {option.label}
                </h3>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => togglePreference(option.key)}
                className="relative w-14 h-7 border border-gray-800 transition-all"
                style={{
                  backgroundColor: preferences[option.key] ? 'rgb(255, 0, 110)' : 'transparent',
                }}
              >
                <div
                  className="absolute top-1 w-5 h-5 bg-white transition-all"
                  style={{
                    left: preferences[option.key] ? '28px' : '4px',
                  }}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={savePreferences}
        disabled={saving}
        className="w-full border text-white font-bold py-3 transition-all disabled:opacity-50"
        style={{
          backgroundColor: 'rgb(255, 0, 110)',
          borderColor: 'rgb(255, 0, 110)',
          marginTop: '32px',
        }}
        onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = 'transparent')}
        onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)')}
      >
        {saving ? 'SAVING...' : 'SAVE PREFERENCES'}
      </button>
    </div>
  );
}
