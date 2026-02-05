'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  UserGroupIcon,
  RocketLaunchIcon,
  ArrowPathIcon,
  PlayIcon,
  ChartBarIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, StatCard, StatusBadge, ActionButton } from '../components/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://fixr-workers.jumpboxlabs.workers.dev';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AgentStatus {
  agent: {
    name: string;
    tagline: string;
  };
  stats: {
    totalTasks: number;
    tasksByStatus: Record<string, number>;
    completedProjects: number;
    goalsRemaining: number;
  };
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string;
  }>;
  goals: string[];
}

interface Task {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CastAnalytics {
  casts: Array<{
    hash: string;
    text: string;
    likes: number;
    recasts: number;
    replies: number;
    timestamp: string;
  }>;
  summary?: {
    totalCasts: number;
    totalEngagement: number;
    avgEngagement: number;
  };
}

export default function AdminDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: status, mutate: mutateStatus } = useSWR<AgentStatus>(
    `${API_BASE}/api/status`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: tasksData } = useSWR<{ tasks: Task[] }>(
    `${API_BASE}/api/tasks`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: analyticsData } = useSWR<CastAnalytics>(
    `${API_BASE}/api/analytics/casts?limit=5`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mutateStatus();
      toast.success('Dashboard refreshed');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const triggerCron = async (cronType: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/trigger-cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: cronType }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${cronType} triggered successfully`);
      } else {
        toast.error(data.error || 'Failed to trigger');
      }
    } catch {
      toast.error('Failed to trigger cron');
    }
  };

  const tasks = tasksData?.tasks || [];
  const inProgressTasks = tasks.filter((t) =>
    ['planning', 'awaiting_approval', 'approved', 'executing'].includes(t.status)
  );
  const pendingTasks = tasks.filter((t) => t.status === 'pending');

  const totalEngagement = analyticsData?.summary?.totalEngagement || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Agent overview and quick actions
          </p>
        </div>
        <ActionButton
          variant="secondary"
          onClick={handleRefresh}
          loading={isRefreshing}
          icon={<ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </ActionButton>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={status?.stats.totalTasks || 0}
          icon={<ClipboardDocumentListIcon className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Completed"
          value={status?.stats.tasksByStatus?.completed || 0}
          icon={<RocketLaunchIcon className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="In Progress"
          value={inProgressTasks.length}
          icon={<BoltIcon className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          label="Engagement"
          value={totalEngagement}
          icon={<ChartBarIcon className="w-5 h-5" />}
          color="pink"
        />
      </div>

      {/* Quick Actions */}
      <AdminCard title="Quick Actions" subtitle="Trigger agent actions">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionButton
            variant="secondary"
            onClick={() => triggerCron('gm')}
            icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />}
            className="w-full"
          >
            Post GM
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => triggerCron('gn')}
            icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />}
            className="w-full"
          >
            Post GN
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => triggerCron('builder_digest')}
            icon={<UserGroupIcon className="w-4 h-4" />}
            className="w-full"
          >
            Builder Digest
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => triggerCron('weekly_recap')}
            icon={<VideoCameraIcon className="w-4 h-4" />}
            className="w-full"
          >
            Weekly Recap
          </ActionButton>
        </div>
      </AdminCard>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <AdminCard
          title="Recent Tasks"
          subtitle="Latest task activity"
          headerAction={
            <Link href="/admin/tasks">
              <ActionButton variant="ghost" size="sm">
                View All
              </ActionButton>
            </Link>
          }
        >
          <div className="space-y-3">
            {status?.recentTasks?.slice(0, 5).map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{task.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(task.updatedAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={task.status} size="sm" />
              </motion.div>
            )) || (
              <p className="text-gray-500 text-sm text-center py-4">No recent tasks</p>
            )}
          </div>
        </AdminCard>

        {/* Recent Casts */}
        <AdminCard
          title="Recent Casts"
          subtitle="Latest Farcaster posts"
          headerAction={
            <Link href="/admin/analytics">
              <ActionButton variant="ghost" size="sm">
                View All
              </ActionButton>
            </Link>
          }
        >
          <div className="space-y-3">
            {analyticsData?.casts?.slice(0, 5).map((cast) => (
              <motion.div
                key={cast.hash}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 bg-gray-800/30 rounded-lg"
              >
                <p className="text-sm text-gray-300 line-clamp-2">{cast.text}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{cast.likes} likes</span>
                  <span>{cast.recasts} recasts</span>
                  <span>{cast.replies} replies</span>
                </div>
              </motion.div>
            )) || (
              <p className="text-gray-500 text-sm text-center py-4">No recent casts</p>
            )}
          </div>
        </AdminCard>
      </div>

      {/* Goals */}
      {status?.goals && status.goals.length > 0 && (
        <AdminCard title="Current Goals" subtitle="Agent objectives">
          <div className="space-y-2">
            {status.goals.map((goal, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-300">{goal}</p>
              </motion.div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* Pending Approvals */}
      {pendingTasks.length > 0 && (
        <AdminCard
          title="Pending Approvals"
          subtitle={`${pendingTasks.length} tasks awaiting action`}
        >
          <div className="space-y-3">
            {pendingTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"
              >
                <div>
                  <p className="text-sm text-white">{task.title}</p>
                  <p className="text-xs text-gray-500">
                    Created {new Date(task.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton variant="success" size="sm">
                    Approve
                  </ActionButton>
                  <ActionButton variant="ghost" size="sm">
                    View
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  );
}
