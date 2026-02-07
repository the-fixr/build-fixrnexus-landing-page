'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import WalletConnections from '@/components/WalletConnections';
import NotificationSettings from '@/components/NotificationSettings';
import Jazzicon from '@/components/Jazzicon';
import { User, LogOut, Settings, Zap, CreditCard, TrendingUp, Eye, EyeOff, Activity, BarChart3 } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [oracles, setOracles] = useState<any[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        router.push('/');
        return;
      }

      setUser(user);

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      // Load user's oracles (including hidden ones, we'll filter in UI)
      // Select API call stats with the oracle data
      const { data: oraclesData } = await supabase
        .from('oracles')
        .select('*, total_api_calls, calls_today, last_call_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setOracles(oraclesData || []);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const toggleHideOracle = async (oracleId: string, currentHiddenState: boolean) => {
    try {
      const { error } = await supabase
        .from('oracles')
        .update({ is_hidden: !currentHiddenState })
        .eq('id', oracleId);

      if (error) throw error;

      // Refresh oracles
      await checkUser();
    } catch (error) {
      console.error('Error toggling oracle visibility:', error);
    }
  };

  // Filter oracles based on showHidden toggle
  const filteredOracles = showHidden
    ? oracles
    : oracles.filter(o => !o.is_hidden);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div
          className="fixed inset-0"
          style={{
            backgroundColor: '#000000',
            backgroundImage: 'linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        <div className="relative">
          <p className="text-gray-500">LOADING DASHBOARD...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Grid background */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: '#000000',
          backgroundImage: 'linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Top Nav Bar */}
      <nav className="relative border-b border-gray-800 bg-black/90 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-start gap-3 hover:opacity-80 transition-opacity"
          >
            <img src="/feedslogotransparent.png" alt="FEEDS Logo" className="w-10 h-10" />
            <div className="flex flex-col justify-start items-start">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">FEEDS</h1>
              <p className="text-xs text-gray-500 tracking-wide leading-tight">DECENTRALIZED CONSENSUS</p>
            </div>
          </button>

          <div className="flex items-center" style={{ gap: '16px' }}>
            {/* Wallet Connect */}
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />

            {/* User info */}
            <div className="flex items-center border border-gray-800" style={{ padding: '8px 16px' }}>
              <User size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400" style={{ marginLeft: '8px' }}>
                {profile?.username || user?.email?.split('@')[0] || 'USER'}
              </span>
            </div>

            {/* Sign out button */}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center"
            >
              <LogOut size={16} />
              <span className="text-sm font-bold" style={{ marginLeft: '8px' }}>SIGN OUT</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-12">
        {/* Dashboard Header */}
        <div style={{ marginBottom: '40px' }}>
          <div className="flex items-center" style={{ marginBottom: '8px' }}>
            <Settings size={32} style={{ color: 'rgb(255, 0, 110)' }} />
            <h2 className="text-4xl font-bold" style={{ marginLeft: '16px' }}>
              DASHBOARD
            </h2>
          </div>
          <p className="text-gray-500" style={{ marginLeft: '48px' }}>
            Manage your account, wallets, and oracle configurations
          </p>
        </div>

        {/* Account Status Bar */}
        <div className="border border-gray-800 bg-black" style={{ padding: '24px', marginBottom: '32px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(255, 0, 110)' }}></div>
              <span className="text-sm text-gray-400" style={{ marginLeft: '12px' }}>STATUS:</span>
              <span className="text-sm text-white font-bold" style={{ marginLeft: '8px' }}>ACTIVE</span>
            </div>

            <div className="flex items-center">
              <span className="text-sm text-gray-400">NETWORK:</span>
              <span className="text-sm text-white font-bold" style={{ marginLeft: '8px' }}>BASE_MAINNET</span>
            </div>

            <div className="flex items-center">
              <span className="text-sm text-gray-400">EMAIL:</span>
              <span className="text-sm text-white font-mono" style={{ marginLeft: '8px' }}>{user?.email}</span>
            </div>

            <div className="flex items-center">
              <span className="text-sm text-gray-400">JOINED:</span>
              <span className="text-sm text-white" style={{ marginLeft: '8px' }}>
                {new Date(user?.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ marginBottom: '48px' }}>
          <button
            onClick={() => router.push('/create-oracle')}
            className="border-2 bg-black hover:border-[rgb(255,0,110)] transition-all text-left"
            style={{ borderColor: 'rgb(255, 0, 110)', padding: '24px' }}
          >
            <Zap size={24} style={{ color: 'rgb(255, 0, 110)', marginBottom: '12px' }} />
            <h3 className="text-lg font-bold text-white" style={{ marginBottom: '8px' }}>CREATE ORACLE</h3>
            <p className="text-sm text-gray-500">Configure a new data feed using AI</p>
          </button>

          <button
            onClick={() => router.push('/api-studio')}
            className="border-2 bg-black border-gray-800 hover:border-gray-600 transition-all text-left"
            style={{ padding: '24px' }}
          >
            <Zap size={24} style={{ color: 'rgb(0, 255, 255)', marginBottom: '12px' }} />
            <h3 className="text-lg font-bold text-white" style={{ marginBottom: '8px' }}>API STUDIO</h3>
            <p className="text-sm text-gray-500">Test and query oracle endpoints</p>
          </button>

          <button
            onClick={() => router.push('/subscription')}
            className="border-2 bg-black border-gray-800 hover:border-gray-600 transition-all text-left"
            style={{ padding: '24px' }}
          >
            <CreditCard size={24} style={{ color: 'rgb(0, 255, 136)', marginBottom: '12px' }} />
            <h3 className="text-lg font-bold text-white" style={{ marginBottom: '8px' }}>SUBSCRIPTION</h3>
            <p className="text-sm text-gray-500">Manage billing and upgrade plan</p>
          </button>
        </div>

        {/* MY ORACLES Section - Full Width */}
        <div className="border-2 border-gray-800 bg-black" style={{ padding: '32px', marginBottom: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
            <div className="flex items-center gap-3">
              <Settings size={24} className="text-gray-600" />
              <h3 className="text-2xl font-bold text-white">MY ORACLES</h3>
            </div>
            {oracles.length > 0 && (
              <button
                onClick={() => setShowHidden(!showHidden)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                {showHidden ? 'HIDE RETIRED' : 'SHOW RETIRED'}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500" style={{ marginBottom: '24px' }}>
            View and manage your data feeds • Click oracle to test in API Studio
          </p>

          {filteredOracles.length === 0 ? (
            <div className="text-center py-12 border border-gray-800">
              <p className="text-sm text-gray-600">
                {oracles.length === 0 ? 'No oracles deployed yet' : 'No visible oracles'}
              </p>
              {oracles.length === 0 && (
                <button
                  onClick={() => router.push('/create-oracle')}
                  className="mt-4 px-6 py-2 border-2 border-[rgb(255,0,110)] text-white hover:bg-[rgb(255,0,110)] transition-all"
                >
                  CREATE YOUR FIRST ORACLE
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOracles.map((oracle) => (
                <div
                  key={oracle.id}
                  className={`border p-4 transition-colors ${
                    oracle.is_hidden
                      ? 'border-gray-800/50 opacity-60'
                      : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Jazzicon */}
                    {oracle.contract_address && (
                      <div className="flex-shrink-0">
                        <Jazzicon address={oracle.contract_address} diameter={48} />
                      </div>
                    )}

                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        if (oracle.contract_address) {
                          const endpoint = oracle.oracle_type === 'farcaster'
                            ? `/api/v1/farcaster/${oracle.contract_address}`
                            : `/api/v1/oracle/${oracle.contract_address}`;
                          window.open(`/api-studio?endpoint=${endpoint}&address=${oracle.contract_address}`, '_blank');
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-bold text-white flex items-center gap-2">
                            {oracle.name}
                            {oracle.is_hidden && (
                              <span className="text-xs text-gray-600 font-normal">(RETIRED)</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {oracle.oracle_type.toUpperCase()} ORACLE
                            {oracle.target_token && ` • Tracking ${oracle.target_token}`}
                          </div>
                        </div>
                        <div className={`flex-shrink-0 px-3 py-1 text-xs ${
                          oracle.status === 'active'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : oracle.status === 'deploying'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {oracle.status.toUpperCase()}
                        </div>
                      </div>

                      {oracle.contract_address && (
                        <>
                          <div className="text-xs text-gray-600 font-mono mb-3">
                            {oracle.contract_address.slice(0, 10)}...{oracle.contract_address.slice(-8)}
                          </div>

                          {/* API Call Stats - Enhanced */}
                          <div className="grid grid-cols-3 gap-4 p-3 bg-gray-900/50 border border-gray-800">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">TOTAL CALLS</div>
                              <div className="flex items-center gap-2">
                                <Activity size={14} className="text-blue-400" />
                                <span className="text-sm font-bold text-blue-400 font-mono">
                                  {oracle.total_api_calls?.toLocaleString() || 0}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">TODAY</div>
                              <div className="text-sm font-bold text-green-400 font-mono">
                                {oracle.calls_today?.toLocaleString() || 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">LAST CALL</div>
                              <div className="text-sm font-bold text-gray-400">
                                {oracle.last_call_at
                                  ? new Date(oracle.last_call_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : 'Never'
                                }
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {/* View Stats Button */}
                      {oracle.contract_address && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/oracle-stats/${oracle.id}`);
                          }}
                          className="p-2 border border-gray-800 text-gray-600 hover:text-blue-400 hover:border-blue-400 transition-colors"
                          title="View detailed analytics"
                        >
                          <BarChart3 size={18} />
                        </button>
                      )}

                      {/* Hide/Unhide Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHideOracle(oracle.id, oracle.is_hidden);
                        }}
                        className="p-2 border border-gray-800 text-gray-600 hover:text-gray-400 hover:border-gray-600 transition-colors"
                        title={oracle.is_hidden ? 'Unhide oracle' : 'Hide oracle'}
                      >
                        {oracle.is_hidden ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallet Connections Section */}
        <div style={{ marginBottom: '32px' }}>
          <WalletConnections />
        </div>

        {/* Notification Settings Section */}
        <div>
          <NotificationSettings />
        </div>

        {/* Footer Info */}
        <div className="border-t border-gray-900 text-xs text-gray-600" style={{ marginTop: '48px', paddingTop: '24px' }}>
          <div className="flex items-center justify-between">
            <div>
              <p>// FEEDS Decentralized Oracle Network</p>
              <p style={{ marginTop: '4px' }}>// Building on Base</p>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse"></div>
              <span style={{ marginLeft: '8px' }}>SYSTEM OPERATIONAL</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
