'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Activity, ArrowLeft, Zap } from 'lucide-react';

export default function AnalyticsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUsage, setCurrentUsage] = useState(0);
  const [currentTier, setCurrentTier] = useState('free');
  const [monthlyLimit, setMonthlyLimit] = useState(10000);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/');
      return;
    }

    setUser(user);

    // Fetch subscription data
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subscription) {
      setCurrentTier(subscription.tier);
      setCurrentUsage(subscription.used_calls || 0);
      setMonthlyLimit(subscription.monthly_limit || 10000);
    } else {
      setCurrentTier('free');
      setCurrentUsage(0);
      setMonthlyLimit(10000);
    }

    setLoading(false);
  };

  const usagePercent = monthlyLimit > 0 ? (currentUsage / monthlyLimit) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        <div
          className="fixed inset-0"
          style={{
            backgroundColor: '#000000',
            backgroundImage: 'linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        <div className="relative text-center">
          <p className="text-gray-500">LOADING ANALYTICS...</p>
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

      {/* Header */}
      <div className="relative border-b border-gray-800 bg-black/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Usage Analytics</h1>
          <p className="text-sm text-gray-500 mt-2">
            Monitor your oracle usage and performance
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="border border-gray-800 bg-black p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">API CALLS</span>
              <Activity size={20} className="text-gray-600" />
            </div>
            <div className="text-3xl font-bold">{currentUsage.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              {usagePercent.toFixed(1)}% of {monthlyLimit.toLocaleString()}
            </div>
          </div>

          <div className="border border-gray-800 bg-black p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">CURRENT PLAN</span>
              <Zap size={20} className="text-gray-600" />
            </div>
            <div className="text-3xl font-bold uppercase">{currentTier}</div>
            <div className="text-xs text-gray-500 mt-1">Subscription tier</div>
          </div>

          <div className="border border-gray-800 bg-black p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">MONTHLY LIMIT</span>
              <Zap size={20} className="text-gray-600" />
            </div>
            <div className="text-3xl font-bold">{monthlyLimit.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Calls per month</div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div className="mb-8 border border-gray-800 bg-black p-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">MONTHLY USAGE</span>
            <span className="text-sm text-gray-400">{currentUsage.toLocaleString()} / {monthlyLimit.toLocaleString()} calls</span>
          </div>
          <div className="w-full bg-gray-900 h-4 border border-gray-800">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(usagePercent, 100)}%`,
                backgroundColor: usagePercent > 90 ? 'rgb(255, 0, 110)' : usagePercent > 70 ? 'rgb(255, 140, 0)' : 'rgb(0, 255, 136)'
              }}
            />
          </div>
          {usagePercent > 80 && (
            <div className="mt-2 text-xs" style={{ color: 'rgb(255, 0, 110)' }}>
              WARNING: You've used {usagePercent.toFixed(0)}% of your monthly limit
            </div>
          )}
        </div>

        {/* Empty State for Charts */}
        <div className="border border-gray-800 bg-black p-12 text-center">
          <Activity size={48} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Detailed Analytics Coming Soon</h3>
          <p className="text-sm text-gray-500 mb-6">
            Daily usage trends, cost breakdowns, and performance metrics will be available once you create oracles.
          </p>
          <button
            onClick={() => router.push('/create-oracle')}
            className="px-6 py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-[rgb(230,0,100)] transition-all"
          >
            CREATE YOUR FIRST ORACLE
          </button>
        </div>
      </div>
    </div>
  );
}
