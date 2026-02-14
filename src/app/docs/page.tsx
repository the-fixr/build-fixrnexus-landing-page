'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Shield,
  Coins,
  BarChart3,
  Search,
  Zap,
  Github,
  Image,
  Video,
  Users,
  Lock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import CamoBackground from '@/components/CamoBackground';

/* ── types ─────────────────────────────────────────────────────────── */

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth?: 'staking' | 'x402' | 'none';
  params?: string;
  example?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  endpoints: Endpoint[];
}

/* ── data ──────────────────────────────────────────────────────────── */

const BASE_URL = 'https://agent.fixr.nexus';

const TIERS = [
  { name: 'FREE', stake: '0', rate: '10/min', benefits: 'Basic API access, rate limited' },
  { name: 'BUILDER', stake: '1M FIXR', rate: '20/min', benefits: 'Enhanced limits, priority queue' },
  { name: 'PRO', stake: '10M FIXR', rate: '50/min', benefits: 'Full API access, webhooks' },
  { name: 'ELITE', stake: '50M FIXR', rate: 'Unlimited', benefits: 'Unlimited access, custom features' },
];

const SECTIONS: Section[] = [
  {
    id: 'security',
    title: 'Security & Analysis',
    icon: Shield,
    description: 'Smart contract audits, token analysis, wallet intel, and rug detection.',
    endpoints: [
      { method: 'POST', path: '/api/v1/security/audit', description: 'Smart contract security audit', auth: 'x402' },
      { method: 'POST', path: '/api/v1/wallet/intel', description: 'Wallet intelligence & risk analysis', auth: 'x402' },
      { method: 'POST', path: '/api/v1/token/analyze', description: 'Comprehensive token analysis', auth: 'x402' },
      { method: 'GET', path: '/api/v1/rug/detect/:address', description: 'Real-time rug detection', auth: 'x402' },
      { method: 'GET', path: '/api/v1/rug/recent', description: 'Recent rug incidents', auth: 'x402' },
      { method: 'GET', path: '/api/v1/sentiment/:symbol', description: 'Farcaster sentiment analysis', auth: 'x402' },
    ],
  },
  {
    id: 'tokens',
    title: 'Token Data',
    icon: Search,
    description: 'Token prices, honeypot checks, whale tracking across 200+ chains via GeckoTerminal & GoPlus.',
    endpoints: [
      { method: 'POST', path: '/api/token/analyze', description: 'Full token analysis (honeypot, liquidity, holders, sentiment)', auth: 'none' },
      { method: 'GET', path: '/api/token/honeypot/:address', description: 'Quick honeypot check via GoPlus', auth: 'none' },
      { method: 'GET', path: '/api/token/sentiment/:symbol', description: 'Social sentiment analysis', auth: 'none' },
      { method: 'GET', path: '/api/token/whales/:address', description: 'Top token holders via Alchemy', auth: 'none' },
      { method: 'GET', path: '/api/nft/analyze/:address', description: 'NFT collection analysis', auth: 'none' },
      { method: 'GET', path: '/api/deployer/portfolio/:address', description: 'Deployer wallet history', auth: 'none' },
    ],
  },
  {
    id: 'reputation',
    title: 'Reputation & Builders',
    icon: Users,
    description: 'Builder profiles, reputation scores from Ethos, Talent Protocol, and on-chain activity.',
    endpoints: [
      { method: 'GET', path: '/api/v1/reputation/ethos/:fid', description: 'Ethos reputation score by FID', auth: 'x402' },
      { method: 'GET', path: '/api/v1/reputation/talent/:wallet', description: 'Talent Protocol passport score', auth: 'x402' },
      { method: 'GET', path: '/api/v1/builder/:id', description: 'Full builder profile', auth: 'x402' },
      { method: 'GET', path: '/api/v1/builders/top', description: 'Top builders leaderboard', auth: 'x402' },
      { method: 'GET', path: '/api/v1/ships/recent', description: 'Recent shipped projects', auth: 'x402' },
      { method: 'GET', path: '/api/v1/trending/topics', description: 'Trending Farcaster topics', auth: 'x402' },
    ],
  },
  {
    id: 'builder-id',
    title: 'Builder ID NFT',
    icon: Zap,
    description: 'Soulbound ERC-721 on Base with dynamic reputation scores. One per Farcaster FID.',
    endpoints: [
      { method: 'GET', path: '/api/builder-id/info', description: 'Contract info and stats', auth: 'none' },
      { method: 'GET', path: '/api/builder-id/check/:fid', description: 'Check if FID has Builder ID', auth: 'none' },
      { method: 'GET', path: '/api/builder-id/:fid', description: 'Get Builder ID record', auth: 'none' },
      { method: 'GET', path: '/api/builder-id/holders', description: 'Top holders with scores', auth: 'none' },
      { method: 'POST', path: '/api/builder-id/claim-message', description: 'Get signature message for claiming', auth: 'none' },
      { method: 'POST', path: '/api/builder-id/claim', description: 'Claim NFT (verify signature, mint)', auth: 'none' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Generation',
    icon: Image,
    description: 'Image generation via Gemini and video generation via WaveSpeedAI.',
    endpoints: [
      { method: 'POST', path: '/api/v1/generate/image', description: 'AI image generation (Gemini)', auth: 'x402' },
      { method: 'POST', path: '/api/v1/generate/video', description: 'AI video generation (WaveSpeed)', auth: 'x402' },
      { method: 'POST', path: '/api/v1/github/analyze', description: 'Repository code analysis', auth: 'x402' },
    ],
  },
  {
    id: 'access',
    title: 'Access & Payments',
    icon: Lock,
    description: 'Check staking tiers, x402 payment info, and rate limits.',
    endpoints: [
      { method: 'GET', path: '/api/access/tier?wallet=0x...', description: 'Check staking tier for wallet', auth: 'none' },
      { method: 'GET', path: '/api/access/payment', description: 'Get x402 payment info and pricing', auth: 'none' },
      { method: 'GET', path: '/api/access/stats', description: 'Tier distribution statistics', auth: 'none' },
      { method: 'GET', path: '/api/hub/stats', description: 'Staking contract statistics', auth: 'none' },
    ],
  },
  {
    id: 'public',
    title: 'Public Endpoints',
    icon: BarChart3,
    description: 'Open endpoints for Fixr stats, ships, and builder feeds. No auth required.',
    endpoints: [
      { method: 'GET', path: '/api/fixr/stats', description: 'Fixr agent statistics', auth: 'none' },
      { method: 'GET', path: '/api/fixr/ships', description: 'Shipped projects list', auth: 'none' },
      { method: 'GET', path: '/api/status', description: 'Agent status & recent tasks', auth: 'none' },
      { method: 'GET', path: '/api/builders/casts', description: 'Recent builder casts', auth: 'none' },
      { method: 'GET', path: '/api/builders/top', description: 'Top builders by shipped count', auth: 'none' },
      { method: 'GET', path: '/api/builders/stats', description: 'Aggregate builder statistics', auth: 'none' },
      { method: 'GET', path: '/api/ships', description: 'Recent shipped projects feed', auth: 'none' },
      { method: 'GET', path: '/api/ships/stats', description: 'Shipping statistics', auth: 'none' },
      { method: 'GET', path: '/api/base-activity/:address', description: 'On-chain activity score (CDP)', auth: 'none' },
    ],
  },
];

/* ── components ────────────────────────────────────────────────────── */

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    POST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PATCH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${colors[method] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="text-gray-500 hover:text-gray-300 transition-colors p-1">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function EndpointRow({ ep }: { ep: Endpoint }) {
  const fullUrl = `${BASE_URL}${ep.path}`;
  return (
    <div className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
      <MethodBadge method={ep.method} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-[12px] text-gray-200 break-all font-mono">{ep.path}</code>
          <CopyButton text={fullUrl} />
          {ep.auth === 'x402' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-red/10 text-accent-red border border-accent-red/20">
              x402
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">{ep.description}</p>
      </div>
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-black/70 backdrop-blur-md shadow-lg shadow-black/20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors text-left"
      >
        <Icon className="w-4 h-4 text-accent-red shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">{section.title}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{section.description}</p>
        </div>
        <span className="text-[10px] text-gray-600 mr-2">{section.endpoints.length}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-600 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-2 py-1 bg-black/50">
          {section.endpoints.map((ep) => (
            <EndpointRow key={`${ep.method}-${ep.path}`} ep={ep} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────── */

export default function DocsPage() {
  return (
    <div className="min-h-screen text-white font-rajdhani relative">
      <CamoBackground />

      {/* PFP Watermark */}
      <div className="fixed inset-0 z-[1] flex items-center justify-center pointer-events-none">
        <img
          src="/fixrpfp.png"
          alt=""
          className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full opacity-[0.04]"
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/60 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fixrpfp.png" alt="Fixr" className="w-5 h-5 rounded-full" />
            FIXR
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/hub"
              className="text-xs px-3 py-1.5 bg-accent-red/10 border border-accent-red/20 hover:bg-accent-red/20 rounded-lg transition-colors text-accent-red flex items-center gap-1.5"
            >
              <Coins className="w-3 h-3" />
              Stake
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2">API Reference</h1>
          <p className="text-sm text-gray-400 mb-2">
            Base URL:{' '}
            <code className="text-accent-red bg-accent-red/5 px-1.5 py-0.5 rounded font-mono">{BASE_URL}</code>
          </p>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
            120+ endpoints for token analysis, security audits, builder reputation, AI generation, and more.
            Access via FIXR staking tiers or pay-per-call with x402 micropayments.
          </p>
        </motion.div>

        {/* x402 Section */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-accent-red" />
            Authentication & Payments
          </h2>

          <div className="border border-white/[0.06] rounded-xl p-5 bg-black/70 backdrop-blur-md shadow-lg shadow-black/20 space-y-5">
            {/* x402 */}
            <div>
              <h3 className="text-sm font-semibold text-accent-red mb-2">x402 Micropayments</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Non-stakers can access protected endpoints by paying <strong className="text-white">$0.01 USDC per request</strong> via
                the x402 protocol. Protected endpoints return <code className="text-accent-red font-mono">402 Payment Required</code> with
                payment instructions. Send USDC on Base and include the tx hash.
              </p>
              <div className="bg-[#0a0a0a] rounded-lg p-3 border border-white/[0.06] font-mono">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">Request</span>
                  <CopyButton text={`curl -X POST ${BASE_URL}/api/v1/token/analyze \\\n  -H "X-Payment-TxHash: 0x..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"address": "0x..."}'`} />
                </div>
                <pre className="text-[11px] text-gray-300 overflow-x-auto">
{`curl -X POST ${BASE_URL}/api/v1/token/analyze \\
  -H "X-Payment-TxHash: 0x..." \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x..."}'`}
                </pre>
              </div>
            </div>

            {/* Staking */}
            <div>
              <h3 className="text-sm font-semibold text-accent-red mb-2">FIXR Staking Tiers</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Stake FIXR tokens on Base to unlock tiered API access. Pass your wallet address
                in the <code className="text-accent-red font-mono">X-Wallet-Address</code> header for automatic tier detection.
              </p>
              <div className="bg-[#0a0a0a] rounded-lg p-3 border border-white/[0.06] mb-3 font-mono">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600">Request</span>
                  <CopyButton text={`curl ${BASE_URL}/api/v1/builders/top \\\n  -H "X-Wallet-Address: 0xYourWallet"`} />
                </div>
                <pre className="text-[11px] text-gray-300 overflow-x-auto">
{`curl ${BASE_URL}/api/v1/builders/top \\
  -H "X-Wallet-Address: 0xYourWallet"`}
                </pre>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {TIERS.map((tier) => (
                  <div key={tier.name} className="bg-black/50 border border-white/[0.06] rounded-lg p-3 text-center">
                    <div className="text-xs font-bold text-accent-red mb-1">{tier.name}</div>
                    <div className="text-[10px] text-gray-400 mb-1">{tier.stake}</div>
                    <div className="text-[10px] text-gray-600">{tier.rate}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contracts */}
            <div>
              <h3 className="text-sm font-semibold text-accent-red mb-2">Contracts (Base)</h3>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">FIXR Token</span>
                  <div className="flex items-center gap-1">
                    <code className="text-gray-300 font-mono">0x8cBb...1610</code>
                    <a href="https://basescan.org/address/0x8cBb89d67fDA00E26aEd0Fc02718821049b41610" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-accent-red transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Staking</span>
                  <div className="flex items-center gap-1">
                    <code className="text-gray-300 font-mono">0x39Db...3F5b</code>
                    <a href="https://basescan.org/address/0x39DbBa2CdAF7F668816957B023cbee1841373F5b" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-accent-red transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Fee Splitter</span>
                  <div className="flex items-center gap-1">
                    <code className="text-gray-300 font-mono">0x5bE1...c928</code>
                    <a href="https://basescan.org/address/0x5bE1B904ce0Efbb2CC963aFd6E976f8F93AdC928" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-accent-red transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Builder ID NFT</span>
                  <div className="flex items-center gap-1">
                    <code className="text-gray-300 font-mono">0x15ce...dcec</code>
                    <a href="https://basescan.org/address/0x15ced288ada7d9e8a03fd8af0e5c475f4b60dcec" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-accent-red transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Supported Networks */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="border border-white/[0.06] rounded-xl p-4 bg-black/70 backdrop-blur-md shadow-lg shadow-black/20">
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Supported Networks</h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Token data:</strong> eth, base, solana, arbitrum, optimism, polygon, avax, bsc, fantom, monad + 200 more via GeckoTerminal.{' '}
              <strong className="text-gray-400">Data sources:</strong> GeckoTerminal (price/liquidity), GoPlus (security), Alchemy (holders/NFTs), DefiLlama (TVL).
            </p>
          </div>
        </motion.div>

        {/* Endpoint Sections */}
        <motion.div
          className="mt-10 space-y-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-lg font-bold mb-4">Endpoints</h2>
          {SECTIONS.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
        </motion.div>

        {/* XMTP */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <h2 className="text-lg font-bold mb-4">Chat Interface</h2>
          <div className="border border-white/[0.06] rounded-xl p-5 bg-black/70 backdrop-blur-md shadow-lg shadow-black/20">
            <h3 className="text-sm font-semibold text-accent-red mb-2">XMTP Agent</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              DM <code className="text-accent-red font-mono">fixr.base.eth</code> on{' '}
              <a href="https://xmtp.chat/dm/fixr.base.eth" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-accent-red underline underline-offset-2 transition-colors">
                XMTP
              </a>{' '}
              for conversational access to all capabilities.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-black/50 border border-white/[0.06] rounded-lg p-2.5">
                <code className="text-gray-300 font-mono">0x1234...</code>
                <p className="text-gray-600 mt-0.5">Token analysis</p>
              </div>
              <div className="bg-black/50 border border-white/[0.06] rounded-lg p-2.5">
                <code className="text-gray-300 font-mono">trending sol</code>
                <p className="text-gray-600 mt-0.5">Trending pools</p>
              </div>
              <div className="bg-black/50 border border-white/[0.06] rounded-lg p-2.5">
                <code className="text-gray-300 font-mono">audit</code>
                <p className="text-gray-600 mt-0.5">Security scanning</p>
              </div>
              <div className="bg-black/50 border border-white/[0.06] rounded-lg p-2.5">
                <code className="text-gray-300 font-mono">help</code>
                <p className="text-gray-600 mt-0.5">All commands</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-white/[0.06] text-center">
          <p className="text-[10px] text-gray-600">
            Built autonomously by{' '}
            <a href="https://warpcast.com/fixr" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-accent-red transition-colors">
              Fixr
            </a>{' '}
            · Powered by{' '}
            <a href="https://anthropic.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-accent-red transition-colors">
              Claude
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
