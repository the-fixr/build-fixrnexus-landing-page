'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TIERS = [
  {
    name: 'Free',
    price: 0,
    feedsPrice: 0,
    period: 'forever',
    description: 'Perfect for testing and POCs',
    features: [
      '10,000 API calls/month',
      '5 minute update frequency',
      'Community support',
      '1 custom oracle',
      'Basic analytics',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: 29,
    feedsPrice: 21.75,
    period: 'month',
    description: 'For small dApps and side projects',
    features: [
      '100,000 API calls/month',
      '1 minute update frequency',
      'Email support',
      '3 custom oracles',
      'Advanced analytics',
      'Usage alerts',
    ],
    cta: 'Start Building',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 99,
    feedsPrice: 74.25,
    period: 'month',
    description: 'For production applications',
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
    cta: 'Go Pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: null,
    feedsPrice: null,
    period: 'custom',
    description: 'For large-scale deployments',
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
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const OVERAGE_PRICING = [
  { calls: '10,000', price: '$5', perCall: '$0.0005' },
  { calls: '100,000', price: '$40', perCall: '$0.0004' },
  { calls: '1,000,000', price: '$330', perCall: '$0.00033' },
];

export default function PricingPage() {
  const router = useRouter();

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

      <div className="relative">
        {/* Header */}
        <div className="border-b border-gray-800 bg-black/90 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-6">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="container mx-auto px-6 py-20 text-center">
          <div className="mb-6">
            <span className="px-4 py-2 text-sm border border-[rgb(0,255,136)] bg-[rgb(0,255,136)] bg-opacity-10 text-[rgb(0,255,136)]">
              🎉 BETA ACCESS - ALL FEATURES FREE
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-4">
            Start free, scale as you grow. No hidden fees, no surprises.
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            During beta, all users get free access to Pro-tier features while we build our user base. Pricing activates Q2 2026.
          </p>
        </div>

        {/* Pricing Tiers */}
        <div className="container mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {TIERS.map((tier) => {
              const isComingSoon = tier.name !== 'Free';
              return (
              <div
                key={tier.name}
                className={`border-2 p-8 transition-all relative ${
                  tier.highlighted
                    ? 'border-[rgb(255,0,110)] bg-black/80'
                    : 'border-gray-800 bg-black/60 hover:border-gray-700'
                } ${isComingSoon ? 'opacity-60' : ''}`}
              >
                {isComingSoon && (
                  <div className="absolute top-4 right-4">
                    <span className="px-2 py-1 text-xs bg-gray-800 text-gray-500 border border-gray-700">
                      Q2 2026
                    </span>
                  </div>
                )}
                {tier.highlighted && !isComingSoon && (
                  <div className="mb-4">
                    <span className="px-3 py-1 text-xs border" style={{ backgroundColor: 'rgba(255, 0, 110, 0.1)', color: 'rgb(255, 0, 110)', borderColor: 'rgba(255, 0, 110, 0.3)' }}>
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <p className="text-sm text-gray-400 mb-6">{tier.description}</p>

                <div className="mb-6">
                  {tier.price !== null ? (
                    <>
                      <div className={isComingSoon ? 'line-through text-gray-600' : ''}>
                        <span className="text-5xl font-bold">${tier.price}</span>
                        <span className="text-gray-400">/{tier.period}</span>
                      </div>
                      {isComingSoon && (
                        <div className="mt-2 text-sm text-[rgb(0,255,136)]">
                          FREE during beta
                        </div>
                      )}
                      {tier.feedsPrice > 0 && !isComingSoon && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-500">or </span>
                          <span className="text-[rgb(255,0,110)] font-bold">${tier.feedsPrice}</span>
                          <span className="text-gray-500"> with $FEEDS</span>
                          <span className="ml-2 px-2 py-1 text-xs bg-[rgb(255,0,110)] bg-opacity-10 text-[rgb(255,0,110)] border border-[rgb(255,0,110)] border-opacity-30">
                            SAVE 25%
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-5xl font-bold">Custom</span>
                  )}
                </div>

                <button
                  onClick={() => router.push('/dashboard')}
                  className={`w-full py-3 px-6 font-bold transition-all mb-8 ${
                    tier.highlighted && !isComingSoon
                      ? 'bg-[rgb(255,0,110)] text-white hover:bg-[rgb(230,0,100)]'
                      : 'border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                  disabled={isComingSoon && tier.name === 'Enterprise'}
                >
                  {tier.name === 'Free' ? tier.cta : 'Get Beta Access'}
                </button>

                <div className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <Check
                        size={16}
                        className={tier.highlighted ? 'text-[rgb(255,0,110)]' : 'text-gray-400'}
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <span className="text-sm text-gray-300" style={{ marginLeft: '8px' }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
            })}
          </div>
        </div>

        {/* Overage Pricing */}
        <div className="container mx-auto px-6 pb-20">
          <div className="max-w-4xl mx-auto border border-gray-800 bg-black/60 p-8">
            <h2 className="text-2xl font-bold mb-4">Pay-As-You-Grow</h2>
            <p className="text-gray-400 mb-6">
              Exceeded your monthly limit? No problem. Only pay for what you use with our simple overage pricing.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 text-gray-400 font-medium">Additional Calls</th>
                    <th className="text-left py-3 text-gray-400 font-medium">Total Cost</th>
                    <th className="text-left py-3 text-gray-400 font-medium">Price per Call</th>
                  </tr>
                </thead>
                <tbody>
                  {OVERAGE_PRICING.map((row, index) => (
                    <tr key={index} className="border-b border-gray-800">
                      <td className="py-3 font-mono">{row.calls}</td>
                      <td className="py-3 font-mono">{row.price}</td>
                      <td className="py-3">
                        <span className="font-mono">{row.perCall}</span>
                        {index > 0 && (
                          <span className="ml-2 text-xs text-green-500">
                            Save {(((0.0005 - parseFloat(row.perCall.replace('$', ''))) / 0.0005) * 100).toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 border border-gray-800 bg-gray-900/50">
              <p className="text-sm text-gray-400">
                <strong className="text-white">Example:</strong> On the Starter plan ($29/month) with 150,000 API calls used:
              </p>
              <p className="text-sm text-gray-400 mt-2 font-mono">
                Subscription: $29 + Overage (50,000 × $0.0005): $25 = <span className="text-white">Total: $54</span>
              </p>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="container mx-auto px-6 pb-20">
          <div className="max-w-4xl mx-auto border border-gray-800 bg-black/60 p-8">
            <h2 className="text-2xl font-bold mb-6">How We Compare</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 text-gray-400 font-medium">Provider</th>
                    <th className="text-left py-3 text-gray-400 font-medium">Model</th>
                    <th className="text-left py-3 text-gray-400 font-medium">Price/Call</th>
                    <th className="text-left py-3 text-gray-400 font-medium">Setup</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 font-bold" style={{ color: 'rgb(255, 0, 110)' }}>FEEDS</td>
                    <td className="py-3">Subscription + Usage</td>
                    <td className="py-3 font-mono">$0.0005</td>
                    <td className="py-3 text-green-500">AI-powered</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3">Chainlink</td>
                    <td className="py-3">Credit-based</td>
                    <td className="py-3 font-mono">~$0.001</td>
                    <td className="py-3 text-gray-400">Manual</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3">API3</td>
                    <td className="py-3">Subscription</td>
                    <td className="py-3">$200+/mo</td>
                    <td className="py-3 text-gray-400">Complex</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3">Pyth</td>
                    <td className="py-3">Pull oracle</td>
                    <td className="py-3 font-mono">1 wei + gas</td>
                    <td className="py-3 text-gray-400">Manual</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-gray-800">
                <div className="text-3xl font-bold mb-2" style={{ color: 'rgb(255, 0, 110)' }}>50%</div>
                <div className="text-sm text-gray-400">Cheaper than Chainlink</div>
              </div>
              <div className="p-4 border border-gray-800">
                <div className="text-3xl font-bold mb-2" style={{ color: 'rgb(255, 0, 110)' }}>85%</div>
                <div className="text-sm text-gray-400">Less expensive than API3</div>
              </div>
              <div className="p-4 border border-gray-800">
                <div className="text-3xl font-bold mb-2" style={{ color: 'rgb(255, 0, 110)' }}>5x</div>
                <div className="text-sm text-gray-400">Faster to configure</div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="container mx-auto px-6 pb-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>

            <div className="space-y-6">
              <div className="border border-gray-800 p-6">
                <h3 className="text-lg font-bold mb-2">What payment methods do you accept?</h3>
                <p className="text-gray-400">We accept USDC and ETH on Base network. USDC is recommended for subscriptions due to price stability.</p>
              </div>

              <div className="border border-gray-800 p-6">
                <h3 className="text-lg font-bold mb-2">What happens if I exceed my monthly limit?</h3>
                <p className="text-gray-400">You'll be charged $0.0005 per additional call. We'll deduct from prepaid credits first, then bill monthly. You can set usage alerts to stay informed.</p>
              </div>

              <div className="border border-gray-800 p-6">
                <h3 className="text-lg font-bold mb-2">Can I cancel anytime?</h3>
                <p className="text-gray-400">Yes! All plans are month-to-month with no long-term commitments. Cancel anytime from your dashboard.</p>
              </div>

              <div className="border border-gray-800 p-6">
                <h3 className="text-lg font-bold mb-2">Do you offer discounts for high volume?</h3>
                <p className="text-gray-400">Yes! Enterprise plans include volume discounts. Contact sales for custom pricing at scale.</p>
              </div>

              <div className="border border-gray-800 p-6">
                <h3 className="text-lg font-bold mb-2">What's included in support?</h3>
                <p className="text-gray-400">Free tier gets community support. Starter gets email support. Pro gets priority support with SLA. Enterprise gets dedicated support with custom SLA.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="container mx-auto px-6 pb-20">
          <div className="max-w-3xl mx-auto border-2 p-12 text-center" style={{ borderColor: 'rgb(255, 0, 110)' }}>
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-gray-400 mb-8">
              Join developers building the future of decentralized oracles on Base.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-4 text-white font-bold transition-all"
              style={{ backgroundColor: 'rgb(255, 0, 110)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(230, 0, 100)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)'}
            >
              START FOR FREE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
