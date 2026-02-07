'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Code,
  Cpu,
  Zap,
  ShieldCheck,
  TrendingUp,
  User
} from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import SignupWizard from '@/components/SignupWizard';

const VALIDATOR_ENDPOINTS = [
  'https://feeds-validator-1.see21289.workers.dev',
  'https://feeds-validator-2.see21289.workers.dev',
  'https://feeds-validator-3.see21289.workers.dev',
  'https://feeds-validator-4.see21289.workers.dev',
  'https://feeds-validator-5.see21289.workers.dev'
];

export default function Home() {
  const [input, setInput] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [signupWizardOpen, setSignupWizardOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [validatorsOnline, setValidatorsOnline] = useState<number>(0);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'online' | 'degraded' | 'offline'>('checking');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
    checkValidators();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null);
    });

    const interval = setInterval(checkValidators, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const checkValidators = async () => {
    const results = await Promise.allSettled(
      VALIDATOR_ENDPOINTS.map(endpoint =>
        fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(5000) })
          .then(res => res.json())
      )
    );

    const onlineCount = results.filter(r => r.status === 'fulfilled').length;
    setValidatorsOnline(onlineCount);

    if (onlineCount === 5) {
      setNetworkStatus('online');
    } else if (onlineCount >= 3) {
      setNetworkStatus('degraded');
    } else {
      setNetworkStatus('offline');
    }
  };

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

          <div className="flex items-center" style={{ gap: '24px' }}>
            <a
              href="/hub"
              className="text-sm transition-colors"
              style={{ color: 'rgb(255, 0, 110)' }}
            >
              $FIXR
            </a>
            <a
              href="/marketplace"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              MARKETPLACE
            </a>
            <a
              href="/pricing"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              PRICING
            </a>
            <a
              href="/health"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              STATUS
            </a>

            {user ? (
              <div className="flex items-center" style={{ gap: '12px' }}>
                <div className="flex items-center border border-gray-800" style={{ padding: '8px 16px' }}>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(255, 0, 110)' }}></div>
                  <User size={14} className="text-gray-400" style={{ marginLeft: '8px' }} />
                  <span className="text-sm text-gray-400" style={{ marginLeft: '6px' }}>
                    {user.email?.split('@')[0]?.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2 border hover:text-white transition-all font-bold"
                  style={{ borderColor: 'rgb(255, 0, 110)', color: 'rgb(255, 0, 110)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  DASHBOARD
                </button>
              </div>
            ) : (
              <div className="flex items-center" style={{ gap: '12px' }}>
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                >
                  SIGN IN
                </button>
                <button
                  onClick={() => setSignupWizardOpen(true)}
                  className="px-6 py-2 border hover:text-white transition-all"
                  style={{ borderColor: 'rgb(255, 0, 110)', color: 'rgb(255, 0, 110)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  GET STARTED
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-20">
        {/* Hero Section */}
        <div className="mb-20 text-center">
          <div className="inline-block mb-6">
            <div className="flex items-center px-4 py-2 border border-gray-700 text-gray-400 text-sm">
              <Zap size={16} />
              <span style={{ marginLeft: '0.5rem' }}>ORACLE NETWORK</span>
            </div>
          </div>
          <h2 className="text-6xl font-bold mb-6 tracking-tight">
            FEEDS: <span style={{ color: 'rgb(255, 0, 110)' }}>DECENTRALIZED CONSENSUS</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            AI-powered oracle creation with multi-node consensus verification
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mb-20">
          <div className="flex flex-col md:flex-row" style={{ marginLeft: '-16px', marginRight: '-16px' }}>
            {/* Data Feeds Card */}
            <div className="group relative bg-black border-2 border-gray-800 hover:border-gray-600 transition-all flex-1" style={{ marginLeft: '16px', marginRight: '16px', marginBottom: '16px', padding: '40px' }}>
              <TrendingUp size={40} className="text-gray-400" style={{ marginBottom: '16px' }} />
              <h3 className="text-lg font-bold text-white" style={{ marginBottom: '8px' }}>DATA ORACLES</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Token prices, social metrics, liquidity data, and custom endpoints with real-time updates
              </p>
              <div className="flex" style={{ marginTop: '24px' }}>
                <span className="px-3 py-1 bg-gray-900 text-gray-400 text-xs border border-gray-800">
                  BASE
                </span>
                <span className="px-3 py-1 bg-gray-900 text-gray-400 text-xs border border-gray-800" style={{ marginLeft: '8px' }}>
                  REALTIME
                </span>
              </div>
            </div>

            {/* AI Powered Card */}
            <div className="group relative bg-black border-2 transition-all flex-1" style={{ borderColor: 'rgb(255, 0, 110)', marginLeft: '16px', marginRight: '16px', marginBottom: '16px', padding: '40px' }}>
              <Cpu size={40} style={{ color: 'rgb(255, 0, 110)', marginBottom: '16px' }} />
              <h3 className="text-lg font-bold text-white" style={{ marginBottom: '8px' }}>AI CONFIGURATION</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Natural language oracle setup powered by Claude AI
              </p>
              <div className="flex" style={{ marginTop: '24px' }}>
                <span className="px-3 py-1 text-xs border" style={{ backgroundColor: 'rgba(255, 0, 110, 0.1)', color: 'rgb(255, 0, 110)', borderColor: 'rgba(255, 0, 110, 0.3)' }}>
                  CLAUDE
                </span>
                <span className="px-3 py-1 text-xs border" style={{ backgroundColor: 'rgba(255, 0, 110, 0.1)', color: 'rgb(255, 0, 110)', borderColor: 'rgba(255, 0, 110, 0.3)', marginLeft: '0.5rem' }}>
                  NO CODE
                </span>
              </div>
            </div>

            {/* Consensus Card */}
            <div className="group relative bg-black border-2 border-gray-800 hover:border-gray-600 transition-all flex-1" style={{ marginLeft: '16px', marginRight: '16px', marginBottom: '16px', padding: '40px' }}>
              <ShieldCheck size={40} className="text-gray-400" style={{ marginBottom: '16px' }} />
              <h3 className="text-lg font-bold text-white" style={{ marginBottom: '8px' }}>CONSENSUS LAYER</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Multi-operator verification via Cloudflare Workers network
              </p>
              <div className="flex" style={{ marginTop: '24px' }}>
                <span className="px-3 py-1 bg-gray-900 text-gray-400 text-xs border border-gray-800">
                  VERIFIED
                </span>
                <span className="px-3 py-1 bg-gray-900 text-gray-400 text-xs border border-gray-800" style={{ marginLeft: '0.5rem' }}>
                  SECURE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Marketplace CTA */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="relative border border-gray-800 bg-gradient-to-br from-gray-900/50 to-black overflow-hidden">
            {/* Subtle grid overlay */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />

            <div className="relative" style={{ padding: '48px' }}>
              <div className="flex items-start gap-8">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 border border-gray-700 bg-gray-900/80 flex items-center justify-center">
                    <TrendingUp size={32} className="text-gray-400" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-3xl font-bold text-white mb-3">Oracle Marketplace</h3>
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    Browse and discover public oracles deployed by the community. Find data feeds for your project, read reviews, and start integrating immediately.
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => router.push('/marketplace')}
                      className="px-8 py-3 bg-white text-black font-bold hover:bg-gray-200 transition-all"
                    >
                      BROWSE MARKETPLACE
                    </button>
                    {!user && (
                      <button
                        onClick={() => setSignupWizardOpen(true)}
                        className="px-8 py-3 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white font-bold transition-all"
                      >
                        CREATE ORACLE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Interface */}
        <div className="max-w-4xl mx-auto">
          <div className="border border-gray-800 bg-black overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-black border-b border-gray-800">
              <div className="flex items-center">
                <Code size={20} className="text-gray-400" />
                <span className="text-white text-sm font-bold tracking-wide" style={{ marginLeft: '0.75rem' }}>ORACLE CONFIGURATOR</span>
              </div>
              <div className="flex">
                <div className="w-3 h-3 rounded-full bg-gray-700"></div>
                <div className="w-3 h-3 rounded-full bg-gray-700" style={{ marginLeft: '0.5rem' }}></div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(255, 0, 110)', marginLeft: '0.5rem' }}></div>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-8">
              <div className="space-y-3 mb-8 text-sm font-mono">
                <div className="flex items-center">
                  <span className="text-gray-600">&gt;</span>
                  <span className="text-gray-600" style={{ marginLeft: '0.75rem' }}>STATUS:</span>
                  <span className="text-white" style={{ marginLeft: '0.75rem' }}>
                    {networkStatus === 'checking' ? 'CHECKING...' : networkStatus.toUpperCase()}
                  </span>
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      backgroundColor: networkStatus === 'online' ? 'rgb(255, 0, 110)' :
                                      networkStatus === 'degraded' ? 'rgb(255, 200, 0)' :
                                      'rgb(128, 128, 128)',
                      marginLeft: '0.75rem'
                    }}
                  ></div>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">&gt;</span>
                  <span className="text-gray-600" style={{ marginLeft: '0.75rem' }}>NETWORK:</span>
                  <span className="text-white" style={{ marginLeft: '0.75rem' }}>BASE_MAINNET</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">&gt;</span>
                  <span className="text-gray-600" style={{ marginLeft: '0.75rem' }}>VALIDATORS:</span>
                  <span className="text-white" style={{ marginLeft: '0.75rem' }}>{validatorsOnline}/5 ONLINE</span>
                </div>
              </div>

              <div className="border-t border-gray-900 pt-8">
                <p className="text-gray-600 text-sm mb-2">// Describe your oracle configuration</p>
                <p className="text-gray-700 text-xs mb-6">// Example: "Track ETH/USD from Binance, Coinbase, update every 5min"</p>

                <div className="flex items-center bg-black border border-gray-800 px-4 py-3">
                  <span style={{ color: 'rgb(255, 0, 110)' }}>$</span>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter oracle description..."
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-800"
                    style={{ marginLeft: '0.75rem', marginRight: '0.75rem' }}
                    autoFocus
                  />
                  <div className="w-2 h-5 animate-pulse" style={{ backgroundColor: 'rgb(255, 0, 110)' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex justify-center mt-12">
            <button
              onClick={() => {
                if (user) {
                  router.push('/create-oracle');
                } else {
                  setSignupWizardOpen(true);
                }
              }}
              className="px-8 py-4 border text-white font-bold transition-all"
              style={{ backgroundColor: 'rgb(255, 0, 110)', borderColor: 'rgb(255, 0, 110)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)'}
            >
              CREATE ORACLE
            </button>
            <button className="px-8 py-4 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white transition-all font-bold" style={{ marginLeft: '1rem' }}>
              VIEW DOCS
            </button>
          </div>
        </div>

        {/* Status Footer */}
        <div className="mt-20 flex items-center justify-center text-sm text-gray-600">
          <div className="flex items-center">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{
                backgroundColor: networkStatus === 'online' ? 'rgb(255, 0, 110)' :
                                networkStatus === 'degraded' ? 'rgb(255, 200, 0)' :
                                'rgb(128, 128, 128)'
              }}
            ></div>
            <span style={{ marginLeft: '0.5rem' }}>
              NETWORK {networkStatus === 'checking' ? 'CHECKING' : networkStatus.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center" style={{ marginLeft: '2rem' }}>
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: validatorsOnline >= 3 ? 'rgb(255, 0, 110)' : 'rgb(128, 128, 128)' }}
            ></div>
            <span style={{ marginLeft: '0.5rem' }}>{validatorsOnline} VALIDATORS ONLINE</span>
          </div>
          <div className="flex items-center" style={{ marginLeft: '2rem' }}>
            <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse"></div>
            <span style={{ marginLeft: '0.5rem' }}>BASE CONNECTED</span>
          </div>
          <a
            href="/health"
            className="flex items-center hover:text-white transition-colors"
            style={{ marginLeft: '2rem' }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgb(255, 0, 110)' }}></div>
            <span style={{ marginLeft: '0.5rem' }}>VIEW HEALTH</span>
          </a>
        </div>
      </main>

      {/* Modals */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <SignupWizard isOpen={signupWizardOpen} onClose={() => setSignupWizardOpen(false)} />
    </div>
  );
}
