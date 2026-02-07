'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, AreaChart, Area, Legend
} from 'recharts';
import {
  Coins, TrendingUp, Users, Lock, Zap, ArrowUpRight,
  Clock, Shield, Layers, Activity
} from 'lucide-react';

// Contract addresses
const CONTRACTS = {
  feeSplitter: '0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928',
  staking: '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
  token: '0x8cBb89d67fDA00E26aEd0Fc02718821049b41610', // Dummy for now
};

// Accent color
const ACCENT = 'rgb(255, 0, 110)';
const ACCENT_DIM = 'rgba(255, 0, 110, 0.2)';

// Chart colors
const CHART_COLORS = [ACCENT, '#6366f1', '#22c55e', '#f59e0b', '#8b5cf6'];

export default function HubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSupply: 100_000_000_000,
    circulatingSupply: 100_000_000_000,
    totalStaked: 1_000_000,
    stakersCount: 1,
    totalFeesDistributed: 0.0011,
    stakersShare: 0.00077,
    treasuryShare: 0.00033,
    currentApy: 0,
  });

  const [tierData, setTierData] = useState([
    { name: '7 Days', multiplier: '1.0x', staked: 1_000_000, percentage: 100 },
    { name: '30 Days', multiplier: '1.25x', staked: 0, percentage: 0 },
    { name: '90 Days', multiplier: '1.5x', staked: 0, percentage: 0 },
    { name: '180 Days', multiplier: '2.0x', staked: 0, percentage: 0 },
  ]);

  const [revenueHistory, setRevenueHistory] = useState([
    { month: 'Jan', fees: 0 },
    { month: 'Feb', fees: 0.0011 },
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/hub/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalSupply: data.token.totalSupply,
          circulatingSupply: data.token.totalSupply,
          totalStaked: data.staking.totalStaked,
          stakersCount: data.staking.stakersCount,
          totalFeesDistributed: data.fees.totalDistributedToStakers,
          stakersShare: data.fees.totalDistributedToStakers * 0.7,
          treasuryShare: data.fees.totalDistributedToStakers * 0.3,
          currentApy: 0,
        });
        setTierData(data.staking.tierDistribution);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const feeDistributionData = [
    { name: 'Stakers (70%)', value: 70, color: ACCENT },
    { name: 'Treasury (30%)', value: 30, color: '#6366f1' },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toFixed(4);
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

      {/* Top Nav */}
      <nav className="relative border-b border-gray-800 bg-black/90 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img src="/feedslogotransparent.png" alt="FEEDS Logo" className="w-10 h-10" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight">FIXR</h1>
              <p className="text-xs text-gray-500 tracking-wide">TOKEN HUB</p>
            </div>
          </button>

          <div className="flex items-center gap-6">
            <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">HOME</a>
            <a href="/marketplace" className="text-sm text-gray-400 hover:text-white transition-colors">MARKETPLACE</a>
            <a
              href={`https://basescan.org/address/${CONTRACTS.staking}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white transition-all flex items-center gap-2"
            >
              <Shield size={14} />
              CONTRACTS
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 border border-gray-700 text-gray-400 text-sm mb-6">
            <Coins size={16} />
            <span className="ml-2">$FIXR TOKEN</span>
          </div>
          <h2 className="text-5xl font-bold mb-4 tracking-tight">
            FIXR.<span style={{ color: ACCENT }}>NEXUS</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Stake FIXR to earn trading fees. 70% of all Clanker fees distributed to stakers.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <StatCard
            icon={<Coins size={24} />}
            label="TOTAL SUPPLY"
            value={formatNumber(stats.totalSupply)}
            subtext="100B Fixed"
          />
          <StatCard
            icon={<Lock size={24} />}
            label="TOTAL STAKED"
            value={formatNumber(stats.totalStaked)}
            subtext={`${((stats.totalStaked / stats.totalSupply) * 100).toFixed(4)}% of supply`}
            accent
          />
          <StatCard
            icon={<Users size={24} />}
            label="STAKERS"
            value={stats.stakersCount.toString()}
            subtext="Active positions"
          />
          <StatCard
            icon={<TrendingUp size={24} />}
            label="FEES DISTRIBUTED"
            value={`${stats.totalFeesDistributed.toFixed(4)} ETH`}
            subtext="All time"
            accent
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* Fee Distribution Pie */}
          <div className="border border-gray-800 bg-black p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Layers size={20} className="text-gray-400" />
                <h3 className="text-lg font-bold">FEE DISTRIBUTION</h3>
              </div>
              <span className="text-xs text-gray-600">PER DISTRIBUTION</span>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feeDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {feeDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111',
                      border: '1px solid #333',
                      borderRadius: 0,
                      fontFamily: 'monospace'
                    }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-gray-400 text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-800">
              <div>
                <p className="text-xs text-gray-600 mb-1">STAKERS RECEIVE</p>
                <p className="text-2xl font-bold" style={{ color: ACCENT }}>
                  {stats.stakersShare.toFixed(5)} ETH
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">TREASURY RECEIVES</p>
                <p className="text-2xl font-bold text-indigo-400">
                  {stats.treasuryShare.toFixed(5)} ETH
                </p>
              </div>
            </div>
          </div>

          {/* Lock Tier Distribution */}
          <div className="border border-gray-800 bg-black p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Clock size={20} className="text-gray-400" />
                <h3 className="text-lg font-bold">LOCK TIERS</h3>
              </div>
              <span className="text-xs text-gray-600">STAKE DISTRIBUTION</span>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111',
                      border: '1px solid #333',
                      borderRadius: 0,
                      fontFamily: 'monospace'
                    }}
                    formatter={(value) => [formatNumber(value as number), 'Staked']}
                  />
                  <Bar dataKey="staked" fill={ACCENT} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-6 pt-6 border-t border-gray-800">
              {tierData.map((tier, i) => (
                <div key={i} className="text-center">
                  <p className="text-xs text-gray-600 mb-1">{tier.name.toUpperCase()}</p>
                  <p className="text-sm font-bold" style={{ color: i === 0 ? ACCENT : '#6b7280' }}>
                    {tier.multiplier}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue History */}
        <div className="border border-gray-800 bg-black p-6 mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity size={20} className="text-gray-400" />
              <h3 className="text-lg font-bold">FEE REVENUE HISTORY</h3>
            </div>
            <span className="text-xs text-gray-600">MONTHLY ETH</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#333' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value} ETH`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111',
                    border: '1px solid #333',
                    borderRadius: 0,
                    fontFamily: 'monospace'
                  }}
                  formatter={(value) => [`${(value as number).toFixed(4)} ETH`, 'Fees']}
                />
                <Area
                  type="monotone"
                  dataKey="fees"
                  stroke={ACCENT}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorFees)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Access Tiers */}
        <div className="border border-gray-800 bg-black p-6 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Zap size={20} style={{ color: ACCENT }} />
            <h3 className="text-lg font-bold">ACCESS TIERS</h3>
            <span className="text-xs text-gray-600 ml-auto">STAKE TO UNLOCK</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TierCard
              name="FREE"
              requirement="0 FIXR"
              benefits={['Basic API access', 'Standard rate limits', 'Community support']}
            />
            <TierCard
              name="BUILDER"
              requirement="1M+ FIXR"
              benefits={['2x API rate limits', 'Basic analytics', 'Email support']}
              highlight
            />
            <TierCard
              name="PRO"
              requirement="10M+ FIXR"
              benefits={['5x API rate limits', 'Premium dashboard', 'Priority support']}
            />
            <TierCard
              name="ELITE"
              requirement="50M+ FIXR"
              benefits={['Unlimited API', 'Early access', 'Dedicated support']}
              elite
            />
          </div>
        </div>

        {/* Contract Links */}
        <div className="border border-gray-800 bg-black p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield size={20} className="text-gray-400" />
            <h3 className="text-lg font-bold">VERIFIED CONTRACTS</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ContractLink
              name="FIXR Token"
              address={CONTRACTS.token}
              label="ERC20"
            />
            <ContractLink
              name="Staking Contract"
              address={CONTRACTS.staking}
              label="STAKING"
            />
            <ContractLink
              name="Fee Splitter"
              address={CONTRACTS.feeSplitter}
              label="SPLITTER"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center text-sm text-gray-600">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }}></div>
            <span className="ml-2">LIVE ON BASE</span>
          </div>
          <div className="flex items-center ml-8">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="ml-2">CONTRACTS VERIFIED</span>
          </div>
        </div>
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  subtext,
  accent = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  accent?: boolean;
}) {
  return (
    <div
      className="border bg-black p-6 transition-all hover:border-gray-600"
      style={{ borderColor: accent ? ACCENT : '#1f2937' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="text-gray-400">{icon}</div>
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <p
        className="text-3xl font-bold mb-1"
        style={{ color: accent ? ACCENT : 'white' }}
      >
        {value}
      </p>
      <p className="text-xs text-gray-600">{subtext}</p>
    </div>
  );
}

// Tier Card Component
function TierCard({
  name,
  requirement,
  benefits,
  highlight = false,
  elite = false
}: {
  name: string;
  requirement: string;
  benefits: string[];
  highlight?: boolean;
  elite?: boolean;
}) {
  return (
    <div
      className="border bg-black p-5 transition-all"
      style={{
        borderColor: elite ? '#f59e0b' : highlight ? ACCENT : '#1f2937',
        background: elite ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, transparent 100%)' :
                   highlight ? `linear-gradient(135deg, ${ACCENT_DIM} 0%, transparent 100%)` : undefined
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-sm font-bold"
          style={{ color: elite ? '#f59e0b' : highlight ? ACCENT : 'white' }}
        >
          {name}
        </span>
        {elite && <span className="text-xs text-amber-500">⭐</span>}
      </div>
      <p className="text-xs text-gray-500 mb-4">{requirement}</p>
      <ul className="space-y-2">
        {benefits.map((benefit, i) => (
          <li key={i} className="text-xs text-gray-400 flex items-center gap-2">
            <div
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: elite ? '#f59e0b' : highlight ? ACCENT : '#6b7280' }}
            />
            {benefit}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Contract Link Component
function ContractLink({
  name,
  address,
  label
}: {
  name: string;
  address: string;
  label: string;
}) {
  return (
    <a
      href={`https://basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-4 border border-gray-800 hover:border-gray-600 transition-all group"
    >
      <div>
        <p className="text-sm font-bold text-white mb-1">{name}</p>
        <p className="text-xs text-gray-600 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-1 border border-gray-800 text-gray-500">{label}</span>
        <ArrowUpRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
      </div>
    </a>
  );
}
