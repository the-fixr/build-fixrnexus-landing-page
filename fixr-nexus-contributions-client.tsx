// app/contributions/ContributionsClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PRComment {
  user: string;
  body: string;
  createdAt: string;
  isReviewComment: boolean;
}

interface PRDetails {
  number: number;
  title: string;
  body: string;
  state: string;
  merged: boolean;
  mergeable: boolean;
  user: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  reviewComments: number;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
  reviewState: string;
}

interface PR {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  branch: string;
  status: string;
  createdAt: string;
  details: PRDetails;
  totalComments: number;
  externalComments: number;
  latestComments: PRComment[];
  needsAttention: boolean;
}

interface PRsResponse {
  success: boolean;
  trackedPRs: number;
  prs: PR[];
}

const FIXR_API = 'https://fixr-agent.see21289.workers.dev';

export default function ContributionsClient() {
  const [prs, setPRs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPRs = async () => {
      try {
        const response = await fetch(`${FIXR_API}/api/github/prs`);
        const data: PRsResponse = await response.json();

        if (data.success) {
          setPRs(data.prs);
        } else {
          setError('Failed to fetch PRs');
        }
      } catch (err) {
        setError('Failed to connect to Fixr API');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPRs();
    const interval = setInterval(fetchPRs, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (pr: PR) => {
    if (pr.details?.merged) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    if (pr.status === 'open') return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (pr.status === 'closed') return 'text-red-400 bg-red-500/10 border-red-500/30';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  };

  const getStatusText = (pr: PR) => {
    if (pr.details?.merged) return 'Merged';
    return pr.status.charAt(0).toUpperCase() + pr.status.slice(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-sm font-bold">
              F
            </div>
            <span className="font-semibold">Fixr</span>
          </Link>
          <nav className="flex gap-6 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/contributions" className="text-white">Contributions</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Open Source Contributions</h1>
          <p className="text-gray-400 text-lg">
            Track Fixr&apos;s pull requests and contributions to open source projects in the Farcaster and Base ecosystem.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-3xl font-bold text-purple-400">{prs.length}</div>
            <div className="text-sm text-gray-500">Active PRs</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-3xl font-bold text-green-400">
              {prs.filter(pr => pr.status === 'open').length}
            </div>
            <div className="text-sm text-gray-500">Open</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-3xl font-bold text-purple-400">
              {prs.filter(pr => pr.details?.merged).length}
            </div>
            <div className="text-sm text-gray-500">Merged</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-3xl font-bold text-yellow-400">
              {prs.filter(pr => pr.needsAttention).length}
            </div>
            <div className="text-sm text-gray-500">Need Attention</div>
          </div>
        </div>

        {/* PRs List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">
            <p>{error}</p>
          </div>
        ) : prs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>No active pull requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prs.map((pr) => (
              <a
                key={`${pr.owner}/${pr.repo}/${pr.number}`}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-900/30 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 hover:bg-gray-900/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-500">
                        {pr.owner}/{pr.repo}
                      </span>
                      <span className="text-gray-600">•</span>
                      <span className="text-sm text-gray-500">#{pr.number}</span>
                      {pr.needsAttention && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full">
                          Needs Attention
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-medium group-hover:text-purple-400 transition-colors truncate">
                      {pr.title}
                    </h3>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(pr)}`}>
                    {getStatusText(pr)}
                  </span>
                </div>

                {/* PR Stats */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {pr.totalComments} comments
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {pr.details?.commits || 0} commits
                  </span>
                  <span className="text-green-400">+{pr.details?.additions || 0}</span>
                  <span className="text-red-400">-{pr.details?.deletions || 0}</span>
                  <span className="text-gray-600">•</span>
                  <span>{formatDate(pr.createdAt)}</span>
                </div>

                {/* Latest Comment Preview */}
                {pr.latestComments && pr.latestComments.length > 0 && pr.externalComments > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="text-xs text-gray-500 mb-2">Latest comment from @{pr.latestComments[0].user}:</div>
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {pr.latestComments[0].body.slice(0, 150)}
                      {pr.latestComments[0].body.length > 150 ? '...' : ''}
                    </p>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>PRs are automatically tracked when Fixr submits contributions.</p>
          <p className="mt-1">
            View on GitHub:{' '}
            <a
              href="https://github.com/the-fixr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              @the-fixr
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
