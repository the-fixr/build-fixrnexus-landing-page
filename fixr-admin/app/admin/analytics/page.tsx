'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ChartBarIcon,
  ArrowPathIcon,
  HeartIcon,
  ArrowPathRoundedSquareIcon,
  ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, ActionButton, StatCard } from '../../components/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://fixr-workers.jumpboxlabs.workers.dev';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

interface Cast {
  hash: string;
  text: string;
  likes: number;
  recasts: number;
  replies: number;
  timestamp: string;
  cast_type?: string;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: castsData, mutate } = useSWR<{
    casts: Cast[];
    summary?: {
      totalCasts: number;
      totalEngagement: number;
      avgEngagement: number;
    };
  }>(`${API_BASE}/api/analytics/casts?limit=50`, fetcher, {
    refreshInterval: 60000,
  });

  const { data: bestContent } = useSWR(
    `${API_BASE}/api/analytics/best-content`,
    fetcher
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/analytics/refresh`, { method: 'POST' });
      await mutate();
      toast.success('Analytics refreshed');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const casts = castsData?.casts || [];
  const summary = castsData?.summary || {
    totalCasts: 0,
    totalEngagement: 0,
    avgEngagement: 0,
  };

  // Prepare chart data
  const engagementByDay = casts.reduce((acc: Record<string, { date: string; likes: number; recasts: number; replies: number }>, cast) => {
    const date = new Date(cast.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = { date, likes: 0, recasts: 0, replies: 0 };
    }
    acc[date].likes += cast.likes || 0;
    acc[date].recasts += cast.recasts || 0;
    acc[date].replies += cast.replies || 0;
    return acc;
  }, {});

  const chartData = Object.values(engagementByDay).reverse().slice(-7);

  // Cast type distribution
  const castTypeData = casts.reduce((acc: Record<string, number>, cast) => {
    const type = cast.cast_type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(castTypeData).map(([name, value]) => ({
    name,
    value,
  }));

  // Top performing casts
  const topCasts = [...casts]
    .sort((a, b) => (b.likes + b.recasts + b.replies) - (a.likes + a.recasts + a.replies))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            Track engagement and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <ActionButton
            variant="secondary"
            onClick={handleRefresh}
            loading={isRefreshing}
            icon={<ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </ActionButton>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Casts"
          value={summary.totalCasts}
          icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Total Engagement"
          value={summary.totalEngagement}
          icon={<HeartIcon className="w-5 h-5" />}
          color="pink"
        />
        <StatCard
          label="Avg. Engagement"
          value={Math.round(summary.avgEngagement)}
          icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="This Week"
          value={chartData.reduce((sum, d) => sum + d.likes + d.recasts + d.replies, 0)}
          icon={<CalendarIcon className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Engagement Over Time */}
        <AdminCard
          title="Engagement Over Time"
          subtitle="Daily likes, recasts, and replies"
          className="lg:col-span-2"
        >
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRecasts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#666"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#666"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="likes"
                    stroke="#a855f7"
                    fillOpacity={1}
                    fill="url(#colorLikes)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="recasts"
                    stroke="#ec4899"
                    fillOpacity={1}
                    fill="url(#colorRecasts)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="replies"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorReplies)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-gray-400">Likes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-gray-400">Recasts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-400">Replies</span>
            </div>
          </div>
        </AdminCard>

        {/* Cast Type Distribution */}
        <AdminCard title="Cast Types" subtitle="Content distribution">
          <div className="h-[300px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-gray-400 capitalize">{entry.name}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      {/* Top Performing Content */}
      <AdminCard title="Top Performing Casts" subtitle="Highest engagement content">
        <div className="space-y-3">
          {topCasts.map((cast, index) => (
            <motion.div
              key={cast.hash}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-4 p-4 bg-gray-800/30 rounded-xl border border-gray-800"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 line-clamp-2">{cast.text}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <HeartIcon className="w-3.5 h-3.5 text-pink-400" />
                    {cast.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowPathRoundedSquareIcon className="w-3.5 h-3.5 text-green-400" />
                    {cast.recasts}
                  </span>
                  <span className="flex items-center gap-1">
                    <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-blue-400" />
                    {cast.replies}
                  </span>
                  <span className="text-gray-600">
                    {new Date(cast.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-white">
                  {cast.likes + cast.recasts + cast.replies}
                </p>
                <p className="text-xs text-gray-500">total</p>
              </div>
            </motion.div>
          ))}
          {topCasts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No cast data available
            </div>
          )}
        </div>
      </AdminCard>

      {/* Best Content Insights */}
      {bestContent && (
        <AdminCard title="Content Insights" subtitle="AI-powered recommendations">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <h4 className="font-medium text-purple-400 mb-2">Best Time to Post</h4>
              <p className="text-2xl font-bold text-white">
                {bestContent.bestHour || 12}:00
              </p>
              <p className="text-xs text-gray-500 mt-1">Based on engagement data</p>
            </div>
            <div className="p-4 bg-pink-500/10 border border-pink-500/20 rounded-xl">
              <h4 className="font-medium text-pink-400 mb-2">Top Content Type</h4>
              <p className="text-2xl font-bold text-white capitalize">
                {bestContent.topType || 'GM/GN'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Highest avg engagement</p>
            </div>
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <h4 className="font-medium text-blue-400 mb-2">Engagement Trend</h4>
              <p className="text-2xl font-bold text-white">
                {bestContent.trend > 0 ? '+' : ''}{bestContent.trend || 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">vs previous period</p>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  );
}
