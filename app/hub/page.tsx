'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, AreaChart, Area, Legend
} from 'recharts';
import {
  Coins, TrendingUp, Users, Lock, Zap, ArrowUpRight, ArrowDownRight,
  Clock, Shield, Layers, Activity, Wallet, Gift, RefreshCw, ExternalLink,
  ChevronDown, Check, AlertCircle
} from 'lucide-react';

const ACCENT = 'rgb(255, 0, 110)';
const ACCENT_DIM = 'rgba(255, 0, 110, 0.2)';
const CHART_COLORS = [ACCENT, '#6366f1', '#22c55e', '#f59e0b', '#8b5cf6'];

interface TokenConfig {
  id: string;
  name: string;
  symbol: string;
  token: string;
  staking: string;
  feeSplitter: string;
  description: string;
  tiers: { name: string; multiplier: string; duration: string }[];
  stakersShare: number;
  treasuryShare: number;
  apiEndpoint: string;
}

const TOKENS: TokenConfig[] = [
  {
    id: 'clawg',
    name: 'CLAWG',
    symbol: '$CLAWG',
    token: '0x06A127f0b53F83dD5d94E83D96B55a279705bB07',
    staking: '0xD8eDe592Ed90A9D56aebE321B1d2a4E3201b4c11',
    feeSplitter: '0x0eA046F39EBC7316B418bfcf0962590927B8ecB4',
    description: 'Powering clawg.network infrastructure',
    stakersShare: 70,
    treasuryShare: 30,
    tiers: [
      { name: '1 Day', multiplier: '0.5x', duration: '1d' },
      { name: '7 Days', multiplier: '1.0x', duration: '7d' },
      { name: '30 Days', multiplier: '1.15x', duration: '30d' },
      { name: '60 Days', multiplier: '1.35x', duration: '60d' },
      { name: '90 Days', multiplier: '1.5x', duration: '90d' },
      { name: '180 Days', multiplier: '2.0x', duration: '180d' },
      { name: '365 Days', multiplier: '3.0x', duration: '365d' },
    ],
    apiEndpoint: '/api/hub/clawg/stats',
  },
  {
    id: 'fixr',
    name: 'FIXR',
    symbol: '$FIXR',
    token: '0x8cBb89d67fDA00E26aEd0Fc02718821049b41610',
    staking: '0x39DbBa2CdAF7F668816957B023cbee1841373F5b',
    feeSplitter: '0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928',
    description: 'FEEDS oracle network governance token',
    stakersShare: 70,
    treasuryShare: 30,
    tiers: [
      { name: '7 Days', multiplier: '1.0x', duration: '7d' },
      { name: '30 Days', multiplier: '1.25x', duration: '30d' },
      { name: '90 Days', multiplier: '1.5x', duration: '90d' },
      { name: '180 Days', multiplier: '2.0x', duration: '180d' },
    ],
    apiEndpoint: '/api/hub/stats',
  },
];

interface StakePosition {
  id: number;
  amount: number;
  weightedAmount: number;
  lockTier: number;
  tierName: string;
  stakedAt: number;
  unlockAt: number;
  isUnlocked: boolean;
}

interface UserData {
  address: string;
  positions: StakePosition[];
  totalStaked: number;
  weightedStake: number;
  pendingRewards: { weth: number; clawg: number };
  earliestClaimTime: number;
  canClaim: boolean;
  tokenBalance: number;
}

interface TokenStats {
  totalSupply: number;
  totalStaked: number;
  totalWeightedStake: number;
  pendingFees: { weth: number };
  accumulatedRewards: { weth: number };
}

export default function HubPage() {
  const router = useRouter();
  const [activeToken, setActiveToken] = useState<string>('clawg');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TokenStats>({
    totalSupply: 0,
    totalStaked: 0,
    totalWeightedStake: 0,
    pendingFees: { weth: 0 },
    accumulatedRewards: { weth: 0 },
  });
  const [userData, setUserData] = useState<UserData | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const currentToken = TOKENS.find(t => t.id === activeToken) || TOKENS[0];

  const fetchStats = useCallback(async () => {
    try {
      setRefreshing(true);
      const endpoint = currentToken.id === 'clawg'
        ? `/api/hub/clawg/stats${walletAddress ? `?user=${walletAddress}` : ''}`
        : '/api/hub/stats';

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();

        if (currentToken.id === 'clawg') {
          setStats({
            totalSupply: data.token?.totalSupply || 0,
            totalStaked: data.staking?.totalStaked || 0,
            totalWeightedStake: data.staking?.totalWeightedStake || 0,
            pendingFees: { weth: data.feeSplitter?.pending?.weth || 0 },
            accumulatedRewards: { weth: data.staking?.accumulatedRewards?.weth || 0 },
          });
          if (data.user) {
            setUserData(data.user);
          }
        } else {
          setStats({
            totalSupply: data.token?.totalSupply || 100_000_000_000,
            totalStaked: data.staking?.totalStaked || 0,
            totalWeightedStake: data.staking?.totalWeightedStake || 0,
            pendingFees: { weth: data.fees?.pendingDistribution || 0 },
            accumulatedRewards: { weth: data.fees?.totalDistributedToStakers || 0 },
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentToken, walletAddress]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    checkWallet();
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { on: (event: string, handler: () => void) => void } }).ethereum) {
      const ethereum = (window as unknown as { ethereum: { on: (event: string, handler: () => void) => void } }).ethereum;
      ethereum.on('accountsChanged', checkWallet);
    }
  }, []);

  const checkWallet = async () => {
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
      try {
        const ethereum = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
        }
      } catch (e) {
        console.error('Wallet check failed:', e);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
      try {
        const ethereum = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
          fetchStats();
        }
      } catch (e) {
        console.error('Wallet connect failed:', e);
      }
    }
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(decimals) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(decimals) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(decimals) + 'K';
    if (num < 0.0001 && num > 0) return num.toExponential(2);
    return num.toFixed(decimals);
  };

  const formatEth = (num: number) => {
    if (num < 0.0001 && num > 0) return '<0.0001';
    return num.toFixed(4);
  };

  const formatTimeRemaining = (unlockAt: number) => {
    const now = Date.now();
    if (now >= unlockAt) return 'Unlocked';
    const diff = unlockAt - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const feeDistributionData = [
    { name: `Stakers (${currentToken.stakersShare}%)`, value: currentToken.stakersShare, color: ACCENT },
    { name: `Treasury (${currentToken.treasuryShare}%)`, value: currentToken.treasuryShare, color: '#6366f1' },
  ];

  const tierChartData = currentToken.tiers.map((tier, i) => ({
    name: tier.name,
    multiplier: parseFloat(tier.multiplier),
    fill: i === selectedTier ? ACCENT : '#374151',
  }));

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: '#000000',
          backgroundImage: 'linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <nav className="relative border-b border-gray-800 bg-black/90 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img src="/feedslogotransparent.png" alt="FEEDS Logo" className="w-10 h-10" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight">TOKEN HUB</h1>
              <p className="text-xs text-gray-500 tracking-wide">STAKE & EARN</p>
            </div>
          </button>

          <div className="flex items-center gap-6">
            <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">HOME</a>
            <a href="/marketplace" className="text-sm text-gray-400 hover:text-white transition-colors">MARKETPLACE</a>

            {walletConnected ? (
              <div className="flex items-center gap-3 px-4 py-2 border border-gray-800">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
                <span className="text-sm text-gray-400">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 border transition-all flex items-center gap-2"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                <Wallet size={14} />
                CONNECT
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="relative container mx-auto px-6 py-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          {TOKENS.map((token) => (
            <button
              key={token.id}
              onClick={() => {
                setActiveToken(token.id);
                setLoading(true);
              }}
              className={`px-6 py-3 border-2 transition-all font-bold ${
                activeToken === token.id
                  ? 'text-white'
                  : 'border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
              style={{
                borderColor: activeToken === token.id ? ACCENT : undefined,
                backgroundColor: activeToken === token.id ? ACCENT_DIM : undefined,
              }}
            >
              {token.symbol}
            </button>
          ))}
        </div>

        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4 tracking-tight">
            {currentToken.symbol}.<span style={{ color: ACCENT }}>NEXUS</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {currentToken.description}. Stake to earn {currentToken.stakersShare}% of all trading fees.
          </p>
          <button
            onClick={() => fetchStats()}
            disabled={refreshing}
            className="mt-4 px-3 py-1 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 transition-all text-sm flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            REFRESH
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <StatCard
            icon={<Coins size={24} />}
            label="TOTAL SUPPLY"
            value={formatNumber(stats.totalSupply)}
            subtext="Fixed supply"
            loading={loading}
          />
          <StatCard
            icon={<Lock size={24} />}
            label="TOTAL STAKED"
            value={formatNumber(stats.totalStaked)}
            subtext={stats.totalSupply > 0 ? `${((stats.totalStaked / stats.totalSupply) * 100).toFixed(4)}% of supply` : '—'}
            accent
            loading={loading}
          />
          <StatCard
            icon={<TrendingUp size={24} />}
            label="WEIGHTED STAKE"
            value={formatNumber(stats.totalWeightedStake)}
            subtext="Lock bonus applied"
            loading={loading}
          />
          <StatCard
            icon={<Gift size={24} />}
            label="PENDING FEES"
            value={`${formatEth(stats.pendingFees.weth)} ETH`}
            subtext="Ready to distribute"
            accent
            loading={loading}
          />
        </div>

        {walletConnected && userData && (
          <div className="border border-gray-800 bg-black p-6 mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Wallet size={20} style={{ color: ACCENT }} />
                <h3 className="text-lg font-bold">YOUR POSITIONS</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-600">PENDING REWARDS</p>
                  <p className="text-lg font-bold" style={{ color: ACCENT }}>
                    {formatEth(userData.pendingRewards.weth)} WETH
                  </p>
                </div>
                <button
                  onClick={() => {}}
                  disabled={!userData.canClaim || userData.pendingRewards.weth === 0}
                  className={`px-4 py-2 border font-bold transition-all ${
                    userData.canClaim && userData.pendingRewards.weth > 0
                      ? 'hover:bg-white hover:text-black'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  CLAIM REWARDS
                </button>
              </div>
            </div>

            {userData.positions.length > 0 ? (
              <div className="space-y-3">
                {userData.positions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between p-4 border border-gray-800 hover:border-gray-700 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 border border-gray-700 flex items-center justify-center">
                        <Lock size={16} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="font-bold">{formatNumber(pos.amount)} {currentToken.symbol.replace('$', '')}</p>
                        <p className="text-xs text-gray-600">{pos.tierName} lock</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Weighted</p>
                        <p className="font-bold">{formatNumber(pos.weightedAmount)}</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-sm text-gray-400">Time Left</p>
                        <p className={`font-bold ${pos.isUnlocked ? 'text-green-500' : ''}`}>
                          {formatTimeRemaining(pos.unlockAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => {}}
                        disabled={!pos.isUnlocked}
                        className={`px-4 py-2 border text-sm transition-all ${
                          pos.isUnlocked
                            ? 'border-green-500 text-green-500 hover:bg-green-500 hover:text-black'
                            : 'border-gray-700 text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        UNSTAKE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <Lock size={32} className="mx-auto mb-3 opacity-50" />
                <p>No active stake positions</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <div className="border border-gray-800 bg-black p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap size={20} style={{ color: ACCENT }} />
              <h3 className="text-lg font-bold">STAKE {currentToken.symbol}</h3>
            </div>

            {!walletConnected ? (
              <div className="text-center py-12">
                <Wallet size={40} className="mx-auto mb-4 text-gray-600" />
                <p className="text-gray-500 mb-4">Connect wallet to stake</p>
                <button
                  onClick={connectWallet}
                  className="px-6 py-3 border font-bold transition-all hover:bg-white hover:text-black"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  CONNECT WALLET
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-gray-600 mb-2 block">AMOUNT</label>
                  <div className="flex items-center border border-gray-800 focus-within:border-gray-600 transition-all">
                    <input
                      type="text"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      className="flex-1 bg-transparent px-4 py-3 outline-none text-lg"
                    />
                    <span className="px-4 text-gray-500">{currentToken.symbol.replace('$', '')}</span>
                    <button
                      onClick={() => userData && setStakeAmount(userData.tokenBalance.toString())}
                      className="px-3 py-1 mr-2 border border-gray-700 text-xs text-gray-500 hover:text-white hover:border-gray-500 transition-all"
                    >
                      MAX
                    </button>
                  </div>
                  {userData && (
                    <p className="text-xs text-gray-600 mt-1">
                      Balance: {formatNumber(userData.tokenBalance)} {currentToken.symbol.replace('$', '')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-600 mb-2 block">LOCK PERIOD</label>
                  <div className="relative">
                    <button
                      onClick={() => setTierDropdownOpen(!tierDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 border border-gray-800 hover:border-gray-600 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Clock size={16} className="text-gray-500" />
                        <span>{currentToken.tiers[selectedTier]?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ color: ACCENT }}>{currentToken.tiers[selectedTier]?.multiplier}</span>
                        <ChevronDown size={16} className={`text-gray-500 transition-transform ${tierDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {tierDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 border border-gray-800 bg-black z-10">
                        {currentToken.tiers.map((tier, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setSelectedTier(i);
                              setTierDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-900 transition-all ${
                              selectedTier === i ? 'bg-gray-900' : ''
                            }`}
                          >
                            <span>{tier.name}</span>
                            <div className="flex items-center gap-3">
                              <span style={{ color: ACCENT }}>{tier.multiplier}</span>
                              {selectedTier === i && <Check size={14} style={{ color: ACCENT }} />}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border border-gray-800 bg-gray-900/30">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">You stake</span>
                    <span>{stakeAmount || '0'} {currentToken.symbol.replace('$', '')}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Lock period</span>
                    <span>{currentToken.tiers[selectedTier]?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Weighted stake</span>
                    <span style={{ color: ACCENT }}>
                      {((parseFloat(stakeAmount) || 0) * parseFloat(currentToken.tiers[selectedTier]?.multiplier || '1')).toFixed(2)} {currentToken.symbol.replace('$', '')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {}}
                  disabled={!stakeAmount || parseFloat(stakeAmount) === 0}
                  className={`w-full py-4 border-2 font-bold transition-all ${
                    stakeAmount && parseFloat(stakeAmount) > 0
                      ? 'hover:bg-white hover:text-black'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  STAKE {currentToken.symbol}
                </button>
              </div>
            )}
          </div>

          <div className="border border-gray-800 bg-black p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Layers size={20} className="text-gray-400" />
                <h3 className="text-lg font-bold">FEE DISTRIBUTION</h3>
              </div>
              <span className="text-xs text-gray-600">PER DISTRIBUTION</span>
            </div>

            <div className="h-48">
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

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
              <div>
                <p className="text-xs text-gray-600 mb-1">STAKERS RECEIVE</p>
                <p className="text-xl font-bold" style={{ color: ACCENT }}>
                  {currentToken.stakersShare}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">TREASURY RECEIVES</p>
                <p className="text-xl font-bold text-indigo-400">
                  {currentToken.treasuryShare}%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-gray-800 bg-black p-6 mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-gray-400" />
              <h3 className="text-lg font-bold">LOCK TIERS & MULTIPLIERS</h3>
            </div>
            <span className="text-xs text-gray-600">LONGER LOCK = HIGHER REWARDS</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {currentToken.tiers.map((tier, i) => (
              <div
                key={i}
                onClick={() => setSelectedTier(i)}
                className={`p-4 border cursor-pointer transition-all ${
                  selectedTier === i
                    ? 'border-2'
                    : 'border-gray-800 hover:border-gray-600'
                }`}
                style={{
                  borderColor: selectedTier === i ? ACCENT : undefined,
                  backgroundColor: selectedTier === i ? ACCENT_DIM : undefined,
                }}
              >
                <p className="text-xs text-gray-500 mb-1">{tier.name.toUpperCase()}</p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: selectedTier === i ? ACCENT : 'white' }}
                >
                  {tier.multiplier}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 border border-gray-800 bg-gray-900/30">
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="text-gray-500 mt-0.5" />
              <div className="text-sm text-gray-500">
                <p className="mb-1">Longer lock periods earn higher weighted stake and greater share of fee distributions.</p>
                <p>Example: 100 {currentToken.symbol.replace('$', '')} staked for {currentToken.tiers[currentToken.tiers.length - 1]?.name} = {(100 * parseFloat(currentToken.tiers[currentToken.tiers.length - 1]?.multiplier || '1')).toFixed(0)} weighted stake.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-gray-800 bg-black p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield size={20} className="text-gray-400" />
            <h3 className="text-lg font-bold">VERIFIED CONTRACTS</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ContractLink
              name={`${currentToken.symbol.replace('$', '')} Token`}
              address={currentToken.token}
              label="ERC20"
            />
            <ContractLink
              name="Staking Contract"
              address={currentToken.staking}
              label="STAKING"
            />
            <ContractLink
              name="Fee Splitter"
              address={currentToken.feeSplitter}
              label="SPLITTER"
            />
          </div>
        </div>

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

function StatCard({
  icon,
  label,
  value,
  subtext,
  accent = false,
  loading = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  accent?: boolean;
  loading?: boolean;
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
      {loading ? (
        <div className="h-9 w-24 bg-gray-800 animate-pulse rounded"></div>
      ) : (
        <p
          className="text-3xl font-bold mb-1"
          style={{ color: accent ? ACCENT : 'white' }}
        >
          {value}
        </p>
      )}
      <p className="text-xs text-gray-600">{subtext}</p>
    </div>
  );
}

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
