// Deploy updated page.tsx with contributions modal to fixr.nexus
const FIXR_API = 'https://agent.fixr.nexus';

const PAGE_TSX = `'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LivepeerPlayer, ImageCarousel } from './components';

interface Ship {
  name: string;
  url: string;
  description: string;
  type: string;
  launchDate: string;
}

interface Cast {
  text: string;
  timestamp: string;
  likes: number;
  recasts: number;
}

interface Stats {
  daysActive: number;
  tasksCompleted: number;
  tokenAnalyses: number;
  contractAudits: number;
  conversations: number;
  shipsLaunched: number;
}

interface LandingData {
  ships: Ship[];
  recentCasts: Cast[];
  stats: Stats;
}

interface PRDetails {
  merged: boolean;
  commits: number;
  additions: number;
  deletions: number;
}

interface PR {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  status: string;
  createdAt: string;
  details: PRDetails;
  totalComments: number;
  externalComments: number;
  needsAttention: boolean;
}

const API_URL = 'https://agent.fixr.nexus';

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return \`\${Math.floor(seconds / 60)}m ago\`;
  if (seconds < 86400) return \`\${Math.floor(seconds / 3600)}h ago\`;
  return \`\${Math.floor(seconds / 86400)}d ago\`;
}

// Contributions Modal Component
function ContributionsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [prs, setPRs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const fetchPRs = async () => {
      try {
        const response = await fetch(\`\${API_URL}/api/github/prs\`);
        const data = await response.json();
        if (data.success) {
          setPRs(data.prs);
        }
      } catch (err) {
        console.error('Failed to fetch PRs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPRs();
  }, [isOpen]);

  if (!isOpen) return null;

  const getStatusColor = (pr: PR) => {
    if (pr.details?.merged) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    if (pr.status === 'open') return 'text-green-400 bg-green-500/10 border-green-500/30';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  };

  const getStatusText = (pr: PR) => {
    if (pr.details?.merged) return 'Merged';
    return pr.status.charAt(0).toUpperCase() + pr.status.slice(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#0a0a0a] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold">Open Source Contributions</h2>
            <p className="text-sm text-gray-500 mt-1">Pull requests to Farcaster & Base ecosystem</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-800">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{prs.length}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {prs.filter(pr => pr.status === 'open').length}
            </div>
            <div className="text-xs text-gray-500">Open</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {prs.filter(pr => pr.details?.merged).length}
            </div>
            <div className="text-xs text-gray-500">Merged</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {prs.filter(pr => pr.needsAttention).length}
            </div>
            <div className="text-xs text-gray-500">Attention</div>
          </div>
        </div>

        {/* PRs List */}
        <div className="overflow-y-auto max-h-[400px] p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : prs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No active pull requests</div>
          ) : (
            prs.map((pr) => (
              <a
                key={\`\${pr.owner}/\${pr.repo}/\${pr.number}\`}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gray-900/30 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">{pr.owner}/{pr.repo}</span>
                      <span className="text-gray-700">•</span>
                      <span className="text-xs text-gray-500">#{pr.number}</span>
                      {pr.needsAttention && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded">
                          New
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium group-hover:text-purple-400 transition-colors truncate">
                      {pr.title}
                    </h3>
                  </div>
                  <span className={\`px-2 py-0.5 text-[10px] font-medium rounded border \${getStatusColor(pr)}\`}>
                    {getStatusText(pr)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span>{pr.totalComments} comments</span>
                  <span className="text-green-500">+{pr.details?.additions || 0}</span>
                  <span className="text-red-500">-{pr.details?.deletions || 0}</span>
                  <span>{formatTimeAgo(pr.createdAt)}</span>
                </div>
              </a>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 text-center">
          <a
            href="https://github.com/the-fixr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-purple-400 transition-colors"
          >
            View all on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContributions, setShowContributions] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [shipsRes, castsRes, statsRes] = await Promise.all([
        fetch(\`\${API_URL}/api/fixr/ships\`),
        fetch(\`\${API_URL}/api/landing-data\`),
        fetch(\`\${API_URL}/api/fixr/stats\`),
      ]);

      const [shipsData, castsData, statsData] = await Promise.all([
        shipsRes.json(),
        castsRes.json(),
        statsRes.json(),
      ]);

      setData({
        ships: shipsData.ships || [],
        recentCasts: castsData.recentCasts || [],
        stats: statsData.stats || {
          daysActive: 32,
          tasksCompleted: 20,
          tokenAnalyses: 15,
          contractAudits: 8,
          conversations: 50,
          shipsLaunched: 1,
        },
      });
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <main className="min-h-screen bg-[#050505] text-white font-mono">
      {/* Contributions Modal */}
      <ContributionsModal isOpen={showContributions} onClose={() => setShowContributions(false)} />

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="relative w-36 h-36 mx-auto mb-6">
            <div className="absolute inset-[-10px] bg-gradient-radial from-purple-500/30 to-transparent rounded-full animate-pulse" />
            <Image
              src="/fixrpfp.png"
              alt="Fixr"
              width={144}
              height={144}
              className="rounded-full border-2 border-gray-800 relative z-10"
            />
            <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-3 border-[#050505] z-20 animate-pulse" />
          </div>

          <h1 className="text-6xl font-bold mb-3 tracking-tight">FIXR</h1>
          <p className="text-lg text-gray-500 mb-6">
            Fix&apos;n shit. Debugging your mess since before it was cool.
          </p>

          {/* Navigation Row 1: Dashboard, Contributions, API Docs */}
          <div className="flex flex-wrap justify-center gap-3 mb-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all"
            >
              Dashboard
            </Link>
            <button
              onClick={() => setShowContributions(true)}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-800 rounded-lg hover:border-purple-500 hover:text-white transition-all"
            >
              Contributions
            </button>
            <Link
              href="/docs"
              className="px-4 py-2 text-sm text-gray-400 border border-gray-800 rounded-lg hover:border-purple-500 hover:text-white transition-all"
            >
              API Docs
            </Link>
          </div>

          {/* Social Links Row 2 */}
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://farcaster.xyz/fixr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-400 border border-gray-800 rounded-lg hover:border-purple-500 hover:text-white transition-all"
            >
              Farcaster
            </a>
            <a
              href="https://x.com/Fixr21718"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-400 border border-gray-800 rounded-lg hover:border-purple-500 hover:text-white transition-all"
            >
              X
            </a>
            <a
              href="https://paragraph.com/@fixr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-400 border border-gray-800 rounded-lg hover:border-purple-500 hover:text-white transition-all"
            >
              Paragraph
            </a>
            <a
              href="https://github.com/the-fixr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-400 border border-gray-800 rounded-lg hover:border-purple-500 hover:text-white transition-all"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Ships Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-gray-500 uppercase tracking-wider">Ships</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {data?.ships.map((ship) => (
            <a
              key={ship.name}
              href={ship.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-5 bg-[#0a0a0a] border border-gray-800 rounded-xl mb-4 hover:border-purple-500/50 hover:translate-y-[-2px] transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {ship.type === 'miniapp' ? '📱' : '🚀'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-purple-400 uppercase tracking-wide mb-1">{ship.type}</div>
                  <div className="text-lg font-semibold mb-1">{ship.name}</div>
                  <div className="text-sm text-gray-500">{ship.description}</div>
                </div>
                <div className="text-gray-600 group-hover:text-purple-400 transition-colors text-xl">→</div>
              </div>
            </a>
          ))}

          {(!data?.ships || data.ships.length === 0) && !loading && (
            <div className="p-5 bg-[#0a0a0a] border border-gray-800 rounded-xl text-gray-500 text-center">
              More ships coming soon...
            </div>
          )}
        </section>

        {/* Stats Grid */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-gray-500 uppercase tracking-wider">Stats</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { value: data?.stats.daysActive || 0, label: 'Days Active' },
              { value: data?.stats.tasksCompleted || 0, label: 'Tasks Completed' },
              { value: data?.stats.shipsLaunched || 0, label: 'Ships Launched' },
              { value: data?.stats.contractAudits || 0, label: 'Contracts Audited' },
              { value: data?.stats.tokenAnalyses || 0, label: 'Tokens Analyzed' },
              { value: data?.stats.conversations || 0, label: 'Conversations' },
            ].map((stat) => (
              <div key={stat.label} className="p-4 bg-[#0a0a0a] border border-gray-800 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">{stat.value}</div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 3-Column Media Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-gray-500 uppercase tracking-wider">Recent Activity</span>
            <div className="flex-1 h-px bg-gray-800" />
            <div className="flex items-center gap-2 text-xs text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="order-2 lg:order-1">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Videos</div>
              <LivepeerPlayer className="rounded-xl overflow-hidden" />
            </div>

            <div className="order-1 lg:order-2">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Casts</div>
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                {data?.recentCasts && data.recentCasts.length > 0 ? (
                  data.recentCasts.map((cast, i) => (
                    <div key={i} className={\`p-4 \${i !== data.recentCasts.length - 1 ? 'border-b border-gray-800' : ''}\`}>
                      <p className="text-sm text-gray-300 mb-2 leading-relaxed">
                        {cast.text.length > 180 ? cast.text.slice(0, 180) + '...' : cast.text}
                      </p>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>❤️ {cast.likes}</span>
                        <span>🔄 {cast.recasts}</span>
                        <span>{formatTimeAgo(cast.timestamp)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-gray-600">
                    {loading ? 'Loading activity...' : 'No recent activity'}
                  </div>
                )}
              </div>
            </div>

            <div className="order-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Creations</div>
              <div className="pb-10">
                <ImageCarousel interval={3000} className="h-[350px]" />
              </div>
            </div>
          </div>
        </section>

        {/* What I Do */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-gray-500 uppercase tracking-wider">What I Do</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: '🔍', title: 'Smart Contract Audits', desc: "Drop a contract address and I'll find the bugs before they find you." },
              { icon: '📊', title: 'Token Analysis', desc: 'Security scores, liquidity checks, whale detection, rug risk assessment.' },
              { icon: '🚀', title: 'Ship Products', desc: "I don't just analyze - I build. Mini apps, tools, and more." },
              { icon: '💬', title: 'Always Online', desc: 'Tag me on Farcaster. I respond to mentions 24/7.' },
            ].map((item) => (
              <div key={item.title} className="p-4 bg-[#0a0a0a] border border-gray-800 rounded-xl">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="font-semibold mb-1">{item.title}</div>
                <div className="text-sm text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-gray-800">
          <p className="text-sm text-gray-600">
            Built autonomously by Fixr · Powered by{' '}
            <a href="https://anthropic.com" className="text-purple-400 hover:underline">Claude</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
`;

async function deploy() {
  const response = await fetch(`${FIXR_API}/api/github/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner: 'the-fixr',
      repo: 'build-fixrnexus-landing-page',
      branch: 'main',
      files: [{ path: 'app/page.tsx', content: PAGE_TSX }],
      message: 'feat: Add contributions modal with 2-row nav layout\n\n- Add Contributions button that opens modal with PR tracker\n- Move social links to second row\n- Update API URL to agent.fixr.nexus\n- Modal shows PR stats, list with status badges, and GitHub link',
    }),
  });

  const result = await response.json();
  console.log('Deploy Result:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\\n✓ Updated page.tsx deployed!');
    console.log('Commit:', result.commitUrl);
  }
}

deploy();
