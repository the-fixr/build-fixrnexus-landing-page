'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, AreaChart, Area, Legend
} from 'recharts';

// Contract addresses
const CONTRACTS = {
  feeSplitter: '0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928',
  staking: '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
  token: '0x8cBb89d67fDA00E26aEd0Fc02718821049b41610',
};

export default function HubPage() {
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

  const [revenueHistory] = useState([
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
    { name: 'Stakers (70%)', value: 70, color: '#ec4899' },
    { name: 'Treasury (30%)', value: 30, color: '#a855f7' },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toFixed(4);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4">$FIXR</h1>
          <p className="text-xl text-gray-400 mb-6">
            Stake FIXR to earn trading fees. 70% of all Clanker fees distributed to stakers.
          </p>
          <div className="flex justify-center gap-6">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              Home
            </Link>
            <a
              href={`https://basescan.org/address/${CONTRACTS.staking}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-500 hover:text-pink-400 transition-colors font-bold"
            >
              View Contracts
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <StatCard label="Total Supply" value={formatNumber(stats.totalSupply)} />
          <StatCard label="Total Staked" value={formatNumber(stats.totalStaked)} color="text-pink-500" />
          <StatCard label="Stakers" value={stats.stakersCount.toString()} />
          <StatCard label="Fees Distributed" value={`${stats.totalFeesDistributed.toFixed(4)} ETH`} color="text-green-400" />
        </div>

        {/* Fee Distribution */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">Fee Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feeDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {feeDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-gray-400 text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Stakers Receive</p>
                <p className="text-2xl font-bold text-pink-500">{stats.stakersShare.toFixed(5)} ETH</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Treasury Receives</p>
                <p className="text-2xl font-bold text-purple-400">{stats.treasuryShare.toFixed(5)} ETH</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lock Tiers */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">Lock Tiers</h2>
          <div className="h-48 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={70}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [formatNumber(value as number), 'Staked']}
                />
                <Bar dataKey="staked" fill="#ec4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tierData.map((tier, i) => (
              <div key={i} className="text-center bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{tier.name}</p>
                <p className={`text-sm font-bold ${i === 0 ? 'text-pink-500' : 'text-gray-400'}`}>
                  {tier.multiplier}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue History */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">Fee Revenue History</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value} ETH`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${(value as number).toFixed(4)} ETH`, 'Fees']}
                />
                <Area
                  type="monotone"
                  dataKey="fees"
                  stroke="#ec4899"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorFees)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Access Tiers */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">Access Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TierCard
              name="Free"
              requirement="0 FIXR"
              benefits={['Basic API access', 'Standard rate limits', 'Community support']}
            />
            <TierCard
              name="Builder"
              requirement="1M+ FIXR"
              benefits={['2x API rate limits', 'Basic analytics', 'Email support']}
              highlight
            />
            <TierCard
              name="Pro"
              requirement="10M+ FIXR"
              benefits={['5x API rate limits', 'Premium dashboard', 'Priority support']}
            />
            <TierCard
              name="Elite"
              requirement="50M+ FIXR"
              benefits={['Unlimited API', 'Early access', 'Dedicated support']}
              elite
            />
          </div>
        </div>

        {/* Contracts */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Verified Contracts</h2>
          <div className="space-y-3">
            <ContractLink name="FIXR Token" address={CONTRACTS.token} />
            <ContractLink name="Staking Contract" address={CONTRACTS.staking} />
            <ContractLink name="Fee Splitter" address={CONTRACTS.feeSplitter} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-600 text-sm">
          <div className="flex items-center justify-center gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
              Live on Base
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Contracts Verified
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  );
}

function TierCard({
  name,
  requirement,
  benefits,
  highlight = false,
  elite = false,
}: {
  name: string;
  requirement: string;
  benefits: string[];
  highlight?: boolean;
  elite?: boolean;
}) {
  const borderColor = elite ? 'border-yellow-500' : highlight ? 'border-pink-500' : 'border-gray-800';
  const nameColor = elite ? 'text-yellow-500' : highlight ? 'text-pink-500' : 'text-white';

  return (
    <div className={`bg-gray-800/50 border ${borderColor} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-bold ${nameColor}`}>{name}</span>
        {elite && <span className="text-yellow-500">⭐</span>}
      </div>
      <p className="text-xs text-gray-500 mb-3">{requirement}</p>
      <ul className="space-y-1">
        {benefits.map((benefit, i) => (
          <li key={i} className="text-xs text-gray-400 flex items-center gap-2">
            <span className={`w-1 h-1 rounded-full ${elite ? 'bg-yellow-500' : highlight ? 'bg-pink-500' : 'bg-gray-600'}`}></span>
            {benefit}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContractLink({ name, address }: { name: string; address: string }) {
  return (
    <a
      href={`https://basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
    >
      <div>
        <p className="font-medium text-white">{name}</p>
        <p className="text-xs text-gray-500 font-mono">{address.slice(0, 6)}...{address.slice(-4)}</p>
      </div>
      <span className="text-gray-400">→</span>
    </a>
  );
}
