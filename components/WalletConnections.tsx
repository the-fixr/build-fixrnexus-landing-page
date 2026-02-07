'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Wallet, Trash2, Star } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface WalletConnection {
  id: string;
  wallet_address: string;
  chain_id: number;
  is_primary: boolean;
  connected_at: string;
  last_used_at: string;
}

export default function WalletConnections() {
  const [wallets, setWallets] = useState<WalletConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const supabase = createClient();

  useEffect(() => {
    loadWallets();
  }, []);

  useEffect(() => {
    if (isConnected && address && chain) {
      handleWalletConnected(address, chain.id);
    }
  }, [isConnected, address, chain]);

  const loadWallets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('wallet_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('connected_at', { ascending: false });

      if (error) throw error;

      setWallets(data || []);
    } catch (error) {
      console.error('Error loading wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletConnected = async (walletAddress: string, chainId: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      // Check if wallet already exists
      const { data: existing } = await supabase
        .from('wallet_connections')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .eq('chain_id', chainId)
        .single();

      if (existing) {
        // Update last_used_at
        await supabase
          .from('wallet_connections')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', existing.id);

        setMessage('Wallet already connected');
      } else {
        // Insert new wallet connection
        const { error } = await supabase
          .from('wallet_connections')
          .insert({
            user_id: user.id,
            wallet_address: walletAddress.toLowerCase(),
            chain_id: chainId,
            is_primary: wallets.length === 0, // First wallet is primary
          });

        if (error) throw error;

        setMessage('Wallet connected successfully');
        await loadWallets();
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to connect wallet');
    }
  };

  const setPrimaryWallet = async (walletId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      // Set all wallets to non-primary
      await supabase
        .from('wallet_connections')
        .update({ is_primary: false })
        .eq('user_id', user.id);

      // Set selected wallet as primary
      const { error } = await supabase
        .from('wallet_connections')
        .update({ is_primary: true })
        .eq('id', walletId);

      if (error) throw error;

      setMessage('Primary wallet updated');
      await loadWallets();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to set primary wallet');
    }
  };

  const removeWallet = async (walletId: string) => {
    if (!confirm('Are you sure you want to remove this wallet?')) return;

    try {
      const { error } = await supabase
        .from('wallet_connections')
        .delete()
        .eq('id', walletId);

      if (error) throw error;

      setMessage('Wallet removed');
      await loadWallets();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to remove wallet');
    }
  };

  const getChainName = (chainId: number) => {
    const chains: Record<number, string> = {
      8453: 'Base',
      1: 'Ethereum',
      10: 'Optimism',
      42161: 'Arbitrum',
      137: 'Polygon',
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
        <p className="text-gray-500">Loading wallets...</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '32px' }}>
        <div className="flex items-center">
          <Wallet size={24} style={{ color: 'rgb(255, 0, 110)' }} />
          <h2 className="text-xl font-bold text-white" style={{ marginLeft: '12px' }}>
            WALLET CONNECTIONS
          </h2>
        </div>

        {/* Connect wallet button */}
        {!isConnected ? (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="px-4 py-2 border text-white font-bold transition-all text-sm"
            style={{
              backgroundColor: 'rgb(255, 0, 110)',
              borderColor: 'rgb(255, 0, 110)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)'}
          >
            CONNECT WALLET
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all text-sm font-bold"
          >
            DISCONNECT
          </button>
        )}
      </div>

      {/* Success/Error message */}
      {message && (
        <div
          className="border text-sm"
          style={{
            borderColor: 'rgb(255, 0, 110)',
            color: 'rgb(255, 0, 110)',
            padding: '12px',
            marginBottom: '24px',
            backgroundColor: 'rgba(255, 0, 110, 0.1)'
          }}
        >
          {message}
        </div>
      )}

      {/* Connected wallets list */}
      {wallets.length === 0 ? (
        <div className="text-center" style={{ padding: '40px 0' }}>
          <p className="text-gray-500 text-sm">No wallets connected yet</p>
          <p className="text-gray-600 text-xs" style={{ marginTop: '8px' }}>
            Connect a wallet to start creating oracles
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="border border-gray-800 bg-black transition-all hover:border-gray-600"
              style={{ padding: '20px' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center" style={{ marginBottom: '8px' }}>
                    <code className="text-white font-mono text-sm">
                      {formatAddress(wallet.wallet_address)}
                    </code>
                    {wallet.is_primary && (
                      <div className="flex items-center" style={{ marginLeft: '12px' }}>
                        <Star size={14} style={{ color: 'rgb(255, 0, 110)' }} />
                        <span className="text-xs" style={{ color: 'rgb(255, 0, 110)', marginLeft: '4px' }}>
                          PRIMARY
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center text-xs text-gray-500">
                    <span>{getChainName(wallet.chain_id)}</span>
                    <span style={{ margin: '0 8px' }}>•</span>
                    <span>Connected {formatDate(wallet.connected_at)}</span>
                  </div>
                </div>

                <div className="flex items-center" style={{ gap: '8px' }}>
                  {!wallet.is_primary && (
                    <button
                      onClick={() => setPrimaryWallet(wallet.id)}
                      className="px-3 py-1 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all text-xs font-bold"
                    >
                      SET PRIMARY
                    </button>
                  )}

                  <button
                    onClick={() => removeWallet(wallet.id)}
                    className="p-2 border border-gray-800 text-gray-400 hover:text-red-500 hover:border-red-500 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-900 text-xs text-gray-600" style={{ marginTop: '32px', paddingTop: '16px' }}>
        <p>// You can connect multiple wallets to your account</p>
        <p style={{ marginTop: '4px' }}>// The primary wallet will be used for oracle deployments</p>
      </div>
    </div>
  );
}
