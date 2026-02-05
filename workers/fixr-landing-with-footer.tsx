'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Task {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentStatus {
  agent: {
    name: string;
    tagline: string;
    socials: {
      x: string;
      farcaster: string;
      website: string;
    };
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

const API_URL = 'https://fixr-agent.see21289.workers.dev';

export default function Home() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCron, setNextCron] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      const data = await response.json();

      if (data.success) {
        setStatus(data);
        setError(null);
      } else {
        setError('Failed to load agent status');
      }
    } catch (err) {
      setError('Failed to connect to agent');
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Cron countdown timer
  useEffect(() => {
    const updateCronTimer = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const nextFive = Math.ceil((minutes + 1) / 5) * 5;
      const minsLeft = nextFive - minutes - 1;
      const secsLeft = 60 - seconds;

      if (minsLeft === 0 && secsLeft <= 60) {
        setNextCron(`${secsLeft}s`);
      } else {
        setNextCron(`${minsLeft}m ${secsLeft}s`);
      }
    };

    updateCronTimer();
    const timer = setInterval(updateCronTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get pending tasks
  const pendingTasks = status?.recentTasks?.filter(
    (t) => t.status === 'pending' || t.status === 'awaiting_approval'
  ) || [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <Image
            src="/fixrpfp.png"
            alt="Fixr"
            width={120}
            height={120}
            className="rounded-full mx-auto mb-4"
          />
          <h1 className="text-6xl font-bold mb-4">FIXR</h1>
          <p className="text-xl text-gray-400">
            Fix&apos;n shit. Debugging your mess since before it was cool.
          </p>
          <div className="flex justify-center gap-6 mt-6">
            <a
              href="https://x.com/Fixr21718"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              X
            </a>
            <a
              href="https://farcaster.xyz/fixr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Farcaster
            </a>
          </div>
        </div>

        {/* Status */}
        {loading ? (
          <div className="text-center text-gray-500">Loading agent status...</div>
        ) : error ? (
          <div className="text-center text-red-400">{error}</div>
        ) : status ? (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Tasks" value={status.stats.totalTasks} />
              <StatCard
                label="Completed"
                value={status.stats.tasksByStatus.completed || 0}
                color="text-green-400"
              />
              <StatCard
                label="In Progress"
                value={
                  (status.stats.tasksByStatus.executing || 0) +
                  (status.stats.tasksByStatus.approved || 0) +
                  (status.stats.tasksByStatus.planning || 0) +
                  (status.stats.tasksByStatus.awaiting_approval || 0)
                }
                color="text-yellow-400"
              />
              <StatCard
                label="Projects Shipped"
                value={status.stats.completedProjects}
                color="text-purple-400"
              />
            </div>

            {/* Next Cron Timer */}
            <div className="text-center">
              <p className="text-gray-500 text-sm">Next check in: {nextCron}</p>
            </div>

            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">Pending Tasks</h2>
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                    >
                      <span className="text-gray-300 truncate mr-4">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goals */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Current Goals</h2>
              <ul className="space-y-2">
                {status.goals.map((goal, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <span className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-xs shrink-0">
                      {i + 1}
                    </span>
                    {goal}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent Tasks */}
            {status.recentTasks.length > 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
                <div className="space-y-3">
                  {status.recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                    >
                      <span className="text-gray-300 truncate mr-4">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-500 mb-8">Agent initializing...</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-800">
          <div className="flex justify-center gap-6 mb-4">
            <a
              href="https://x.com/Fixr21718"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
            >
              X
            </a>
            <a
              href="https://farcaster.xyz/fixr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
            >
              Farcaster
            </a>
          </div>
          <p className="text-center text-gray-600 text-sm">
            Autonomous builder agent • Powered by Claude
          </p>
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
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-700 text-gray-300',
    planning: 'bg-blue-900 text-blue-300',
    awaiting_approval: 'bg-yellow-900 text-yellow-300',
    approved: 'bg-purple-900 text-purple-300',
    executing: 'bg-orange-900 text-orange-300',
    completed: 'bg-green-900 text-green-300',
    failed: 'bg-red-900 text-red-300',
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${colors[status] || colors.pending}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
