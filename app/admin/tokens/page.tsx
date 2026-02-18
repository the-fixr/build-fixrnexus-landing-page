'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAccount, useWalletClient } from 'wagmi';
import {
  RocketLaunchIcon,
  CurrencyDollarIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  PhotoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, ActionButton, StatCard, StatusBadge } from '@/components/admin';
import {
  launchToken,
  getTokenStats,
  getCreatorRevenueFormatted,
  withdrawRevenue,
  type LaunchParams,
  type LaunchedToken,
} from '@/lib/flaunch';

type Tab = 'launch' | 'manage';

interface TokenWithLive extends LaunchedToken {
  priceUSD?: string | null;
  marketCap?: string | null;
  fairLaunchActive?: boolean | null;
}

interface FormState {
  name: string;
  symbol: string;
  description: string;
  base64Image: string;
  fairLaunchPercent: number;
  fairLaunchDuration: number;
  initialMarketCapUSD: number;
  creatorFeePercent: number;
  websiteUrl: string;
  twitterUrl: string;
  discordUrl: string;
  telegramUrl: string;
}

const DEFAULT_FORM: FormState = {
  name: '', symbol: '', description: '', base64Image: '',
  fairLaunchPercent: 50, fairLaunchDuration: 1800,
  initialMarketCapUSD: 5000, creatorFeePercent: 80,
  websiteUrl: '', twitterUrl: '', discordUrl: '', telegramUrl: '',
};

export default function TokensPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: 8453 });
  const [activeTab, setActiveTab] = useState<Tab>('launch');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tokens</h1>
        <p className="text-gray-400 text-sm mt-1">Launch tokens on Base via Flaunch and manage revenue</p>
      </div>

      <div className="flex gap-2 p-1 bg-gray-900/50 border border-gray-800 rounded-xl">
        {([
          { key: 'launch' as Tab, label: 'Launch Token', icon: RocketLaunchIcon },
          { key: 'manage' as Tab, label: 'Manage Tokens', icon: CurrencyDollarIcon },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'launch' ? (
          <motion.div key="launch" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <LaunchTokenTab address={address} walletClient={walletClient} />
          </motion.div>
        ) : (
          <motion.div key="manage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ManageTokensTab address={address} walletClient={walletClient} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LaunchTokenTab({ address, walletClient }: { address?: `0x${string}`; walletClient?: any }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showPreview, setShowPreview] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [showSocials, setShowSocials] = useState(false);
  const [result, setResult] = useState<{ txHash: string; memecoin: string; tokenId: string } | null>(null);

  const set = (k: keyof FormState, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => set('base64Image', reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePreview = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.symbol.trim()) { toast.error('Symbol is required'); return; }
    if (!form.base64Image) { toast.error('Image is required'); return; }
    setShowPreview(true);
  };

  const handleLaunch = async () => {
    if (!walletClient || !address) { toast.error('Wallet not connected'); return; }
    setIsLaunching(true);
    try {
      const params: LaunchParams = {
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim(),
        base64Image: form.base64Image,
        fairLaunchPercent: form.fairLaunchPercent,
        fairLaunchDuration: form.fairLaunchDuration,
        initialMarketCapUSD: form.initialMarketCapUSD,
        creator: address,
        creatorFeeAllocationPercent: form.creatorFeePercent,
        websiteUrl: form.websiteUrl || undefined,
        twitterUrl: form.twitterUrl || undefined,
        discordUrl: form.discordUrl || undefined,
        telegramUrl: form.telegramUrl || undefined,
      };
      const res = await launchToken(walletClient, params);
      await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': address },
        body: JSON.stringify({
          address: res.memecoin, tokenId: res.tokenId, name: params.name, symbol: params.symbol,
          txHash: res.txHash, description: params.description, fairLaunchPercent: params.fairLaunchPercent,
          fairLaunchDuration: params.fairLaunchDuration, initialMarketCapUSD: params.initialMarketCapUSD,
          creatorFeePercent: params.creatorFeeAllocationPercent,
        }),
      });
      setResult(res);
      toast.success('Token launched successfully!');
    } catch (err) {
      toast.error((err instanceof Error ? err.message : String(err)).slice(0, 200));
    } finally {
      setIsLaunching(false);
    }
  };

  if (result) {
    return (
      <AdminCard>
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
            <RocketLaunchIcon className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-green-400">Token Launched!</h2>
            <p className="text-sm text-gray-400 mt-1">Your token is now live on Base</p>
          </div>
          <div className="space-y-3 text-left max-w-md mx-auto">
            {[
              { label: 'Token Address', value: result.memecoin, link: `https://basescan.org/token/${result.memecoin}` },
              { label: 'Flaunch NFT ID', value: result.tokenId },
              { label: 'Tx Hash', value: result.txHash, link: `https://basescan.org/tx/${result.txHash}` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl">
                <span className="text-sm text-gray-400">{item.label}</span>
                {item.link ? (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    {item.value.slice(0, 10)}...{item.value.slice(-6)}
                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-sm text-white font-mono">{item.value}</span>
                )}
              </div>
            ))}
          </div>
          <ActionButton onClick={() => { setResult(null); setShowPreview(false); setForm(DEFAULT_FORM); }} variant="secondary">Launch Another</ActionButton>
        </div>
      </AdminCard>
    );
  }

  if (showPreview) {
    return (
      <AdminCard title="Review Launch">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            {form.base64Image && <img src={form.base64Image} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-700" />}
            <div>
              <div className="text-lg font-bold text-white">{form.name}</div>
              <div className="text-sm text-gray-500">${form.symbol.toUpperCase()}</div>
            </div>
          </div>
          {form.description && <p className="text-sm text-gray-400">{form.description}</p>}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Fair Launch', value: `${form.fairLaunchPercent}% / ${form.fairLaunchDuration / 60}min` },
              { label: 'Initial MCap', value: `$${form.initialMarketCapUSD.toLocaleString()}` },
              { label: 'Creator Fee', value: `${form.creatorFeePercent}%` },
              { label: 'Community', value: `${100 - form.creatorFeePercent}%` },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-gray-800/30 rounded-xl">
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="text-sm font-medium text-white mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <ActionButton variant="secondary" onClick={() => setShowPreview(false)} className="flex-1">Back</ActionButton>
            <ActionButton onClick={handleLaunch} loading={isLaunching} disabled={isLaunching} className="flex-1">{isLaunching ? 'Launching...' : 'Confirm Launch'}</ActionButton>
          </div>
        </div>
      </AdminCard>
    );
  }

  const inputCls = 'w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-colors';

  return (
    <div className="space-y-6">
      <AdminCard title="Token Details" subtitle="Name, symbol, image, and description">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Name</label>
              <input className={inputCls} placeholder="Fixr" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Symbol</label>
              <input className={inputCls} placeholder="FIXR" value={form.symbol} onChange={(e) => set('symbol', e.target.value)} maxLength={10} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="What does this token represent?" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Image (max 2MB)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="w-full h-24 border border-dashed border-gray-700 rounded-xl flex items-center justify-center hover:border-purple-500/50 transition-colors overflow-hidden">
              {form.base64Image ? <img src={form.base64Image} alt="preview" className="h-full object-contain" /> : (
                <div className="text-center"><PhotoIcon className="w-6 h-6 mx-auto text-gray-600 mb-1" /><span className="text-xs text-gray-500">Click to upload</span></div>
              )}
            </button>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Launch Settings" subtitle="Fair launch, pricing, and fee allocation">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fair Launch % (of supply)</label>
            <input type="number" className={inputCls} min={0} max={100} value={form.fairLaunchPercent} onChange={(e) => set('fairLaunchPercent', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Duration (seconds)</label>
            <input type="number" className={inputCls} min={0} value={form.fairLaunchDuration} onChange={(e) => set('fairLaunchDuration', Number(e.target.value))} />
            <div className="text-[10px] text-gray-600 mt-1">{(form.fairLaunchDuration / 60).toFixed(0)} min</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Initial Market Cap (USD)</label>
            <input type="number" className={inputCls} min={100} value={form.initialMarketCapUSD} onChange={(e) => set('initialMarketCapUSD', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Creator Fee %</label>
            <input type="number" className={inputCls} min={0} max={100} value={form.creatorFeePercent} onChange={(e) => set('creatorFeePercent', Number(e.target.value))} />
            <div className="text-[10px] text-gray-600 mt-1">{100 - form.creatorFeePercent}% to community buyback</div>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <button onClick={() => setShowSocials(!showSocials)} className="flex items-center justify-between w-full">
          <div>
            <h3 className="text-lg font-bold text-white">Social Links</h3>
            <p className="text-sm text-gray-400 mt-0.5">Optional metadata for the token</p>
          </div>
          {showSocials ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
        </button>
        <AnimatePresence>
          {showSocials && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-3 pt-4">
                {[
                  { key: 'websiteUrl' as const, label: 'Website', placeholder: 'https://...' },
                  { key: 'twitterUrl' as const, label: 'Twitter/X', placeholder: 'https://x.com/...' },
                  { key: 'discordUrl' as const, label: 'Discord', placeholder: 'https://discord.gg/...' },
                  { key: 'telegramUrl' as const, label: 'Telegram', placeholder: 'https://t.me/...' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs text-gray-400 mb-1.5">{field.label}</label>
                    <input className={inputCls} placeholder={field.placeholder} value={form[field.key]} onChange={(e) => set(field.key, e.target.value)} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AdminCard>

      <ActionButton onClick={handlePreview} disabled={!form.name || !form.symbol || !form.base64Image} className="w-full" size="lg">Preview Launch</ActionButton>
    </div>
  );
}

function ManageTokensTab({ address, walletClient }: { address?: `0x${string}`; walletClient?: any }) {
  const [tokens, setTokens] = useState<TokenWithLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState('0');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchTokens = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch('/api/admin/tokens', { headers: { 'x-wallet-address': address } });
      if (!res.ok) return;
      const data = await res.json();
      const enriched: TokenWithLive[] = await Promise.all(
        (data.tokens || []).map(async (t: LaunchedToken) => {
          try {
            const stats = await getTokenStats(t.address as `0x${string}`);
            return { ...t, priceUSD: stats.priceUSD != null ? String(stats.priceUSD) : null, marketCap: stats.marketCap != null ? String(stats.marketCap) : null, fairLaunchActive: stats.fairLaunchActive };
          } catch { return t; }
        }),
      );
      setTokens(enriched);
      const rev = await getCreatorRevenueFormatted(address);
      setTotalRevenue(rev);
    } catch (err) {
      console.error('[admin/tokens] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const handleWithdraw = async () => {
    if (!walletClient || !address) return;
    setWithdrawing(true);
    try {
      await withdrawRevenue(walletClient, address);
      toast.success('Revenue withdrawn');
      await fetchTokens();
    } catch (err) {
      toast.error((err instanceof Error ? err.message : String(err)).slice(0, 200));
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <AdminCard key={i}><div className="animate-pulse space-y-3"><div className="h-4 w-32 bg-gray-700 rounded" /><div className="h-6 w-48 bg-gray-700 rounded" /></div></AdminCard>
        ))}
      </div>
    );
  }

  const revenueNum = Number(totalRevenue);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Tokens Launched" value={tokens.length} color="purple" icon={<RocketLaunchIcon className="w-5 h-5" />} />
        <StatCard label="Creator Revenue" value={revenueNum} suffix=" ETH" color={revenueNum > 0 ? 'green' : 'default'} icon={<BanknotesIcon className="w-5 h-5" />} />
      </div>

      {revenueNum > 0 && (
        <ActionButton onClick={handleWithdraw} loading={withdrawing} variant="success" className="w-full">
          Withdraw All Revenue ({revenueNum.toFixed(6)} ETH)
        </ActionButton>
      )}

      {tokens.length === 0 ? (
        <AdminCard>
          <div className="text-center py-8">
            <RocketLaunchIcon className="w-12 h-12 mx-auto text-gray-700 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Tokens Yet</h3>
            <p className="text-sm text-gray-400">Switch to the Launch Token tab to create your first token on Flaunch.</p>
          </div>
        </AdminCard>
      ) : (
        tokens.map((token) => (
          <motion.div key={token.address} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <AdminCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                    <CurrencyDollarIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="text-base font-bold text-white">{token.name}</span>
                    <span className="text-sm text-gray-500 ml-2">${token.symbol}</span>
                  </div>
                </div>
                {token.fairLaunchActive === true && <StatusBadge status="active" pulse size="sm" />}
                {token.fairLaunchActive === false && <StatusBadge status="completed" size="sm" />}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-gray-800/30 rounded-xl">
                  <div className="text-xs text-gray-500">Price</div>
                  <div className="text-sm font-medium text-white mt-0.5">{token.priceUSD != null ? `$${Number(token.priceUSD).toFixed(6)}` : '--'}</div>
                </div>
                <div className="p-3 bg-gray-800/30 rounded-xl">
                  <div className="text-xs text-gray-500">Market Cap</div>
                  <div className="text-sm font-medium text-white mt-0.5">{token.marketCap != null ? `$${Number(token.marketCap).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--'}</div>
                </div>
                <div className="p-3 bg-gray-800/30 rounded-xl">
                  <div className="text-xs text-gray-500">Creator Fee</div>
                  <div className="text-sm font-medium text-white mt-0.5">{token.creatorFeePercent}%</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Launched {new Date(token.launchedAt).toLocaleDateString()}</span>
                <a href={`https://basescan.org/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 font-mono flex items-center gap-1">
                  {token.address.slice(0, 8)}...{token.address.slice(-4)}
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>
            </AdminCard>
          </motion.div>
        ))
      )}

      <ActionButton variant="ghost" onClick={() => { setLoading(true); fetchTokens(); }} className="w-full" icon={<ArrowPathIcon className="w-4 h-4" />}>Refresh</ActionButton>
    </div>
  );
}
