'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Star, TrendingUp, Zap, Activity, ExternalLink, Lock } from 'lucide-react';
import Jazzicon from '@/components/Jazzicon';
import { createClient } from '@/lib/supabase/client';
import AuthModal from '@/components/AuthModal';

interface Oracle {
  id: string;
  name: string;
  description: string;
  type: string;
  targetToken: string;
  contractAddress: string;
  pricingModel: string;
  pricePerCall: number;
  monthlyPrice: number;
  stats: {
    average_rating: number;
    total_reviews: number;
    total_api_calls: number;
    unique_users: number;
    calls_last_24h: number;
    calls_last_7d: number;
  };
  createdAt: string;
  updateFrequency: number;
}

export default function MarketplacePage() {
  const [oracles, setOracles] = useState<Oracle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [pricingFilter, setPricingFilter] = useState<string>('');
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState('popularity');
  const [showFilters, setShowFilters] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchOracles();
  }, [typeFilter, pricingFilter, minRating, sortBy]);

  const fetchOracles = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        sortBy,
        limit: '50',
      });

      if (typeFilter) params.append('type', typeFilter);
      if (pricingFilter) params.append('pricingModel', pricingFilter);
      if (minRating > 0) params.append('minRating', minRating.toString());
      if (search) params.append('search', search);

      const response = await fetch(`/api/v1/marketplace?${params}`);
      const data = await response.json();

      if (data.success) {
        setOracles(data.oracles);
      }
    } catch (error) {
      console.error('Failed to fetch oracles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchOracles();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'price':
        return <TrendingUp size={20} className="text-blue-400" />;
      case 'farcaster':
        return <Zap size={20} className="text-purple-400" />;
      default:
        return <Activity size={20} className="text-gray-400" />;
    }
  };

  const getPricingLabel = (oracle: Oracle) => {
    switch (oracle.pricingModel) {
      case 'free':
        return <span className="text-green-400">FREE</span>;
      case 'pay_per_call':
        return <span className="text-yellow-400">${oracle.pricePerCall?.toFixed(4)}/call</span>;
      case 'subscription':
        return <span className="text-blue-400">${oracle.monthlyPrice}/month</span>;
      case 'donation':
        return <span className="text-purple-400">Donation</span>;
      default:
        return <span className="text-gray-400">Free</span>;
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

      {/* Top Nav */}
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

          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
          >
            <span className="text-sm font-bold">MY ORACLES</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-2">Discover Oracles</h2>
          <p className="text-gray-400">Browse and review decentralized data feeds on Base</p>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search oracles by name, token, or description..."
                className="w-full bg-black border border-gray-800 text-white pl-12 pr-4 py-3 outline-none focus:border-gray-600 transition-colors"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-transparent border-2 border-[rgb(255,0,110)] transition-all"
            >
              SEARCH
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-6 py-3 border-2 border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center gap-2"
            >
              <Filter size={20} />
              FILTERS
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="border border-gray-800 bg-gray-900/50 p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Type Filter */}
              <div>
                <label className="block text-sm text-gray-400 font-bold mb-2">TYPE</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-black border border-gray-800 text-white px-3 py-2 outline-none focus:border-gray-600"
                >
                  <option value="">All Types</option>
                  <option value="price">Price Feed</option>
                  <option value="farcaster">Social Data</option>
                  <option value="liquidity">Liquidity</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Pricing Filter */}
              <div>
                <label className="block text-sm text-gray-400 font-bold mb-2">PRICING</label>
                <select
                  value={pricingFilter}
                  onChange={(e) => setPricingFilter(e.target.value)}
                  className="w-full bg-black border border-gray-800 text-white px-3 py-2 outline-none focus:border-gray-600"
                >
                  <option value="">All Pricing</option>
                  <option value="free">Free</option>
                  <option value="pay_per_call">Pay Per Call</option>
                  <option value="subscription">Subscription</option>
                  <option value="donation">Donation</option>
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm text-gray-400 font-bold mb-2">MIN RATING</label>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(parseInt(e.target.value))}
                  className="w-full bg-black border border-gray-800 text-white px-3 py-2 outline-none focus:border-gray-600"
                >
                  <option value="0">Any Rating</option>
                  <option value="3">3+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="4.5">4.5+ Stars</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm text-gray-400 font-bold mb-2">SORT BY</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-black border border-gray-800 text-white px-3 py-2 outline-none focus:border-gray-600"
                >
                  <option value="popularity">Popularity</option>
                  <option value="rating">Rating</option>
                  <option value="newest">Newest</option>
                  <option value="usage">Most Used</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-gray-500">LOADING ORACLES...</div>
          </div>
        ) : oracles.length === 0 ? (
          <div className="text-center py-20 border border-gray-800">
            {/* Check if filters are applied */}
            {(search || typeFilter || pricingFilter || minRating > 0) ? (
              <>
                <p className="text-gray-500 mb-4">No oracles found matching your criteria</p>
                <button
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('');
                    setPricingFilter('');
                    setMinRating(0);
                  }}
                  className="px-6 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                >
                  CLEAR FILTERS
                </button>
              </>
            ) : (
              <>
                <Activity size={48} className="mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-bold text-white mb-2">No Oracles Yet</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Be the first to deploy an oracle on FEEDS! Create decentralized data feeds for price, social, or custom data.
                </p>
                {isAuthenticated ? (
                  <button
                    onClick={() => router.push('/create-oracle')}
                    className="px-8 py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-transparent border-2 border-[rgb(255,0,110)] transition-all"
                  >
                    CREATE ORACLE
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-8 py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-transparent border-2 border-[rgb(255,0,110)] transition-all"
                  >
                    SIGN UP TO CREATE
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {oracles.map((oracle) => (
              <div
                key={oracle.id}
                onClick={() => router.push(`/oracle/${oracle.id}`)}
                className="border border-gray-800 bg-black hover:border-gray-600 transition-all cursor-pointer p-6"
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  {oracle.contractAddress && (
                    <Jazzicon address={oracle.contractAddress} diameter={40} />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">{oracle.name || 'Unnamed Oracle'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getTypeIcon(oracle.type)}
                      <span className="text-xs text-gray-500 uppercase">{oracle.type}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {oracle.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{oracle.description}</p>
                )}

                {/* Target Token */}
                {oracle.targetToken && (
                  <div className="text-xs text-gray-500 mb-4">
                    Tracking: <span className="text-gray-300 font-mono">{oracle.targetToken}</span>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">RATING</div>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-yellow-400 fill-current" />
                      <span className="text-sm font-bold">{oracle.stats.average_rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-500">({oracle.stats.total_reviews})</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">USAGE</div>
                    <div className="text-sm font-bold">{oracle.stats.total_api_calls.toLocaleString()} calls</div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <div className="text-sm font-bold">{getPricingLabel(oracle)}</div>
                  <ExternalLink size={16} className="text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results Count */}
        {!loading && oracles.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Showing {oracles.length} oracle{oracles.length !== 1 ? 's' : ''}
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
