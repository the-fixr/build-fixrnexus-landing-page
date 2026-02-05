'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  WalletIcon,
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { AdminCard, ActionButton, StatCard, StatusBadge } from '../../components/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://fixr-workers.jumpboxlabs.workers.dev';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Transaction {
  hash: string;
  type: 'send' | 'receive' | 'stake' | 'unstake';
  amount: string;
  token: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export default function WalletPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [tier, setTier] = useState<string>('FREE');

  const { data: agentMetadata } = useSWR(
    `${API_BASE}/api/agent/metadata`,
    fetcher
  );

  const agentWallet = agentMetadata?.wallet || {
    address: '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4',
    balance: '0',
  };

  // Mock transactions for display
  const transactions: Transaction[] = [
    {
      hash: '0x1234...5678',
      type: 'receive',
      amount: '100',
      token: 'FIXR',
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    },
    {
      hash: '0x2345...6789',
      type: 'send',
      amount: '50',
      token: 'USDC',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      status: 'confirmed',
    },
    {
      hash: '0x3456...7890',
      type: 'stake',
      amount: '1000',
      token: 'FIXR',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      status: 'confirmed',
    },
  ];

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Check if ethereum provider exists
      if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
        const accounts = await (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts[0]) {
          setConnectedAddress(accounts[0]);
          toast.success('Wallet connected');
          // Determine tier based on holdings (mock)
          setTier('BUILDER');
        }
      } else {
        toast.error('No wallet found. Please install MetaMask.');
      }
    } catch (error) {
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnectedAddress(null);
    setTier('FREE');
    toast.success('Wallet disconnected');
  };

  const formatAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-gray-400 text-sm mt-1">
          Connect wallet and manage FIXR tokens
        </p>
      </div>

      {/* Connection Status */}
      <AdminCard>
        {connectedAddress ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <WalletIcon className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Connected Wallet</p>
                <p className="text-lg font-bold text-white font-mono">
                  {formatAddress(connectedAddress)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">Access Tier</p>
                <StatusBadge status={tier.toLowerCase()} />
              </div>
              <ActionButton variant="ghost" onClick={handleDisconnect}>
                Disconnect
              </ActionButton>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <WalletIcon className="w-12 h-12 mx-auto text-gray-700 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
              Connect your wallet to access admin features based on your FIXR token holdings
            </p>
            <ActionButton onClick={handleConnect} loading={isConnecting}>
              Connect Wallet
            </ActionButton>
          </div>
        )}
      </AdminCard>

      {/* Access Tiers */}
      <AdminCard title="Access Tiers" subtitle="Token requirements for admin access">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'FREE', tokens: '0', features: ['View dashboard', 'Basic stats'] },
            { name: 'BUILDER', tokens: '100', features: ['All FREE features', 'Create tasks', 'View analytics'] },
            { name: 'PRO', tokens: '1,000', features: ['All BUILDER features', 'Social posting', 'Video generation'] },
            { name: 'ELITE', tokens: '10,000', features: ['All PRO features', 'Full config access', 'API access'] },
          ].map((tierInfo) => (
            <motion.div
              key={tierInfo.name}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-xl border ${
                tier === tierInfo.name
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : 'bg-gray-800/30 border-gray-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-white">{tierInfo.name}</h4>
                {tier === tierInfo.name && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-medium rounded">
                    CURRENT
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-purple-400 mb-3">
                {tierInfo.tokens}
                <span className="text-sm text-gray-500 ml-1">FIXR</span>
              </p>
              <ul className="space-y-1">
                {tierInfo.features.map((feature) => (
                  <li key={feature} className="text-xs text-gray-400 flex items-center gap-1.5">
                    <ShieldCheckIcon className="w-3 h-3 text-green-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </AdminCard>

      {/* Agent Wallet */}
      <AdminCard title="Agent Wallet" subtitle="Fixr's on-chain wallet">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="p-4 bg-gray-800/30 rounded-xl">
            <p className="text-sm text-gray-400 mb-1">Address</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-white font-mono truncate">
                {agentWallet.address}
              </p>
              <a
                href={`https://basescan.org/address/${agentWallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-500 hover:text-white" />
              </a>
            </div>
          </div>
          <div className="p-4 bg-gray-800/30 rounded-xl">
            <p className="text-sm text-gray-400 mb-1">ETH Balance</p>
            <p className="text-2xl font-bold text-white">
              {parseFloat(agentWallet.balance || '0').toFixed(4)}
              <span className="text-sm text-gray-500 ml-2">ETH</span>
            </p>
          </div>
        </div>
      </AdminCard>

      {/* FIXR Token Info */}
      <AdminCard
        title="FIXR Token"
        subtitle="Token is not yet live - coming later this month"
      >
        <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <CurrencyDollarIcon className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">$FIXR Coming Soon</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            The FIXR token will enable governance, staking rewards, and premium features.
            Token launch is planned for later this month.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <ActionButton variant="secondary" disabled>
              Stake FIXR
            </ActionButton>
            <ActionButton disabled>
              Buy FIXR
            </ActionButton>
          </div>
        </div>
      </AdminCard>

      {/* Recent Transactions */}
      <AdminCard title="Recent Transactions" subtitle="Agent wallet activity">
        <div className="space-y-3">
          {transactions.map((tx) => (
            <motion.div
              key={tx.hash}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    tx.type === 'receive' || tx.type === 'unstake'
                      ? 'bg-green-500/10'
                      : 'bg-red-500/10'
                  }`}
                >
                  {tx.type === 'receive' || tx.type === 'unstake' ? (
                    <ArrowDownIcon className="w-4 h-4 text-green-400" />
                  ) : (
                    <ArrowUpIcon className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-white capitalize">{tx.type}</p>
                  <p className="text-xs text-gray-500">{tx.hash}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`font-bold ${
                    tx.type === 'receive' || tx.type === 'unstake'
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {tx.type === 'receive' || tx.type === 'unstake' ? '+' : '-'}
                  {tx.amount} {tx.token}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(tx.timestamp).toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
