'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import OracleApiStats from '@/components/OracleApiStats';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function OracleStatsPage() {
  const [oracle, setOracle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const oracleId = params.oracleId as string;
  const supabase = createClient();

  useEffect(() => {
    loadOracle();
  }, [oracleId]);

  const loadOracle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      const { data: oracleData, error } = await supabase
        .from('oracles')
        .select('*')
        .eq('id', oracleId)
        .eq('user_id', user.id)
        .single();

      if (error || !oracleData) {
        console.error('Oracle not found or unauthorized');
        router.push('/dashboard');
        return;
      }

      setOracle(oracleData);
    } catch (error) {
      console.error('Error loading oracle:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div
          className="fixed inset-0"
          style={{
            backgroundColor: '#000000',
            backgroundImage: 'linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        <div className="relative">
          <p className="text-gray-500">LOADING ORACLE STATS...</p>
        </div>
      </div>
    );
  }

  if (!oracle) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Grid background */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: '#000000',
          backgroundImage: 'linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Top Nav */}
      <nav className="relative border-b border-gray-800 bg-black/90 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-bold">BACK TO DASHBOARD</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{oracle.name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="uppercase">{oracle.oracle_type} Oracle</span>
            {oracle.target_token && (
              <>
                <span>•</span>
                <span>{oracle.target_token}</span>
              </>
            )}
            {oracle.contract_address && (
              <>
                <span>•</span>
                <a
                  href={`https://basescan.org/address/${oracle.contract_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                >
                  <span className="font-mono">
                    {oracle.contract_address.slice(0, 6)}...{oracle.contract_address.slice(-4)}
                  </span>
                  <ExternalLink size={12} />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Stats Component */}
        {oracle.contract_address ? (
          <OracleApiStats oracleId={oracleId} />
        ) : (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-6">
            <p className="text-yellow-400">
              This oracle has not been deployed yet. API statistics will be available once the oracle is deployed and starts receiving API calls.
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {oracle.contract_address && (
            <>
              <button
                onClick={() => {
                  const endpoint = oracle.oracle_type === 'farcaster'
                    ? `/api/v1/farcaster/${oracle.contract_address}`
                    : `/api/v1/oracle/${oracle.contract_address}`;
                  router.push(`/api-studio?endpoint=${endpoint}&address=${oracle.contract_address}`);
                }}
                className="border border-gray-800 bg-gray-900 hover:border-gray-600 transition-all text-left p-6"
              >
                <h3 className="text-lg font-bold text-white mb-2">Test in API Studio</h3>
                <p className="text-sm text-gray-400">Make test queries and view responses</p>
              </button>

              <a
                href={`https://basescan.org/address/${oracle.contract_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gray-800 bg-gray-900 hover:border-gray-600 transition-all text-left p-6 block"
              >
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  View on BaseScan
                  <ExternalLink size={16} />
                </h3>
                <p className="text-sm text-gray-400">View contract and transaction history</p>
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
