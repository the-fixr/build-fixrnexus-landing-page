'use client';

import { useState } from 'react';
import { Check, Zap, CreditCard, Wallet, Coins, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SubscriptionManagerProps {
  currentTier?: 'free' | 'starter' | 'pro' | 'enterprise';
  usedCalls?: number;
  monthlyLimit?: number;
  onUpgrade?: (tier: string, paymentMethod: string) => void;
}

type PaymentMethod = 'usdc' | 'eth' | 'feeds';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: { usdc: 0, eth: 0, feeds: 0 },
    period: 'forever',
    description: 'Perfect for testing and POCs',
    callLimit: 10000,
    updateFrequency: '5 min',
    features: [
      '10,000 API calls/month',
      '5 minute update frequency',
      'Community support',
      '1 custom oracle',
      'Basic analytics',
    ],
    highlighted: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: { usdc: 29, eth: 0.0097, feeds: 21.75 },
    period: 'month',
    description: 'For small dApps and side projects',
    callLimit: 100000,
    updateFrequency: '1 min',
    features: [
      '100,000 API calls/month',
      '1 minute update frequency',
      'Email support',
      '3 custom oracles',
      'Advanced analytics',
      'Usage alerts',
    ],
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { usdc: 99, eth: 0.033, feeds: 74.25 },
    period: 'month',
    description: 'For production applications',
    callLimit: 1000000,
    updateFrequency: '30 sec',
    features: [
      '1,000,000 API calls/month',
      '30 second update frequency',
      'Priority support',
      'Unlimited oracles',
      'Real-time analytics',
      'Usage alerts',
      'SLA guarantee',
      'Custom data sources',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: { usdc: null, eth: null, feeds: null },
    period: 'custom',
    description: 'For large-scale deployments',
    callLimit: Infinity,
    updateFrequency: 'custom',
    features: [
      'Unlimited API calls',
      'Custom update frequency',
      'Dedicated support',
      'Unlimited oracles',
      'White-label option',
      'Custom integrations',
      'Volume discounts',
      'SLA + uptime guarantees',
    ],
    highlighted: false,
  },
];

export default function SubscriptionManager({
  currentTier = 'free',
  usedCalls = 0,
  monthlyLimit = 10000,
  onUpgrade,
}: SubscriptionManagerProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('usdc');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const router = useRouter();

  const currentTierData = TIERS.find(t => t.id === currentTier);
  const usagePercent = (usedCalls / monthlyLimit) * 100;

  const handleSelectTier = (tierId: string) => {
    if (tierId === 'enterprise') {
      // Contact sales for enterprise
      window.location.href = 'mailto:sales@feeds.network';
      return;
    }

    if (tierId === currentTier) {
      return; // Already on this tier
    }

    setSelectedTier(tierId);
    setShowPaymentModal(true);
  };

  const handleConfirmUpgrade = () => {
    if (selectedTier && onUpgrade) {
      onUpgrade(selectedTier, paymentMethod);
    }
    setShowPaymentModal(false);
    setSelectedTier(null);
  };

  const selectedTierData = TIERS.find(t => t.id === selectedTier);

  return (
    <div className="font-mono">
      {/* Beta Access Banner */}
      <div className="border-2 border-[rgb(0,255,136)] bg-[rgb(0,255,136)] bg-opacity-10 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[rgb(0,255,136)] mb-1">🎉 BETA ACCESS - ALL FEATURES FREE</h3>
            <p className="text-sm text-gray-400">
              During beta, all users get Pro-tier features for free. Pricing activates Q2 2026.
            </p>
          </div>
        </div>
      </div>

      {/* Current Plan Overview */}
      <div className="border-2 border-gray-800 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Current Plan: {currentTierData?.name}</h2>
            <p className="text-sm text-gray-400">{currentTierData?.description}</p>
          </div>
          {currentTier !== 'enterprise' && (
            <div className="text-right">
              <div className="text-3xl font-bold">
                ${currentTierData?.price.usdc}
                <span className="text-lg text-gray-400">/{currentTierData?.period}</span>
              </div>
              {currentTierData && currentTierData.price.feeds && currentTierData.price.feeds > 0 && (
                <div className="text-sm text-gray-500 mt-1">
                  or ${currentTierData.price.feeds} with $FEEDS
                </div>
              )}
            </div>
          )}
        </div>

        {/* Usage Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Monthly Usage</span>
            <span className="text-sm text-gray-400">
              {usedCalls.toLocaleString()} / {monthlyLimit.toLocaleString()} calls
            </span>
          </div>
          <div className="w-full bg-gray-900 h-3 border border-gray-800">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(usagePercent, 100)}%`,
                backgroundColor:
                  usagePercent > 90 ? 'rgb(255, 0, 110)' :
                  usagePercent > 70 ? 'rgb(255, 200, 0)' :
                  'rgb(0, 255, 136)',
              }}
            />
          </div>
          {usagePercent > 80 && (
            <div className="mt-2 text-xs text-[rgb(255,0,110)]">
              Warning: You've used {usagePercent.toFixed(0)}% of your monthly limit
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
          <div>
            <div className="text-xs text-gray-500 mb-1">Update Frequency</div>
            <div className="text-lg font-bold">{currentTierData?.updateFrequency}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Remaining Calls</div>
            <div className="text-lg font-bold">
              {Math.max(0, monthlyLimit - usedCalls).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Support Level</div>
            <div className="text-lg font-bold">
              {currentTier === 'free' ? 'Community' :
               currentTier === 'starter' ? 'Email' :
               currentTier === 'pro' ? 'Priority' : 'Dedicated'}
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.id === currentTier;
            const isUpgrade = TIERS.findIndex(t => t.id === tier.id) > TIERS.findIndex(t => t.id === currentTier);
            const isDowngrade = TIERS.findIndex(t => t.id === tier.id) < TIERS.findIndex(t => t.id === currentTier);
            const isComingSoon = tier.id !== 'free';

            return (
              <div
                key={tier.id}
                className={`border-2 p-6 transition-all relative ${
                  isComingSoon ? 'opacity-60' : ''
                } ${
                  tier.highlighted
                    ? 'border-[rgb(255,0,110)] bg-black'
                    : isCurrent
                    ? 'border-[rgb(0,255,136)] bg-black'
                    : 'border-gray-800 bg-black hover:border-gray-700'
                }`}
              >
                {isComingSoon && (
                  <div className="absolute top-4 right-4">
                    <span className="px-2 py-1 text-xs bg-gray-800 text-gray-500 border border-gray-700">
                      Q2 2026
                    </span>
                  </div>
                )}

                {isCurrent && (
                  <div className="mb-4">
                    <span className="px-3 py-1 text-xs border border-[rgb(0,255,136)] bg-[rgb(0,255,136)] bg-opacity-10 text-[rgb(0,255,136)]">
                      CURRENT PLAN
                    </span>
                  </div>
                )}

                <h4 className="text-xl font-bold mb-2">{tier.name}</h4>
                <p className="text-xs text-gray-400 mb-4">{tier.description}</p>

                <div className="mb-6">
                  {tier.price.usdc !== null ? (
                    <>
                      <div className={`text-3xl font-bold ${isComingSoon ? 'line-through text-gray-600' : ''}`}>
                        ${tier.price.usdc}
                        <span className="text-sm text-gray-400">/{tier.period}</span>
                      </div>
                      {isComingSoon && (
                        <div className="mt-2 text-sm text-[rgb(0,255,136)]">
                          FREE during beta
                        </div>
                      )}
                      {tier.price.feeds && tier.price.feeds > 0 && !isComingSoon && (
                        <div className="mt-1 text-xs text-gray-500">
                          or <span className="text-[rgb(255,0,110)]">${tier.price.feeds}</span> with $FEEDS
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-3xl font-bold">Custom</div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTier(tier.id);
                  }}
                  disabled={isCurrent}
                  className={`w-full py-2 px-4 text-sm font-bold transition-all mb-6 ${
                    isCurrent
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : tier.highlighted
                      ? 'bg-[rgb(255,0,110)] text-white hover:bg-[rgb(230,0,100)]'
                      : 'border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  {isCurrent ? 'CURRENT PLAN' :
                   tier.id === 'enterprise' ? 'CONTACT SALES' :
                   isUpgrade ? 'UPGRADE' :
                   isDowngrade ? 'DOWNGRADE' : 'SELECT'}
                </button>

                <div className="space-y-2">
                  {tier.features.slice(0, 4).map((feature, index) => (
                    <div key={index} className="flex items-start text-xs">
                      <Check size={12} className="text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                  {tier.features.length > 4 && (
                    <div className="text-xs text-gray-500 ml-5">
                      +{tier.features.length - 4} more features
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && selectedTierData && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-black border-2 border-gray-800 max-w-lg w-full mx-4">
            {/* Header */}
            <div className="border-b border-gray-800 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                Upgrade to {selectedTierData.name}
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Payment Method Selection */}
            <div className="p-6">
              <p className="text-sm text-gray-400 mb-6">
                Select your preferred payment method to complete the upgrade.
              </p>

              <div className="space-y-3 mb-6">
                {/* USDC */}
                <button
                  onClick={() => setPaymentMethod('usdc')}
                  className={`w-full p-4 border-2 transition-all text-left ${
                    paymentMethod === 'usdc'
                      ? 'border-[rgb(255,0,110)] bg-[rgb(255,0,110)] bg-opacity-5'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CreditCard size={20} className="text-blue-500 mr-3" />
                      <div>
                        <div className="font-bold">USDC</div>
                        <div className="text-xs text-gray-500">Stablecoin - Price stability</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${selectedTierData.price.usdc}</div>
                      <div className="text-xs text-gray-500">/{selectedTierData.period}</div>
                    </div>
                  </div>
                </button>

                {/* ETH */}
                <button
                  onClick={() => setPaymentMethod('eth')}
                  className={`w-full p-4 border-2 transition-all text-left ${
                    paymentMethod === 'eth'
                      ? 'border-[rgb(255,0,110)] bg-[rgb(255,0,110)] bg-opacity-5'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Wallet size={20} className="text-purple-500 mr-3" />
                      <div>
                        <div className="font-bold">ETH</div>
                        <div className="text-xs text-gray-500">Native Base token</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">~{selectedTierData.price.eth} ETH</div>
                      <div className="text-xs text-gray-500">≈ ${selectedTierData.price.usdc}</div>
                    </div>
                  </div>
                </button>

                {/* FEEDS */}
                {(selectedTierData.price.feeds ?? 0) > 0 && (
                  <button
                    onClick={() => setPaymentMethod('feeds')}
                    className={`w-full p-4 border-2 transition-all text-left ${
                      paymentMethod === 'feeds'
                        ? 'border-[rgb(255,0,110)] bg-[rgb(255,0,110)] bg-opacity-5'
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Coins size={20} className="text-[rgb(255,0,110)] mr-3" />
                        <div>
                          <div className="font-bold flex items-center">
                            $FEEDS
                            <span className="ml-2 px-2 py-0.5 text-xs bg-[rgb(255,0,110)] bg-opacity-10 border border-[rgb(255,0,110)] border-opacity-30 text-[rgb(255,0,110)]">
                              SAVE 25%
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">Protocol token - Best value</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[rgb(255,0,110)]">${selectedTierData.price.feeds ?? 0}</div>
                        <div className="text-xs text-gray-500 line-through">${selectedTierData.price.usdc}</div>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* Summary */}
              <div className="border border-gray-800 p-4 bg-gray-900 bg-opacity-50 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Plan</span>
                  <span className="font-bold">{selectedTierData.name}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Payment Method</span>
                  <span className="font-bold uppercase">{paymentMethod}</span>
                </div>
                <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total</span>
                  <span className="text-xl font-bold">
                    {paymentMethod === 'usdc' && `$${selectedTierData.price.usdc}`}
                    {paymentMethod === 'eth' && `${selectedTierData.price.eth} ETH`}
                    {paymentMethod === 'feeds' && `$${selectedTierData.price.feeds ?? 0}`}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleConfirmUpgrade}
                  className="flex-1 py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-[rgb(230,0,100)] transition-all"
                >
                  CONFIRM UPGRADE
                </button>
              </div>

              <p className="mt-4 text-xs text-gray-500 text-center">
                You'll be charged immediately. Your new plan starts right away.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Full Pricing */}
      <div className="text-center">
        <button
          onClick={() => router.push('/pricing')}
          className="px-6 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
        >
          VIEW DETAILED PRICING
        </button>
      </div>
    </div>
  );
}
