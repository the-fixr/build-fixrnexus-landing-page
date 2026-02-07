'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface OracleApiStatsProps {
  oracleId: string;
}

interface StatsData {
  oracle: {
    id: string;
    name: string;
    address: string;
  };
  stats: {
    totalCalls: number;
    callsToday: number;
    callsThisWeek: number;
    callsThisMonth: number;
    lastCallAt: string | null;
    avgResponseTimeMs: number;
    successRate: number;
  };
  history: {
    last7Days: Array<{
      date: string;
      calls: number;
    }>;
  };
}

export default function OracleApiStats({ oracleId }: OracleApiStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [oracleId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/stats/${oracleId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stats');
      }

      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
        <p className="text-red-400">Failed to load API statistics: {error}</p>
      </div>
    );
  }

  const maxCalls = Math.max(...stats.history.last7Days.map(d => d.calls), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">API Call Statistics</h3>
        <p className="text-sm text-gray-400">Real-time usage metrics for {stats.oracle.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400 uppercase">Total Calls</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats.stats.totalCalls.toLocaleString()}
          </div>
        </div>

        {/* Today */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400 uppercase">Today</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats.stats.callsToday.toLocaleString()}
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400 uppercase">Avg Response</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats.stats.avgResponseTimeMs}ms
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400 uppercase">Success Rate</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats.stats.successRate}%
          </div>
        </div>
      </div>

      {/* 7-Day Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">Last 7 Days</h4>
        <div className="flex items-end justify-between gap-2 h-32">
          {stats.history.last7Days.map(({ date, calls }) => {
            const height = maxCalls > 0 ? (calls / maxCalls) * 100 : 0;
            const dateObj = new Date(date);
            const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-400 group relative"
                    style={{ height: `${height}%`, minHeight: calls > 0 ? '4px' : '0' }}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                        {calls} calls
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-400 mb-1">This Week</p>
          <p className="text-lg font-semibold text-white">
            {stats.stats.callsThisWeek.toLocaleString()} calls
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">This Month</p>
          <p className="text-lg font-semibold text-white">
            {stats.stats.callsThisMonth.toLocaleString()} calls
          </p>
        </div>
      </div>

      {/* Last Call */}
      {stats.stats.lastCallAt && (
        <div className="text-xs text-gray-500">
          Last API call: {new Date(stats.stats.lastCallAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
