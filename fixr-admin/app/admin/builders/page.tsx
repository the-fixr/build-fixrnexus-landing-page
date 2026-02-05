'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  UserGroupIcon,
  MagnifyingGlassIcon,
  TrophyIcon,
  StarIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, ActionButton, StatCard, DataTable } from '../../components/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://fixr-workers.jumpboxlabs.workers.dev';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Builder {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  score: number;
  lastShipped?: string;
  totalShips: number;
}

export default function BuildersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Builder | null>(null);

  const { data: topBuilders } = useSWR<{ builders: Builder[] }>(
    `${API_BASE}/api/builders/top?limit=20`,
    fetcher
  );

  const { data: buildersStats } = useSWR(
    `${API_BASE}/api/builders/stats`,
    fetcher
  );

  const { data: builderIDHolders } = useSWR(
    `${API_BASE}/api/builder-id/holders?limit=10`,
    fetcher
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a username or FID');
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/builders/profile/${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();

      if (data.success && data.builder) {
        setSearchResult(data.builder);
      } else {
        toast.error('Builder not found');
        setSearchResult(null);
      }
    } catch {
      toast.error('Failed to search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFeatureBuilder = async (fid: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/builder-digest/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Builder spotlight posted!');
      } else {
        toast.error(data.error || 'Failed to feature builder');
      }
    } catch {
      toast.error('Failed to feature builder');
    }
  };

  const builders = topBuilders?.builders || [];
  const stats = buildersStats || { totalBuilders: 0, totalShips: 0, avgScore: 0 };
  const holders = builderIDHolders?.holders || [];

  const columns = [
    {
      key: 'rank',
      header: '#',
      render: (_: Builder, index: number) => (
        <span className="text-gray-500 font-medium">{index + 1}</span>
      ),
    },
    {
      key: 'username',
      header: 'Builder',
      render: (builder: Builder) => (
        <div className="flex items-center gap-3">
          {builder.pfpUrl ? (
            <img
              src={builder.pfpUrl}
              alt={builder.displayName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <UserGroupIcon className="w-5 h-5 text-purple-400" />
            </div>
          )}
          <div>
            <p className="font-medium text-white">{builder.displayName}</p>
            <p className="text-xs text-gray-500">@{builder.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      render: (builder: Builder) => (
        <div className="flex items-center gap-2">
          <StarIcon className="w-4 h-4 text-yellow-400" />
          <span className="font-bold text-white">{builder.score}</span>
        </div>
      ),
    },
    {
      key: 'totalShips',
      header: 'Ships',
      sortable: true,
      render: (builder: Builder) => (
        <span className="text-gray-300">{builder.totalShips}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (builder: Builder) => (
        <div className="flex items-center gap-2">
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => handleFeatureBuilder(builder.fid)}
            icon={<SparklesIcon className="w-3 h-3" />}
          >
            Feature
          </ActionButton>
          <a
            href={`https://warpcast.com/${builder.username}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ActionButton variant="ghost" size="sm">
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </ActionButton>
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Builders</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage and spotlight top builders
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Builders"
          value={stats.totalBuilders || builders.length}
          icon={<UserGroupIcon className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Total Ships"
          value={stats.totalShips || 0}
          icon={<TrophyIcon className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Avg Score"
          value={Math.round(stats.avgScore || 0)}
          icon={<StarIcon className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          label="Builder IDs"
          value={holders.length}
          icon={<IdentificationIcon className="w-5 h-5" />}
          color="pink"
        />
      </div>

      {/* Search Builder */}
      <AdminCard title="Search Builder" subtitle="Find by username or FID">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter username or FID..."
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <ActionButton onClick={handleSearch} loading={isSearching}>
            Search
          </ActionButton>
        </div>

        {searchResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-gray-800/30 rounded-xl border border-gray-800"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {searchResult.pfpUrl ? (
                  <img
                    src={searchResult.pfpUrl}
                    alt={searchResult.displayName}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <UserGroupIcon className="w-8 h-8 text-purple-400" />
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-bold text-white">
                    {searchResult.displayName}
                  </h4>
                  <p className="text-sm text-gray-400">@{searchResult.username}</p>
                  <p className="text-xs text-gray-500">FID: {searchResult.fid}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <StarIcon className="w-5 h-5 text-yellow-400" />
                  <span className="text-2xl font-bold text-white">
                    {searchResult.score}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{searchResult.totalShips} ships</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <ActionButton
                onClick={() => handleFeatureBuilder(searchResult.fid)}
                icon={<SparklesIcon className="w-4 h-4" />}
                className="flex-1"
              >
                Feature Builder
              </ActionButton>
              <a
                href={`https://warpcast.com/${searchResult.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <ActionButton variant="secondary" className="w-full">
                  View on Warpcast
                </ActionButton>
              </a>
            </div>
          </motion.div>
        )}
      </AdminCard>

      {/* Top Builders Table */}
      <AdminCard title="Top Builders" subtitle="Leaderboard" noPadding>
        <DataTable
          data={builders}
          columns={columns}
          keyExtractor={(b) => String(b.fid)}
          pageSize={10}
          emptyMessage="No builders found"
        />
      </AdminCard>

      {/* Builder ID Holders */}
      <AdminCard title="Recent Builder IDs" subtitle="Latest NFT mints">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {holders.map((holder: {
            fid: number;
            username: string;
            displayName: string;
            pfpUrl?: string;
            score: number;
            mintedAt: string;
          }) => (
            <motion.div
              key={holder.fid}
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl"
            >
              <div className="flex items-center gap-3">
                {holder.pfpUrl ? (
                  <img
                    src={holder.pfpUrl}
                    alt={holder.displayName}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <IdentificationIcon className="w-5 h-5 text-purple-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{holder.displayName}</p>
                  <p className="text-xs text-gray-500">Score: {holder.score}</p>
                </div>
              </div>
            </motion.div>
          ))}
          {holders.length === 0 && (
            <p className="text-gray-500 text-sm col-span-3 text-center py-4">
              No Builder IDs minted yet
            </p>
          )}
        </div>
      </AdminCard>
    </div>
  );
}
