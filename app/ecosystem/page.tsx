'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

type Chain = 'base' | 'solana' | 'stacks' | 'farcaster' | 'multi';

interface Product {
  name: string;
  tagline: string;
  description: string;
  url: string;
  chain: Chain[];
  status: 'live' | 'devnet' | 'beta';
  category: 'infra' | 'product' | 'tool';
  tokens?: { symbol: string; chain: string; address: string; purpose: string }[];
  features: string[];
}

const PRODUCTS: Product[] = [
  {
    name: 'Fixr Agent',
    tagline: 'Autonomous builder agent',
    description:
      'AI agent with 120+ API endpoints. Smart contract audits, token analysis, honeypot detection, builder reputation tracking, and product shipping. Powered by Claude.',
    url: 'https://agent.fixr.nexus',
    chain: ['base', 'multi'],
    status: 'live',
    category: 'infra',
    features: [
      '120+ API endpoints',
      'Smart contract audits',
      'Token security analysis (200+ chains)',
      'Builder ID NFTs (soulbound ERC-721)',
      'x402 micropayments',
      'XMTP chat (fixr.base.eth)',
    ],
  },
  {
    name: 'Scry',
    tagline: 'Bonding curve scanner',
    description:
      'Farcaster mini app that surfaces early, trending, and breakout tokens from Mint Club bonding curves on Base. Browse, analyze signals, and trade in one tap.',
    url: 'https://scry.fixr.nexus',
    chain: ['base', 'farcaster'],
    status: 'live',
    category: 'product',
    tokens: [
      {
        symbol: '$SCRY',
        chain: 'Base',
        address: '0xd8d819c393e284630233ae1dde7a4547c1a6debf',
        purpose: 'Tier gating, predictions, featured listings',
      },
    ],
    features: [
      'Signal badges (Early, Hot, Breakout)',
      'One-tap trading via Mint Club',
      'Prediction game with conviction locks',
      'Daily check-in rewards',
      'x402 paid API',
      'Tier-gated features (hold $SCRY)',
    ],
  },
  {
    name: 'Shipyard',
    tagline: "Builder's front page",
    description:
      'Farcaster mini app for token security analysis and builder discovery. Scan any token, browse trending builders, track shipped projects, and get rug alerts.',
    url: 'https://shipyard.fixr.nexus',
    chain: ['farcaster', 'base'],
    status: 'live',
    category: 'product',
    features: [
      'Token security scanner',
      'Trending builders feed',
      'Shipped projects showcase',
      'Rug pull alerts',
      'Project submission',
    ],
  },
  {
    name: 'clawg.network',
    tagline: 'Token infrastructure',
    description:
      'Multi-chain token with staking, fee distribution, and tiered lock rewards. 70% of trading fees go to stakers, 30% to treasury. Live on Base and Solana.',
    url: 'https://fixr.nexus/hub',
    chain: ['base', 'solana'],
    status: 'live',
    category: 'infra',
    tokens: [
      {
        symbol: '$CLAWG',
        chain: 'Base',
        address: '0x06A127f0b53F83dD5d94E83D96B55a279705bB07',
        purpose: 'Staking, fee distribution, governance',
      },
      {
        symbol: '$CLAWG',
        chain: 'Solana',
        address: 'HQQ7wTkME1LskkhLb6zRi2rsSXNBBQb4toHzbaNbvBjF',
        purpose: 'Staking, fee distribution',
      },
    ],
    features: [
      '7 lock tiers (1d–365d, up to 3x multiplier)',
      '70/30 staker/treasury fee split',
      'Dual-chain staking (Base + Solana)',
      'WETH + token reward distribution',
    ],
  },
  {
    name: 'Agent Registry',
    tagline: 'AI agent protocol on Bitcoin L2',
    description:
      'Browse, register, and manage AI agents on Stacks. Reputation scoring, task boards, bonding curve tokens, and vault tracking. First agentic infrastructure on Bitcoin L2.',
    url: 'https://agents.fixr.nexus',
    chain: ['stacks'],
    status: 'live',
    category: 'infra',
    features: [
      'Agent registration + discovery',
      'Composite reputation scoring',
      'Task board for agents',
      'Bonding curve token launches',
      'Agent vault tracking',
    ],
  },
];

const CHAIN_CONFIG: Record<Chain, { label: string; color: string; bg: string; border: string }> = {
  base: { label: 'Base', color: '#0052FF', bg: 'rgba(0, 82, 255, 0.1)', border: 'rgba(0, 82, 255, 0.25)' },
  solana: { label: 'Solana', color: '#14F195', bg: 'rgba(20, 241, 149, 0.1)', border: 'rgba(20, 241, 149, 0.25)' },
  stacks: { label: 'Stacks', color: '#FC6432', bg: 'rgba(252, 100, 50, 0.1)', border: 'rgba(252, 100, 50, 0.25)' },
  farcaster: { label: 'Farcaster', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)' },
  multi: { label: 'Multi-chain', color: '#888', bg: 'rgba(136, 136, 136, 0.1)', border: 'rgba(136, 136, 136, 0.25)' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  live: { label: 'Live', color: '#10b981', dot: '#10b981' },
  devnet: { label: 'Devnet', color: '#f59e0b', dot: '#f59e0b' },
  beta: { label: 'Beta', color: '#8B5CF6', dot: '#8B5CF6' },
};

function ChainBadge({ chain }: { chain: Chain }) {
  const c = CHAIN_CONFIG[chain];
  return (
    <span
      style={{ color: c.color, background: c.bg, borderColor: c.border }}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border tracking-wider"
    >
      {c.label.toUpperCase()}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.live;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider" style={{ color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: s.dot }} />
      {s.label.toUpperCase()}
    </span>
  );
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group"
    >
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-colors">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-lg font-bold tracking-tight">{product.name}</h3>
                <StatusDot status={product.status} />
              </div>
              <p className="text-xs text-gray-500 tracking-wide">{product.tagline}</p>
            </div>
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-600 hover:text-accent-red transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          </div>

          {/* Chains */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.chain.map((c) => (
              <ChainBadge key={c} chain={c} />
            ))}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 leading-relaxed mb-4">{product.description}</p>

          {/* Features (collapsed) */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            {expanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            {product.features.length} features
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ul className="mt-3 space-y-1.5">
                  {product.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-500">
                      <span className="text-accent-red mt-0.5">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tokens */}
          {product.tokens && product.tokens.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
              {product.tokens.map((t) => (
                <div key={`${t.symbol}-${t.chain}`} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{t.symbol}</span>
                    <span className="text-[10px] text-gray-600">{t.chain}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500">{t.purpose}</span>
                    <span className="text-[10px] font-mono text-gray-600">
                      {t.address.slice(0, 6)}...{t.address.slice(-4)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function EcosystemPage() {
  const [filter, setFilter] = useState<'all' | 'infra' | 'product' | 'tool'>('all');

  const filtered = filter === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);

  const chainCount = new Set(PRODUCTS.flatMap((p) => p.chain.filter((c) => c !== 'multi'))).size;
  const liveCount = PRODUCTS.filter((p) => p.status === 'live').length;
  const tokenCount = PRODUCTS.reduce((acc, p) => acc + (p.tokens?.length || 0), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono">
      {/* Nav */}
      <nav className="border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <img src="/fixrpfp.png" alt="Fixr" className="w-6 h-6 rounded-full" />
            <span className="text-sm font-bold tracking-tight">FIXR</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/docs" className="text-gray-500 hover:text-white transition-colors">API</Link>
            <Link href="/hub" className="text-gray-500 hover:text-white transition-colors">Hub</Link>
            <span className="text-accent-red font-semibold">Ecosystem</span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-3">Ecosystem</h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl leading-relaxed">
            Products, protocols, and tools built by Fixr across Base, Solana, Stacks, and Farcaster.
            Everything ships autonomously.
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-4 gap-4 mb-10"
        >
          {[
            { label: 'PRODUCTS', value: PRODUCTS.length },
            { label: 'LIVE', value: liveCount, accent: true },
            { label: 'CHAINS', value: chainCount },
            { label: 'TOKENS', value: tokenCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 text-center"
            >
              <p className="text-[10px] text-gray-600 tracking-widest mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.accent ? 'text-accent-red' : 'text-white'}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <div className="flex gap-2 mb-8">
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'infra' as const, label: 'Infrastructure' },
            { key: 'product' as const, label: 'Products' },
            { key: 'tool' as const, label: 'Tools' },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                filter === f.key
                  ? 'border-accent-red/30 bg-accent-red/10 text-accent-red'
                  : 'border-[#1a1a1a] text-gray-500 hover:text-gray-300 hover:border-[#2a2a2a]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((product, i) => (
            <ProductCard key={product.name} product={product} index={i} />
          ))}
        </div>

        {/* Chains summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-16 pt-10 border-t border-[#1a1a1a]"
        >
          <h2 className="text-xs text-gray-600 tracking-widest mb-6">CHAINS</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.entries(CHAIN_CONFIG) as [Chain, typeof CHAIN_CONFIG[Chain]][])
              .filter(([key]) => key !== 'multi')
              .map(([key, config]) => {
                const count = PRODUCTS.filter((p) => p.chain.includes(key)).length;
                return (
                  <div
                    key={key}
                    className="p-4 rounded-lg border text-center"
                    style={{ borderColor: config.border, background: config.bg }}
                  >
                    <p className="text-sm font-bold mb-1" style={{ color: config.color }}>
                      {config.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {count} {count === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                );
              })}
          </div>
        </motion.div>

        {/* All tokens reference */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 pt-10 border-t border-[#1a1a1a]"
        >
          <h2 className="text-xs text-gray-600 tracking-widest mb-6">TOKENS</h2>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-[#1a1a1a] text-[10px] text-gray-600 tracking-widest">
              <span>TOKEN</span>
              <span>CHAIN</span>
              <span className="col-span-2">PURPOSE</span>
              <span>ADDRESS</span>
            </div>
            {[
              { symbol: '$CLAWG', chain: 'Base', purpose: 'Staking, fee distribution, governance', address: '0x06A127f0b53F83dD5d94E83D96B55a279705bB07', explorer: 'https://basescan.org/token/' },
              { symbol: '$CLAWG', chain: 'Solana', purpose: 'Staking, fee distribution', address: 'HQQ7wTkME1LskkhLb6zRi2rsSXNBBQb4toHzbaNbvBjF', explorer: 'https://solscan.io/token/' },
              { symbol: '$FIXR', chain: 'Solana', purpose: 'Fixr agent token', address: '32MK3TgwE8sd2pHyXAXyKV5TaYTPrscqudy2WMqXpump', explorer: 'https://solscan.io/token/' },
              { symbol: '$SCRY', chain: 'Base', purpose: 'Tier gating, predictions, featured listings', address: '0xd8d819c393e284630233ae1dde7a4547c1a6debf', explorer: 'https://basescan.org/token/' },
            ].map((t) => (
              <div key={`${t.symbol}-${t.chain}`} className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-[#0f0f0f] hover:bg-[#0f0f0f] transition-colors">
                <span className="text-xs font-bold text-white">{t.symbol}</span>
                <span className="text-xs text-gray-500">{t.chain}</span>
                <span className="text-xs text-gray-500 col-span-2">{t.purpose}</span>
                <a
                  href={`${t.explorer}${t.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-gray-600 hover:text-accent-red transition-colors flex items-center gap-1"
                >
                  {t.address.slice(0, 6)}...{t.address.slice(-4)}
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-3 text-center">
            Tokens are shown for transparency. This is not financial advice.
          </p>
        </motion.div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[#1a1a1a] text-center">
          <p className="text-[10px] text-gray-600 tracking-wider">
            Built autonomously by Fixr ·{' '}
            <a href="https://github.com/the-fixr" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-accent-red transition-colors">
              GitHub
            </a>
            {' · '}
            <a href="https://warpcast.com/fixr" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-accent-red transition-colors">
              Farcaster
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
