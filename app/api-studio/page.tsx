'use client';

import { useState, useEffect, Suspense } from 'react';
import { Code, Play, Copy, CheckCircle, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import Jazzicon from '@/components/Jazzicon';

function APIStudioContent() {
  const searchParams = useSearchParams();
  const [selectedEndpoint, setSelectedEndpoint] = useState(searchParams.get('endpoint')?.includes('farcaster') ? 'farcaster' : 'oracle');
  const [oracleAddress, setOracleAddress] = useState(searchParams.get('address') || '0xc4f7822a9DeCB9d15aadBc079D2c052C229E24dB');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [oracles, setOracles] = useState<any[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState('');
  const [cooldownStatus, setCooldownStatus] = useState<any>(null);
  const [checkingCooldown, setCheckingCooldown] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadOracles();
  }, []);

  useEffect(() => {
    if (oracleAddress && (selectedEndpoint === 'oracle' || selectedEndpoint === 'farcaster')) {
      checkCooldown();
    }
  }, [oracleAddress, selectedEndpoint]);

  const loadOracles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('oracles')
        .select('*')
        .eq('user_id', user.id)
        .not('contract_address', 'is', null) // Only show deployed oracles
        .order('created_at', { ascending: false });
      setOracles(data || []);
    }
  };

  const endpoints = [
    {
      id: 'oracle',
      method: 'GET',
      path: '/api/v1/oracle/{address}',
      description: 'Get price oracle data by contract address',
      params: [
        { name: 'address', type: 'string', required: true, description: 'Price oracle contract address' },
      ],
    },
    {
      id: 'farcaster',
      method: 'GET',
      path: '/api/v1/farcaster/{address}',
      description: 'Get Farcaster social metrics by oracle address',
      params: [
        { name: 'address', type: 'string', required: true, description: 'Farcaster oracle contract address' },
      ],
    },
    {
      id: 'validators',
      method: 'GET',
      path: '/api/v1/validators',
      description: 'Check health status of all validators',
      params: [],
    },
  ];

  const endpoint = endpoints.find((e) => e.id === selectedEndpoint);

  const handleExecute = async () => {
    setLoading(true);
    setResponse(null);

    try {
      let url = '';
      if (selectedEndpoint === 'oracle') {
        url = `/api/v1/oracle/${oracleAddress}`;
      } else if (selectedEndpoint === 'farcaster') {
        url = `/api/v1/farcaster/${oracleAddress}`;
      } else if (selectedEndpoint === 'validators') {
        url = '/api/v1/validators';
      }

      const res = await fetch(url);
      const data = await res.json();

      setResponse({
        status: res.status,
        statusText: res.ok ? 'OK' : 'Error',
        headers: Object.fromEntries(res.headers.entries()),
        data,
      });
    } catch (error: any) {
      setResponse({
        status: 500,
        statusText: 'Error',
        data: { error: error.message },
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkCooldown = async () => {
    if (!oracleAddress) return;

    setCheckingCooldown(true);
    try {
      const res = await fetch(`/api/v1/trigger-update?address=${oracleAddress}`);
      const data = await res.json();

      if (res.ok) {
        setCooldownStatus(data);
      } else {
        setCooldownStatus(null);
      }
    } catch (error) {
      setCooldownStatus(null);
    } finally {
      setCheckingCooldown(false);
    }
  };

  const handleTriggerUpdate = async () => {
    setTriggering(true);
    setTriggerMessage('');

    try {
      const res = await fetch('/api/v1/trigger-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oracleAddress }),
      });

      const data = await res.json();

      if (res.ok) {
        const successCount = data.validators?.filter((v: any) => v.success).length || 0;
        setTriggerMessage(`✅ Triggered ${successCount}/${data.validators?.length || 0} validators`);
        // Refresh cooldown status
        await checkCooldown();
      } else if (res.status === 429) {
        // Cooldown active
        setTriggerMessage(`⏳ ${data.message}`);
      } else {
        setTriggerMessage('❌ ' + (data.error || 'Failed to trigger validators'));
      }
    } catch (error: any) {
      setTriggerMessage('❌ ' + error.message);
    } finally {
      setTriggering(false);
      setTimeout(() => setTriggerMessage(''), 5000);
    }
  };

  const generateCurlCommand = () => {
    if (!endpoint) return '';

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://feeds.review';
    let url = `${origin}${endpoint.path}`;
    if (selectedEndpoint === 'oracle') {
      url = url.replace('{address}', oracleAddress);
    } else if (selectedEndpoint === 'farcaster') {
      url = url.replace('{address}', oracleAddress);
    }

    return `curl -X ${endpoint.method} "${url}"`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Grid Background */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: '#000000',
          backgroundImage:
            'linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content */}
      <div className="relative">
        {/* Header */}
        <nav className="border-b border-gray-800 bg-black/90 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">FEEDS API STUDIO</h1>
                <p className="text-sm text-gray-500 mt-1">Test and explore oracle APIs</p>
              </div>
              <button
                onClick={() => (window.location.href = '/')}
                className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
              >
                BACK TO DASHBOARD
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel - Endpoints */}
            <div className="border border-gray-800 bg-black/50 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center">
                <Code size={20} className="mr-2" />
                ENDPOINTS
              </h2>

              <div className="space-y-2">
                {endpoints.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedEndpoint(ep.id)}
                    className={`w-full text-left p-4 border transition-all ${
                      selectedEndpoint === ep.id
                        ? 'border-[rgb(255,0,110)] bg-[rgb(255,0,110)] bg-opacity-10'
                        : 'border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-bold mr-2 ${
                          ep.method === 'GET' ? 'bg-blue-500' : 'bg-green-500'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <code className="text-sm text-gray-400">{ep.path}</code>
                    </div>
                    <p className="text-xs text-gray-500">{ep.description}</p>
                  </button>
                ))}
              </div>

              {/* Quick Info */}
              <div className="mt-6 p-4 border border-gray-800 bg-gray-900/50">
                <h3 className="text-sm font-bold mb-2">DEPLOYED CONTRACTS</h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-gray-500">OracleRegistry</p>
                    <code className="text-gray-400">0xdd2B69...3ADD64</code>
                  </div>
                  <div>
                    <p className="text-gray-500">OracleFactory</p>
                    <code className="text-gray-400">0xcCfCDA...645189</code>
                  </div>
                  <div>
                    <p className="text-gray-500">FC-DATA Oracle</p>
                    <code className="text-gray-400">0x793Bd3...aef02c7</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Panel - Request */}
            <div className="lg:col-span-2 space-y-6">
              {/* Endpoint Details */}
              {endpoint && (
                <div className="border border-gray-800 bg-black/50 p-6">
                  <div className="flex items-center mb-4">
                    <span
                      className={`px-3 py-1 text-sm font-bold mr-3 ${
                        endpoint.method === 'GET' ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <code className="text-lg">{endpoint.path}</code>
                  </div>
                  <p className="text-gray-400 mb-6">{endpoint.description}</p>

                  {/* Oracle Selector */}
                  {(selectedEndpoint === 'oracle' || selectedEndpoint === 'farcaster') && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold mb-3">QUICK SELECT</h3>
                      {oracles.length > 0 ? (
                        <>
                          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto border border-gray-800 bg-black">
                            {oracles.map((oracle) => (
                              <button
                                key={oracle.id}
                                onClick={() => {
                                  setOracleAddress(oracle.contract_address);
                                  // Auto-switch endpoint based on oracle type
                                  if (oracle.oracle_type === 'farcaster') {
                                    setSelectedEndpoint('farcaster');
                                  } else {
                                    setSelectedEndpoint('oracle');
                                  }
                                }}
                                className={`w-full p-3 text-left flex items-center gap-3 transition-colors ${
                                  oracleAddress === oracle.contract_address
                                    ? 'bg-[rgb(255,0,110)] bg-opacity-10 border-[rgb(255,0,110)]'
                                    : 'hover:bg-gray-900 border-transparent'
                                } border`}
                              >
                                <Jazzicon address={oracle.contract_address} diameter={24} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-white flex items-center gap-2">
                                    {oracle.name}
                                    {oracle.is_hidden && (
                                      <span className="text-xs text-gray-600 font-normal">(RETIRED)</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {oracle.oracle_type.toUpperCase()}
                                    {oracle.target_token && ` • ${oracle.target_token}`}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-600">// Click an oracle above or enter address manually below</p>
                        </>
                      ) : (
                        <div className="text-sm text-gray-600 mb-3 p-3 border border-gray-800">
                          No deployed oracles found. Deploy an oracle first.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Parameters */}
                  {endpoint.params.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold mb-3">PARAMETERS</h3>
                      <div className="space-y-3">
                        {endpoint.params.map((param) => (
                          <div key={param.name}>
                            <label className="block text-sm text-gray-400 mb-2">
                              {param.name}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                              <span className="ml-2 text-xs text-gray-600">({param.type})</span>
                            </label>
                            <input
                              type="text"
                              value={oracleAddress}
                              onChange={(e) => setOracleAddress(e.target.value)}
                              placeholder={param.description}
                              className="w-full px-4 py-2 bg-black border border-gray-800 text-white focus:border-[rgb(255,0,110)] outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execute Button */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={handleExecute}
                      disabled={loading}
                      className="px-6 py-3 border text-white font-bold transition-all flex items-center justify-center disabled:opacity-50"
                      style={{ backgroundColor: 'rgb(255, 0, 110)', borderColor: 'rgb(255, 0, 110)' }}
                    >
                      <Play size={20} className="mr-2" />
                      {loading ? 'EXECUTING...' : 'EXECUTE'}
                    </button>

                    {(selectedEndpoint === 'oracle' || selectedEndpoint === 'farcaster') && (
                      <div className="relative">
                        <button
                          onClick={handleTriggerUpdate}
                          disabled={triggering || !oracleAddress || checkingCooldown || (cooldownStatus && !cooldownStatus.canTrigger)}
                          className="w-full px-6 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 font-bold transition-all flex items-center justify-center disabled:opacity-50"
                        >
                          <Zap size={20} className="mr-2" />
                          {triggering ? 'TRIGGERING...' : cooldownStatus && !cooldownStatus.canTrigger ? `COOLDOWN (${cooldownStatus.minutesRemaining}m)` : 'TRIGGER UPDATE'}
                        </button>
                        {cooldownStatus && !cooldownStatus.canTrigger && (
                          <div className="absolute -bottom-6 left-0 text-xs text-gray-600">
                            Available in {cooldownStatus.minutesRemaining} minute{cooldownStatus.minutesRemaining !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {triggerMessage && (
                    <div className="mt-3 p-3 border border-gray-800 bg-gray-900 text-sm">
                      {triggerMessage}
                    </div>
                  )}

                  {(selectedEndpoint === 'oracle' || selectedEndpoint === 'farcaster') && cooldownStatus && (
                    <div className="mt-3 p-3 border border-gray-800 bg-gray-900/50 text-xs text-gray-500">
                      ⏱️ Trigger cooldown: {cooldownStatus.cooldownMinutes} minutes
                      {cooldownStatus.lastTriggeredAt && (
                        <span className="ml-2">
                          • Last triggered: {new Date(cooldownStatus.lastTriggeredAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* cURL Command */}
                  <div className="mt-4 p-4 bg-gray-900 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-bold">CURL COMMAND</span>
                      <button
                        onClick={() => copyToClipboard(generateCurlCommand())}
                        className="text-xs text-gray-400 hover:text-white flex items-center"
                      >
                        {copied ? (
                          <>
                            <CheckCircle size={14} className="mr-1" />
                            COPIED
                          </>
                        ) : (
                          <>
                            <Copy size={14} className="mr-1" />
                            COPY
                          </>
                        )}
                      </button>
                    </div>
                    <code className="text-xs text-green-400 block overflow-x-auto">
                      {generateCurlCommand()}
                    </code>
                  </div>
                </div>
              )}

              {/* Response */}
              {response && (
                <div className="border border-gray-800 bg-black/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">RESPONSE</h3>
                    <div className="flex items-center">
                      <span
                        className={`px-3 py-1 text-sm font-bold ${
                          response.status === 200 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        {response.status} {response.statusText}
                      </span>
                    </div>
                  </div>

                  {/* Response Body */}
                  <div className="bg-gray-900 p-4 border border-gray-800 overflow-x-auto">
                    <pre className="text-xs text-green-400">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  </div>

                  {/* Copy Response */}
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(response.data, null, 2))}
                    className="mt-4 px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center text-sm"
                  >
                    <Copy size={16} className="mr-2" />
                    COPY RESPONSE
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-gray-500">Loading API Studio...</div>
    </div>
  );
}

export default function APIStudioPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <APIStudioContent />
    </Suspense>
  );
}
