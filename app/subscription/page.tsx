'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import SubscriptionManager from '@/components/SubscriptionManager';
import { ArrowLeft } from 'lucide-react';
import { useAccount } from 'wagmi';

const TREASURY_ADDRESS = '0x7c3B6f7863fac4E9d2415b9BD286E22aeb264df4';

export default function SubscriptionPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTier, setCurrentTier] = useState<'free' | 'starter' | 'pro' | 'enterprise'>('free');
  const [usedCalls, setUsedCalls] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState(10000);
  const router = useRouter();
  const supabase = createClient();
  const { address } = useAccount();

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

    // Fetch subscription from database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subscription) {
      setCurrentTier(subscription.tier);
      setUsedCalls(subscription.used_calls || 0);
      setMonthlyLimit(subscription.monthly_limit || 10000);
    } else {
      // Default to free tier
      setCurrentTier('free');
      setUsedCalls(0);
      setMonthlyLimit(10000);
    }

    setLoading(false);
  };

  const handleUpgrade = async (tier: string, paymentMethod: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    console.log('Upgrading to:', tier, 'with payment method:', paymentMethod);
    console.log('Treasury address:', TREASURY_ADDRESS);
    console.log('User wallet:', address);

    // TODO: Implement smart contract interaction
    // 1. Call SubscriptionManager contract based on payment method
    // 2. Update subscription in database after confirmation

    alert(`Ready to upgrade to ${tier} with ${paymentMethod}\nPayments go to: ${TREASURY_ADDRESS}\n\nSmart contract integration pending`);
  };

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
          <p className="text-gray-500">LOADING SUBSCRIPTION...</p>
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
          <h1 className="text-3xl font-bold">Subscription & Billing</h1>
          <p className="text-sm text-gray-500 mt-2">
            Manage your FEEDS subscription and view usage statistics
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-6 py-8">
        <SubscriptionManager
          currentTier={currentTier}
          usedCalls={usedCalls}
          monthlyLimit={monthlyLimit}
          onUpgrade={handleUpgrade}
        />
      </div>
    </div>
  );
}
