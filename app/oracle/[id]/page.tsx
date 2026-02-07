'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ExternalLink, Activity, Clock, Shield, Star, MessageSquare, TrendingUp } from 'lucide-react';
import Jazzicon from '@/components/Jazzicon';
import StarRating from '@/components/StarRating';

interface Oracle {
  id: string;
  name: string;
  description: string;
  oracle_type: string;
  target_token: string;
  contract_address: string;
  pricing_model: string;
  price_per_call: number;
  monthly_price: number;
  update_frequency: number;
  consensus_threshold: number;
  created_at: string;
  user_id: string;
  is_hidden: boolean;
}

interface Review {
  id: string;
  rating: number;
  title: string;
  review_text: string;
  verified_user: boolean;
  helpful_count: number;
  created_at: string;
  profiles: {
    username: string;
  };
}

export default function OracleDetailPage() {
  const [oracle, setOracle] = useState<Oracle | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    review_text: '',
  });

  const router = useRouter();
  const params = useParams();
  const oracleId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    loadOracle();
    loadReviews();
  }, [oracleId]);

  const loadOracle = async () => {
    try {
      setLoading(true);

      // Load oracle details
      const { data: oracleData } = await supabase
        .from('oracles')
        .select('*, oracle_stats(*)')
        .eq('id', oracleId)
        .single();

      if (oracleData) {
        setOracle(oracleData);
        setStats(oracleData.oracle_stats?.[0]);
      }
    } catch (error) {
      console.error('Failed to load oracle:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await fetch(`/api/v1/reviews/${oracleId}?limit=20&sortBy=helpful`);
      const data = await response.json();

      if (data.success) {
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const handleSubmitReview = async () => {
    try {
      if (!newReview.title || !newReview.review_text) {
        alert('Please fill in all fields');
        return;
      }

      const response = await fetch(`/api/v1/reviews/${oracleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReview),
      });

      const data = await response.json();

      if (data.success) {
        setShowReviewForm(false);
        setNewReview({ rating: 5, title: '', review_text: '' });
        loadReviews();
        loadOracle();
      } else {
        alert(data.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert('Failed to submit review');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="text-gray-500">LOADING...</div>
      </div>
    );
  }

  if (!oracle) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Oracle not found</p>
          <button
            onClick={() => router.push('/marketplace')}
            className="px-6 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
          >
            BACK TO MARKETPLACE
          </button>
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

      {/* Top Nav */}
      <nav className="relative border-b border-gray-800 bg-black/90 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-6">
          <button
            onClick={() => router.push('/marketplace')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-bold">BACK TO MARKETPLACE</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-12 max-w-6xl">
        {/* Retired Oracle Warning */}
        {oracle.is_hidden && (
          <div className="border-2 border-yellow-500/50 bg-yellow-500/10 p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-yellow-500 flex-shrink-0">⚠️</div>
              <div>
                <h3 className="text-lg font-bold text-yellow-400 mb-2">RETIRED ORACLE</h3>
                <p className="text-sm text-gray-300">
                  This oracle has been retired by its creator and is no longer actively maintained.
                  The oracle may still be functional, but future updates and support are not guaranteed.
                  Use at your own risk.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Oracle Header */}
        <div className="border border-gray-800 bg-black p-8 mb-8">
          <div className="flex items-start gap-6 mb-6">
            {oracle.contract_address && (
              <Jazzicon address={oracle.contract_address} diameter={80} />
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{oracle.name || 'Unnamed Oracle'}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                <span className="uppercase">{oracle.oracle_type} Oracle</span>
                {oracle.target_token && (
                  <>
                    <span>•</span>
                    <span>Tracking: {oracle.target_token}</span>
                  </>
                )}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-4 mb-4">
                <StarRating
                  rating={stats?.average_rating || 0}
                  readonly
                  size={24}
                  showCount={stats?.total_reviews || 0}
                />
                <span className="text-2xl font-bold">{(stats?.average_rating || 0).toFixed(1)}</span>
              </div>

              {oracle.description && (
                <p className="text-gray-300">{oracle.description}</p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-800">
            <div>
              <div className="text-xs text-gray-500 mb-1">TOTAL USAGE</div>
              <div className="text-lg font-bold flex items-center gap-2">
                <Activity size={16} className="text-blue-400" />
                {(stats?.total_api_calls || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">UPDATE FREQ</div>
              <div className="text-lg font-bold flex items-center gap-2">
                <Clock size={16} className="text-green-400" />
                {Math.floor(oracle.update_frequency / 60)}m
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">CONSENSUS</div>
              <div className="text-lg font-bold flex items-center gap-2">
                <Shield size={16} className="text-yellow-400" />
                {oracle.consensus_threshold}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">PRICING</div>
              <div className="text-lg font-bold text-green-400">
                {oracle.pricing_model === 'free' ? 'FREE' : `$${oracle.price_per_call || oracle.monthly_price}`}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => router.push(`/api-studio?endpoint=/api/v1/oracle/${oracle.contract_address}&address=${oracle.contract_address}`)}
              className="px-6 py-3 bg-[rgb(255,0,110)] text-white font-bold hover:bg-transparent border-2 border-[rgb(255,0,110)] transition-all"
            >
              TRY IN API STUDIO
            </button>
            <a
              href={`https://basescan.org/address/${oracle.contract_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border-2 border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center gap-2"
            >
              VIEW ON BASESCAN
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

        {/* Reviews Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare size={24} />
              Reviews ({reviews.length})
            </h2>
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="px-6 py-2 border-2 border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all font-bold"
            >
              WRITE A REVIEW
            </button>
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="border border-gray-800 bg-gray-900/50 p-6 mb-6">
              <h3 className="text-lg font-bold mb-4">Write Your Review</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">RATING</label>
                  <StarRating
                    rating={newReview.rating}
                    onChange={(rating) => setNewReview({ ...newReview, rating })}
                    size={32}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">TITLE</label>
                  <input
                    type="text"
                    value={newReview.title}
                    onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                    placeholder="Sum up your experience in one line"
                    className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">REVIEW</label>
                  <textarea
                    value={newReview.review_text}
                    onChange={(e) => setNewReview({ ...newReview, review_text: e.target.value })}
                    placeholder="Share your experience with this oracle..."
                    rows={5}
                    className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleSubmitReview}
                    className="px-6 py-2 bg-[rgb(255,0,110)] text-white font-bold hover:bg-transparent border-2 border-[rgb(255,0,110)] transition-all"
                  >
                    SUBMIT REVIEW
                  </button>
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="px-6 py-2 border-2 border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review List */}
          {reviews.length === 0 ? (
            <div className="border border-gray-800 p-12 text-center">
              <p className="text-gray-500">No reviews yet. Be the first to review this oracle!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-800 bg-black p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <StarRating rating={review.rating} readonly size={16} />
                        {review.verified_user && (
                          <span className="px-2 py-1 text-xs border border-green-500 text-green-400">
                            VERIFIED USER
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold">{review.title}</h3>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <p className="text-gray-300 mb-4">{review.review_text}</p>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      by {review.profiles?.username || 'Anonymous'}
                    </span>
                    <button className="text-gray-400 hover:text-white flex items-center gap-1">
                      <TrendingUp size={14} />
                      Helpful ({review.helpful_count})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
