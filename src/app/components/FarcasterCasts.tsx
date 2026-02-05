'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HeartIcon, ArrowPathRoundedSquareIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

interface Cast {
  hash: string;
  text: string;
  type: string;
  postedAt: string;
  likes: number;
  recasts: number;
  replies: number;
  channel?: string;
}

interface FarcasterCastsProps {
  casts?: Cast[];
  limit?: number;
  className?: string;
}

export function FarcasterCasts({
  casts: propCasts,
  limit = 10,
  className = ''
}: FarcasterCastsProps) {
  const [casts, setCasts] = useState<Cast[]>(propCasts || []);
  const [loading, setLoading] = useState(!propCasts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propCasts) return;

    const fetchCasts = async () => {
      try {
        const res = await fetch('/api/casts');
        const data = await res.json();
        if (data.success && data.casts) {
          setCasts(data.casts.slice(0, limit));
        }
      } catch (err) {
        console.error('Failed to fetch casts:', err);
        setError('Failed to load casts');
      } finally {
        setLoading(false);
      }
    };

    fetchCasts();
  }, [propCasts, limit]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900/50 rounded-xl p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-800 rounded w-3/4 mb-3" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error || casts.length === 0) {
    return (
      <div className={`bg-gray-900/50 rounded-xl p-6 text-center ${className}`}>
        <p className="text-gray-500">{error || 'No casts yet'}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {casts.map((cast, idx) => (
        <motion.a
          key={cast.hash}
          href={`https://warpcast.com/fixr/${cast.hash.slice(0, 10)}`}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="block bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-purple-500/50 hover:bg-gray-900/70 transition-all group"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
              F
            </div>
            <div className="flex-1">
              <span className="font-medium text-white">fixr</span>
              {cast.channel && (
                <span className="text-gray-500 text-sm ml-2">/{cast.channel}</span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {formatTimeAgo(cast.postedAt)}
            </span>
          </div>

          {/* Content */}
          <p className="text-gray-300 text-sm leading-relaxed line-clamp-4 mb-3">
            {cast.text}
          </p>

          {/* Engagement */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1 group-hover:text-pink-400 transition-colors">
              <HeartIcon className="w-4 h-4" />
              {cast.likes}
            </span>
            <span className="flex items-center gap-1 group-hover:text-green-400 transition-colors">
              <ArrowPathRoundedSquareIcon className="w-4 h-4" />
              {cast.recasts}
            </span>
            <span className="flex items-center gap-1 group-hover:text-blue-400 transition-colors">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              {cast.replies}
            </span>
          </div>
        </motion.a>
      ))}

      {/* View more link */}
      <a
        href="https://warpcast.com/fixr"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center py-3 text-purple-400 hover:text-purple-300 text-sm transition-colors"
      >
        View all on Warpcast →
      </a>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}
