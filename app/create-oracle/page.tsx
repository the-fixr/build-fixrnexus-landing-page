'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import {
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Cloud,
  Settings,
  Shield,
  CheckCircle,
  Code,
  Zap,
  DollarSign
} from 'lucide-react';

interface OracleConfig {
  name: string;
  type: 'price' | 'farcaster' | 'liquidity' | 'custom';
  dataSource: {
    primary: string;
    backup?: string;
    apiEndpoint?: string;
  };
  updateFrequency: number; // in minutes
  consensusThreshold: number; // percentage
  chainId: number;
  targetToken?: string; // For Farcaster oracles - token to track
  // Pricing configuration
  pricingModel: 'free' | 'pay_per_call' | 'subscription' | 'donation';
  pricePerCall?: number; // in USD cents
  monthlyPrice?: number; // in USD
  isPublic: boolean;
  description?: string;
}

export default function CreateOraclePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<OracleConfig>({
    name: '',
    type: 'price',
    dataSource: {
      primary: 'geckoterminal',
    },
    updateFrequency: 5,
    consensusThreshold: 66,
    chainId: 8453, // Base
    pricingModel: 'free',
    isPublic: true,
  });
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState('');

  const router = useRouter();
  const supabase = createClient();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (updates: Partial<OracleConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleDeploy = async () => {
    if (!isConnected || !address || !walletClient) {
      setDeployError('Please connect your wallet to deploy');
      return;
    }

    setDeploying(true);
    setDeployError('');

    try {
      // Step 1: Create pending oracle record in database
      const { data: oracle, error: dbError } = await supabase
        .from('oracles')
        .insert({
          user_id: user.id,
          name: config.name,
          symbol: config.name.toUpperCase(),
          oracle_type: config.type,
          config: config,
          update_frequency: config.updateFrequency * 60,
          consensus_threshold: config.consensusThreshold,
          data_source_primary: config.dataSource.primary,
          data_source_backup: config.dataSource.backup || null,
          api_endpoint: config.dataSource.apiEndpoint || null,
          chain_id: config.chainId,
          target_token: config.targetToken || null,
          status: 'deploying',
          // Pricing configuration
          pricing_model: config.pricingModel,
          price_per_call: config.pricePerCall || null,
          monthly_price: config.monthlyPrice || null,
          is_public: config.isPublic,
          description: config.description || null,
        })
        .select()
        .single();

      if (dbError) {
        throw new Error('Failed to create oracle record: ' + dbError.message);
      }

      // Step 2: Deploy contract using user's wallet
      const factoryAddress = process.env.NEXT_PUBLIC_ORACLE_FACTORY_ADDRESS;
      if (!factoryAddress) {
        throw new Error('Factory address not configured');
      }

      const factoryAbi = [
        'function deployPriceOracle(string memory name, string memory symbol, uint8 consensusThreshold, uint256 updateFrequency) external returns (address)',
        'function deployFarcasterOracle(string memory name, string memory symbol, string memory targetToken, uint8 consensusThreshold, uint256 updateFrequency) external returns (address)',
        'event OracleDeployed(address indexed oracleAddress, address indexed creator, string name, string symbol)',
      ];

      // Create provider from wallet client
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      const factory = new ethers.Contract(factoryAddress, factoryAbi, signer);

      // Convert update frequency from minutes to seconds
      const updateFrequencySeconds = config.updateFrequency * 60;

      console.log('Deploying oracle with user wallet:', {
        type: config.type,
        name: config.name,
        symbol: config.name.toUpperCase(),
        targetToken: config.targetToken,
        threshold: config.consensusThreshold,
        frequency: updateFrequencySeconds,
      });

      // Send transaction based on oracle type
      let tx;
      if (config.type === 'farcaster') {
        if (!config.targetToken) {
          throw new Error('Target token is required for Farcaster oracles');
        }
        tx = await factory.deployFarcasterOracle(
          config.name,
          config.name.toUpperCase(),
          config.targetToken,
          config.consensusThreshold,
          updateFrequencySeconds
        );
      } else {
        // Default to price oracle
        tx = await factory.deployPriceOracle(
          config.name,
          config.name.toUpperCase(),
          config.consensusThreshold,
          updateFrequencySeconds
        );
      }

      console.log('Transaction sent:', tx.hash);

      // Save tx hash immediately
      await supabase
        .from('oracles')
        .update({ deployment_tx_hash: tx.hash })
        .eq('id', oracle.id);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Parse event to get oracle address
      let contractAddress;

      try {
        const event = receipt.logs
          .map((log: any) => {
            try {
              return factory.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e: any) => e && e.name === 'OracleDeployed');

        if (!event) {
          console.error('No OracleDeployed event found in logs:', receipt.logs);
          throw new Error('Could not find deployment event in transaction logs');
        }

        contractAddress = event.args.oracleAddress;
        console.log('Oracle deployed at:', contractAddress);
      } catch (parseError: any) {
        console.error('Event parsing error:', parseError);
        throw new Error(`Failed to parse deployment event: ${parseError.message}`);
      }

      // Step 3: Update database with deployment info
      const { error: updateError } = await supabase
        .from('oracles')
        .update({
          contract_address: contractAddress,
          deployment_tx_hash: receipt.hash,
          deployed_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', oracle.id);

      if (updateError) {
        console.error('Failed to update oracle in database:', updateError);
        throw new Error(`Oracle deployed at ${contractAddress} but database update failed: ${updateError.message}`);
      }

      console.log('✅ Oracle successfully deployed and saved:', contractAddress);

      // Step 4: Trigger validators to fetch data immediately
      try {
        console.log('Triggering validators for immediate update...');
        const triggerResponse = await fetch('/api/v1/trigger-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ oracleAddress: contractAddress }),
        });

        if (triggerResponse.ok) {
          const triggerData = await triggerResponse.json();
          console.log('✅ Validators triggered:', triggerData);
        } else {
          console.warn('Failed to trigger validators (non-critical)');
        }
      } catch (triggerError) {
        console.warn('Failed to trigger validators (non-critical):', triggerError);
        // Don't fail deployment if trigger fails
      }

      // Success! Redirect to dashboard
      router.push(`/dashboard?deployed=${oracle.id}`);
    } catch (err: any) {
      setDeployError(err.message || 'Deployment failed');
      console.error('Deployment error:', err);
    } finally {
      setDeploying(false);
    }
  };

  const generateOracleCode = () => {
    return `// FEEDS Oracle Configuration
// Generated: ${new Date().toISOString()}

export const oracleConfig = {
  name: "${config.name}",
  type: "${config.type}",
  network: "base",

  dataSources: {
    primary: {
      provider: "${config.dataSource.primary}",
      endpoint: "${config.dataSource.apiEndpoint || 'auto'}",
    },
    ${config.dataSource.backup ? `backup: {
      provider: "${config.dataSource.backup}",
    },` : ''}
  },

  updatePolicy: {
    frequency: ${config.updateFrequency} * 60, // seconds
    onChainUpdate: true,
  },

  consensus: {
    threshold: ${config.consensusThreshold}, // percentage
    minValidators: 3,
    aggregation: "median",
  },

  deployment: {
    chainId: ${config.chainId},
    gasLimit: 500000,
  },
};

// Cloudflare Worker Handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const data = await fetchPriceData(oracleConfig);
    const consensus = await validateConsensus(data);

    if (consensus.valid) {
      await updateOnChain(consensus.value);
      return new Response(JSON.stringify(consensus), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Consensus failed', { status: 400 });
  },
};`;
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
          <p className="text-gray-500">LOADING ORACLE CREATOR...</p>
        </div>
      </div>
    );
  }

  const steps = [
    { number: 1, title: 'Oracle Type', icon: Zap },
    { number: 2, title: 'Data Source', icon: Cloud },
    { number: 3, title: 'Update Policy', icon: Settings },
    { number: 4, title: 'Consensus', icon: Shield },
    { number: 5, title: 'Details', icon: DollarSign },
    { number: 6, title: 'Review & Deploy', icon: CheckCircle },
  ];

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

      {/* Top Nav Bar */}
      <nav className="relative border-b border-gray-800 bg-black/90 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex flex-col hover:opacity-80 transition-opacity"
          >
            <h1 className="text-2xl font-bold tracking-tight">FEEDS</h1>
            <p className="text-sm text-gray-500 tracking-wide">DECENTRALIZED CONSENSUS</p>
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
          >
            BACK TO DASHBOARD
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative container mx-auto px-6 py-12">
        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div className="flex items-center" style={{ marginBottom: '8px' }}>
            <Code size={32} style={{ color: 'rgb(255, 0, 110)' }} />
            <h2 className="text-4xl font-bold" style={{ marginLeft: '16px' }}>
              CREATE ORACLE
            </h2>
          </div>
          <p className="text-gray-500" style={{ marginLeft: '48px' }}>
            Configure your decentralized data feed with AI assistance
          </p>
        </div>

        {/* Progress Steps */}
        <div className="border border-gray-800 bg-black" style={{ padding: '32px', marginBottom: '32px' }}>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 border-2 flex items-center justify-center transition-all ${
                        isActive ? 'border-[rgb(255,0,110)]' : isCompleted ? 'border-gray-600' : 'border-gray-800'
                      }`}
                      style={{
                        backgroundColor: isActive ? 'rgba(255, 0, 110, 0.1)' : 'transparent',
                      }}
                    >
                      <Icon
                        size={20}
                        style={{ color: isActive ? 'rgb(255, 0, 110)' : isCompleted ? '#666' : '#333' }}
                      />
                    </div>
                    <div className="text-xs text-center" style={{ marginTop: '8px', width: '80px' }}>
                      <div
                        className={`font-bold ${
                          isActive ? 'text-[rgb(255,0,110)]' : isCompleted ? 'text-gray-600' : 'text-gray-800'
                        }`}
                      >
                        STEP {step.number}
                      </div>
                      <div className="text-gray-600">{step.title}</div>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{
                        backgroundColor: isCompleted ? '#666' : '#333',
                        marginBottom: '40px',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Configuration */}
          <div>
            <StepContent
              currentStep={currentStep}
              config={config}
              updateConfig={updateConfig}
            />

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between" style={{ marginTop: '32px' }}>
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-6 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center font-bold"
              >
                <ChevronLeft size={20} />
                <span style={{ marginLeft: '8px' }}>PREVIOUS</span>
              </button>

              {currentStep < 6 ? (
                <button
                  onClick={nextStep}
                  className="px-6 py-3 border text-white font-bold transition-all flex items-center"
                  style={{ backgroundColor: 'rgb(255, 0, 110)', borderColor: 'rgb(255, 0, 110)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)'}
                >
                  <span style={{ marginRight: '8px' }}>NEXT STEP</span>
                  <ChevronRight size={20} />
                </button>
              ) : (
                <>
                  {!isConnected && (
                    <div className="mb-4 p-3 border border-yellow-500 bg-yellow-500 bg-opacity-10 text-yellow-500">
                      ⚠️ Please connect your wallet to deploy. You will pay the gas fees for your oracle deployment.
                    </div>
                  )}
                  <button
                    onClick={handleDeploy}
                    disabled={deploying || !isConnected}
                    className="px-6 py-3 border text-white font-bold transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'rgb(255, 0, 110)', borderColor: 'rgb(255, 0, 110)' }}
                    onMouseEnter={(e) => !deploying && isConnected && (e.currentTarget.style.backgroundColor = 'transparent')}
                    onMouseLeave={(e) => !deploying && isConnected && (e.currentTarget.style.backgroundColor = 'rgb(255, 0, 110)')}
                  >
                    <CheckCircle size={20} />
                    <span style={{ marginLeft: '8px' }}>{deploying ? 'DEPLOYING...' : 'DEPLOY ORACLE'}</span>
                  </button>
                </>
              )}
            </div>

            {deployError && (
              <div className="mt-4 p-3 border border-red-500 bg-red-500 bg-opacity-10 text-red-500">
                {deployError}
              </div>
            )}
          </div>

          {/* Right Panel - Code Preview */}
          <div>
            <CodePreview code={generateOracleCode()} />
          </div>
        </div>
      </main>
    </div>
  );
}

// Step Content Component
function StepContent({
  currentStep,
  config,
  updateConfig,
}: {
  currentStep: number;
  config: OracleConfig;
  updateConfig: (updates: Partial<OracleConfig>) => void;
}) {
  switch (currentStep) {
    case 1:
      return <Step1OracleType config={config} updateConfig={updateConfig} />;
    case 2:
      return <Step2DataSource config={config} updateConfig={updateConfig} />;
    case 3:
      return <Step3UpdatePolicy config={config} updateConfig={updateConfig} />;
    case 4:
      return <Step4Consensus config={config} updateConfig={updateConfig} />;
    case 5:
      return <Step5Pricing config={config} updateConfig={updateConfig} />;
    case 6:
      return <Step6Review config={config} />;
    default:
      return null;
  }
}

// Code Preview Component
function CodePreview({ code }: { code: string }) {
  return (
    <div className="border border-gray-800 bg-black h-full">
      <div className="border-b border-gray-800" style={{ padding: '16px' }}>
        <div className="flex items-center">
          <Code size={20} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-400" style={{ marginLeft: '8px' }}>
            GENERATED CONFIGURATION
          </span>
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight: '600px', padding: '24px' }}>
        <pre className="text-xs text-gray-400 font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Step 1: Oracle Type
function Step1OracleType({
  config,
  updateConfig,
}: {
  config: OracleConfig;
  updateConfig: (updates: Partial<OracleConfig>) => void;
}) {
  const oracleTypes = [
    {
      type: 'price' as const,
      title: 'TOKEN PRICE FEED',
      description: 'Real-time token prices from DEX aggregators',
      icon: TrendingUp,
      features: ['GeckoTerminal API', 'Dex Screener', 'Multi-source fallback'],
    },
    {
      type: 'farcaster' as const,
      title: 'FARCASTER SOCIAL DATA',
      description: 'Token sentiment, influencer tracking, and viral content',
      icon: Zap,
      features: ['Neynar API', 'Token mentions', 'Engagement metrics', 'Whale tracking'],
    },
    {
      type: 'liquidity' as const,
      title: 'DEX LIQUIDITY TRACKER',
      description: 'Monitor pool TVL, volume, APR, and LP positions',
      icon: Cloud,
      features: ['Pool metrics', 'Volume tracking', 'APR calculation', 'Multi-DEX support'],
    },
    {
      type: 'custom' as const,
      title: 'CUSTOM ORACLE',
      description: 'Configure your own data source and endpoints',
      icon: Settings,
      features: ['Custom API endpoints', 'Flexible schema', 'Advanced configuration'],
    },
  ];

  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      <h3 className="text-2xl font-bold" style={{ marginBottom: '8px' }}>
        SELECT ORACLE TYPE
      </h3>
      <p className="text-sm text-gray-500" style={{ marginBottom: '32px' }}>
        Choose the type of data feed you want to create
      </p>

      <div className="space-y-4">
        {oracleTypes.map((oracleType) => {
          const Icon = oracleType.icon;
          const isSelected = config.type === oracleType.type;

          return (
            <button
              key={oracleType.type}
              onClick={() => updateConfig({ type: oracleType.type })}
              className="w-full border-2 text-left transition-all"
              style={{
                borderColor: isSelected ? 'rgb(255, 0, 110)' : '#333',
                backgroundColor: isSelected ? 'rgba(255, 0, 110, 0.05)' : 'transparent',
                padding: '24px',
              }}
            >
              <div className="flex items-start">
                <Icon
                  size={32}
                  style={{ color: isSelected ? 'rgb(255, 0, 110)' : '#666' }}
                />
                <div className="flex-1" style={{ marginLeft: '16px' }}>
                  <h4
                    className="text-lg font-bold"
                    style={{ color: isSelected ? 'rgb(255, 0, 110)' : '#fff', marginBottom: '4px' }}
                  >
                    {oracleType.title}
                  </h4>
                  <p className="text-sm text-gray-500" style={{ marginBottom: '12px' }}>
                    {oracleType.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {oracleType.features.map((feature) => (
                      <span
                        key={feature}
                        className="px-2 py-1 text-xs border"
                        style={{
                          borderColor: isSelected ? 'rgba(255, 0, 110, 0.3)' : '#333',
                          color: isSelected ? 'rgb(255, 0, 110)' : '#666',
                        }}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Oracle Name Input */}
      <div style={{ marginTop: '32px' }}>
        <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '8px' }}>
          ORACLE NAME
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateConfig({ name: e.target.value })}
          placeholder={config.type === 'farcaster' ? 'e.g., DEGEN-SOCIAL-METRICS' : 'e.g., ETH-USD-PRICE-FEED'}
          className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors font-mono"
        />
        <p className="text-xs text-gray-600" style={{ marginTop: '8px' }}>
          // Use uppercase with hyphens for best practices
        </p>
      </div>

      {/* Target Token Input (Farcaster only) */}
      {config.type === 'farcaster' && (
        <div style={{ marginTop: '24px' }}>
          <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '8px' }}>
            TARGET TOKEN *
          </label>
          <input
            type="text"
            value={config.targetToken || ''}
            onChange={(e) => updateConfig({ targetToken: e.target.value.toUpperCase() })}
            placeholder="e.g., DEGEN or $DEGEN"
            className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors font-mono"
          />
          <p className="text-xs text-gray-600" style={{ marginTop: '8px' }}>
            // Token symbol to track on Farcaster (case-insensitive)
          </p>
        </div>
      )}
    </div>
  );
}

// Step 2: Data Source
function Step2DataSource({
  config,
  updateConfig,
}: {
  config: OracleConfig;
  updateConfig: (updates: Partial<OracleConfig>) => void;
}) {
  const dataSources = {
    price: [
      { id: 'geckoterminal', name: 'GeckoTerminal', description: 'DEX aggregator for real-time prices' },
      { id: 'dexscreener', name: 'Dex Screener', description: 'Multi-chain DEX price tracking' },
      { id: 'uniswap-subgraph', name: 'Uniswap Subgraph', description: 'Uniswap V3 on-chain data' },
    ],
    farcaster: [
      { id: 'neynar', name: 'Neynar API', description: 'Complete Farcaster data infrastructure' },
      { id: 'neynar-webhooks', name: 'Neynar Webhooks', description: 'Real-time Farcaster events' },
    ],
    liquidity: [
      { id: 'geckoterminal', name: 'GeckoTerminal', description: 'DEX pool data and metrics' },
      { id: 'dexscreener', name: 'Dex Screener', description: 'Multi-DEX liquidity tracking' },
      { id: 'defillama', name: 'DefiLlama', description: 'TVL and DeFi analytics' },
    ],
    custom: [],
  };

  const availableSources = dataSources[config.type] || [];

  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      <h3 className="text-2xl font-bold" style={{ marginBottom: '8px' }}>
        CONFIGURE DATA SOURCE
      </h3>
      <p className="text-sm text-gray-500" style={{ marginBottom: '32px' }}>
        Select primary and backup data providers
      </p>

      {/* Primary Source */}
      <div style={{ marginBottom: '32px' }}>
        <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '12px' }}>
          PRIMARY SOURCE
        </label>
        <div className="space-y-2">
          {availableSources.map((source) => (
            <button
              key={source.id}
              onClick={() =>
                updateConfig({
                  dataSource: { ...config.dataSource, primary: source.id },
                })
              }
              className="w-full border text-left transition-all"
              style={{
                borderColor: config.dataSource.primary === source.id ? 'rgb(255, 0, 110)' : '#333',
                backgroundColor:
                  config.dataSource.primary === source.id ? 'rgba(255, 0, 110, 0.05)' : 'transparent',
                padding: '16px',
              }}
            >
              <div className="font-bold text-sm" style={{ marginBottom: '4px' }}>
                {source.name}
              </div>
              <div className="text-xs text-gray-500">{source.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Token Contract Address for Price Oracles */}
      {config.type === 'price' && (
        <div style={{ marginBottom: '32px' }}>
          <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '8px' }}>
            TOKEN CONTRACT ADDRESS
            <span className="text-red-400 ml-1">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Enter the token's contract address on Base. GeckoTerminal will automatically fetch price data for this token.
          </p>
          <input
            type="text"
            value={config.targetToken || ''}
            onChange={(e) => updateConfig({ targetToken: e.target.value })}
            placeholder="0x..."
            className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors font-mono text-sm"
          />
          <p className="text-xs text-gray-600 mt-2">
            Example: 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed (DEGEN on Base)
          </p>
        </div>
      )}

      {/* Target Token for Farcaster Oracles */}
      {config.type === 'farcaster' && (
        <div style={{ marginBottom: '32px' }}>
          <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '8px' }}>
            TARGET TOKEN SYMBOL
            <span className="text-red-400 ml-1">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Enter the token symbol to track social metrics for (e.g., DEGEN, HIGHER)
          </p>
          <input
            type="text"
            value={config.targetToken || ''}
            onChange={(e) => updateConfig({ targetToken: e.target.value.toUpperCase() })}
            placeholder="DEGEN"
            className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors font-mono text-sm uppercase"
          />
        </div>
      )}

      {/* Custom API Endpoint */}
      {config.type === 'custom' && (
        <div style={{ marginBottom: '32px' }}>
          <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '8px' }}>
            API ENDPOINT
          </label>
          <input
            type="url"
            value={config.dataSource.apiEndpoint || ''}
            onChange={(e) =>
              updateConfig({
                dataSource: { ...config.dataSource, apiEndpoint: e.target.value },
              })
            }
            placeholder="https://api.example.com/data"
            className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors font-mono text-sm"
          />
        </div>
      )}

      {/* Backup Source */}
      <div>
        <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '12px' }}>
          BACKUP SOURCE (OPTIONAL)
        </label>
        <div className="space-y-2">
          <button
            onClick={() =>
              updateConfig({
                dataSource: { ...config.dataSource, backup: undefined },
              })
            }
            className="w-full border text-left transition-all"
            style={{
              borderColor: !config.dataSource.backup ? 'rgb(255, 0, 110)' : '#333',
              backgroundColor: !config.dataSource.backup ? 'rgba(255, 0, 110, 0.05)' : 'transparent',
              padding: '16px',
            }}
          >
            <div className="font-bold text-sm">None</div>
          </button>
          {availableSources
            .filter((s) => s.id !== config.dataSource.primary)
            .map((source) => (
              <button
                key={source.id}
                onClick={() =>
                  updateConfig({
                    dataSource: { ...config.dataSource, backup: source.id },
                  })
                }
                className="w-full border text-left transition-all"
                style={{
                  borderColor: config.dataSource.backup === source.id ? 'rgb(255, 0, 110)' : '#333',
                  backgroundColor:
                    config.dataSource.backup === source.id ? 'rgba(255, 0, 110, 0.05)' : 'transparent',
                  padding: '16px',
                }}
              >
                <div className="font-bold text-sm" style={{ marginBottom: '4px' }}>
                  {source.name}
                </div>
                <div className="text-xs text-gray-500">{source.description}</div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// Step 3: Update Policy
function Step3UpdatePolicy({
  config,
  updateConfig,
}: {
  config: OracleConfig;
  updateConfig: (updates: Partial<OracleConfig>) => void;
}) {
  const frequencyOptions = [
    { value: 1, label: '1 minute', description: 'Ultra high-frequency (expensive)' },
    { value: 5, label: '5 minutes', description: 'High-frequency (recommended)' },
    { value: 15, label: '15 minutes', description: 'Medium frequency' },
    { value: 60, label: '1 hour', description: 'Low frequency (cost-effective)' },
  ];

  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      <h3 className="text-2xl font-bold" style={{ marginBottom: '8px' }}>
        UPDATE POLICY
      </h3>
      <p className="text-sm text-gray-500" style={{ marginBottom: '32px' }}>
        Configure how often your oracle updates on-chain
      </p>

      <div>
        <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '12px' }}>
          UPDATE FREQUENCY
        </label>
        <div className="space-y-2">
          {frequencyOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateConfig({ updateFrequency: option.value })}
              className="w-full border text-left transition-all"
              style={{
                borderColor: config.updateFrequency === option.value ? 'rgb(255, 0, 110)' : '#333',
                backgroundColor:
                  config.updateFrequency === option.value ? 'rgba(255, 0, 110, 0.05)' : 'transparent',
                padding: '16px',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm" style={{ marginBottom: '4px' }}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
                <div className="text-xs text-gray-600">{option.value}min</div>
              </div>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-900" style={{ marginTop: '32px', paddingTop: '16px' }}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Estimated monthly cost:</span>
            <span className="font-bold" style={{ color: 'rgb(255, 0, 110)' }}>
              ${((43200 / config.updateFrequency) * 0.001).toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-600" style={{ marginTop: '8px' }}>
            // Based on Base network gas fees and update frequency
          </p>
        </div>
      </div>
    </div>
  );
}

// Step 4: Consensus
function Step4Consensus({
  config,
  updateConfig,
}: {
  config: OracleConfig;
  updateConfig: (updates: Partial<OracleConfig>) => void;
}) {
  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      <h3 className="text-2xl font-bold" style={{ marginBottom: '8px' }}>
        CONSENSUS CONFIGURATION
      </h3>
      <p className="text-sm text-gray-500" style={{ marginBottom: '32px' }}>
        Set validation requirements for your oracle data
      </p>

      <div>
        <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '12px' }}>
          CONSENSUS THRESHOLD: {config.consensusThreshold}%
        </label>

        <input
          type="range"
          min="51"
          max="100"
          value={config.consensusThreshold}
          onChange={(e) => updateConfig({ consensusThreshold: parseInt(e.target.value) })}
          className="w-full"
          style={{
            accentColor: 'rgb(255, 0, 110)',
          }}
        />

        <div className="flex justify-between text-xs text-gray-600" style={{ marginTop: '8px' }}>
          <span>51% (Minimum)</span>
          <span>100% (Unanimous)</span>
        </div>

        <div className="border border-gray-800" style={{ padding: '16px', marginTop: '24px' }}>
          <p className="text-sm text-gray-400" style={{ marginBottom: '12px' }}>
            With {config.consensusThreshold}% threshold:
          </p>
          <ul className="text-xs text-gray-500 space-y-2">
            <li>• {Math.ceil((config.consensusThreshold / 100) * 3)} of 3 validators must agree</li>
            <li>• Higher threshold = more security</li>
            <li>• Lower threshold = more availability</li>
            <li>• Recommended: 66% for balanced security</li>
          </ul>
        </div>

        {/* Chain Selection */}
        <div style={{ marginTop: '32px' }}>
          <label className="block text-sm text-gray-400 font-bold" style={{ marginBottom: '12px' }}>
            DEPLOYMENT NETWORK
          </label>
          <button
            className="w-full border text-left"
            style={{
              borderColor: 'rgb(255, 0, 110)',
              backgroundColor: 'rgba(255, 0, 110, 0.05)',
              padding: '16px',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm" style={{ marginBottom: '4px' }}>
                  Base Network
                </div>
                <div className="text-xs text-gray-500">Low fees, high throughput</div>
              </div>
              <div className="text-xs text-gray-600">Chain ID: 8453</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Step 5: Visibility & Description
function Step5Pricing({
  config,
  updateConfig,
}: {
  config: OracleConfig;
  updateConfig: (updates: Partial<OracleConfig>) => void;
}) {
  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      <h3 className="text-2xl font-bold" style={{ marginBottom: '8px' }}>
        VISIBILITY & DETAILS
      </h3>
      <p className="text-sm text-gray-500" style={{ marginBottom: '32px' }}>
        Configure how your oracle appears in the marketplace
      </p>

      {/* Beta Notice */}
      <div className="border-2 border-[rgb(0,255,136)] bg-[rgb(0,255,136)] bg-opacity-10 p-4 mb-6">
        <p className="text-sm text-[rgb(0,255,136)]">
          <strong>BETA:</strong> All oracles are free during beta. Monetization options coming soon!
        </p>
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 font-bold mb-2">
          ORACLE DESCRIPTION
        </label>
        <textarea
          value={config.description || ''}
          onChange={(e) => updateConfig({ description: e.target.value })}
          placeholder="Describe what your oracle does, what data it provides, and why users should use it..."
          rows={4}
          className="w-full bg-black border border-gray-800 text-white px-4 py-3 outline-none focus:border-gray-600 transition-colors resize-none"
        />
        <p className="text-xs text-gray-600 mt-2">
          A good description helps users discover and understand your oracle.
        </p>
      </div>

      {/* Visibility */}
      <div className="border border-gray-800 p-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.isPublic}
            onChange={(e) => updateConfig({ isPublic: e.target.checked })}
            className="w-5 h-5 mr-3 accent-[rgb(255,0,110)]"
          />
          <div>
            <div className="font-bold text-sm">LIST IN MARKETPLACE</div>
            <div className="text-xs text-gray-500">
              Make your oracle discoverable in the public marketplace
            </div>
          </div>
        </label>
      </div>

      {/* Future Monetization Teaser */}
      <div className="border border-gray-800 p-6 mt-6 opacity-60">
        <div className="text-sm font-bold text-gray-500 mb-2">COMING SOON: MONETIZATION</div>
        <p className="text-xs text-gray-600">
          After beta, you'll be able to charge for oracle access via subscriptions or pay-per-call.
          Build your user base now, monetize later.
        </p>
      </div>
    </div>
  );
}

// Step 6: Review
function Step6Review({ config }: { config: OracleConfig }) {
  const getPricingLabel = () => {
    switch (config.pricingModel) {
      case 'free': return 'Free';
      case 'pay_per_call': return `$${config.pricePerCall?.toFixed(4) || '0.0010'}/call`;
      case 'subscription': return `$${config.monthlyPrice || 10}/month`;
      case 'donation': return 'Donation-based';
      default: return 'Free';
    }
  };

  return (
    <div className="border border-gray-800 bg-black" style={{ padding: '40px' }}>
      <h3 className="text-2xl font-bold" style={{ marginBottom: '8px' }}>
        REVIEW & DEPLOY
      </h3>
      <p className="text-sm text-gray-500" style={{ marginBottom: '32px' }}>
        Verify your oracle configuration before deployment
      </p>

      <div className="space-y-6">
        <div className="border-b border-gray-900" style={{ paddingBottom: '16px' }}>
          <div className="text-xs text-gray-600" style={{ marginBottom: '4px' }}>
            ORACLE NAME
          </div>
          <div className="text-lg font-bold">{config.name || 'Unnamed Oracle'}</div>
        </div>

        <div className="border-b border-gray-900" style={{ paddingBottom: '16px' }}>
          <div className="text-xs text-gray-600" style={{ marginBottom: '4px' }}>
            TYPE
          </div>
          <div className="text-lg font-bold uppercase">{config.type} ORACLE</div>
        </div>

        <div className="border-b border-gray-900" style={{ paddingBottom: '16px' }}>
          <div className="text-xs text-gray-600" style={{ marginBottom: '4px' }}>
            DATA SOURCE
          </div>
          <div className="text-sm">
            <div className="font-bold" style={{ marginBottom: '4px' }}>
              Primary: {config.dataSource.primary}
            </div>
            {config.dataSource.backup && (
              <div className="text-gray-500">Backup: {config.dataSource.backup}</div>
            )}
          </div>
        </div>

        <div className="border-b border-gray-900" style={{ paddingBottom: '16px' }}>
          <div className="text-xs text-gray-600" style={{ marginBottom: '4px' }}>
            UPDATE FREQUENCY
          </div>
          <div className="text-lg font-bold">{config.updateFrequency} minutes</div>
        </div>

        <div className="border-b border-gray-900" style={{ paddingBottom: '16px' }}>
          <div className="text-xs text-gray-600" style={{ marginBottom: '4px' }}>
            CONSENSUS
          </div>
          <div className="text-lg font-bold">{config.consensusThreshold}% threshold</div>
        </div>

        <div className="border-b border-gray-900" style={{ paddingBottom: '16px' }}>
          <div className="text-xs text-gray-600" style={{ marginBottom: '4px' }}>
            PRICING
          </div>
          <div className="text-lg font-bold">{getPricingLabel()}</div>
          <div className="text-xs text-gray-500 mt-1">
            {config.isPublic ? 'Listed in marketplace' : 'Private oracle'}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600" style={{ marginBottom: '4px' }}>
            NETWORK
          </div>
          <div className="text-lg font-bold">Base (Chain ID: {config.chainId})</div>
        </div>
      </div>

      <div
        className="border"
        style={{
          borderColor: 'rgb(255, 0, 110)',
          backgroundColor: 'rgba(255, 0, 110, 0.05)',
          padding: '16px',
          marginTop: '32px',
        }}
      >
        <div className="text-sm font-bold" style={{ color: 'rgb(255, 0, 110)', marginBottom: '8px' }}>
          DEPLOYMENT INFO
        </div>
        <ul className="text-xs text-gray-400 space-y-2">
          <li>• Oracle contract will be deployed to Base</li>
          <li>• Cloudflare Worker will be configured automatically</li>
          <li>• Initial data will be fetched and validated</li>
          <li>• Estimated deployment time: 2-3 minutes</li>
          <li>• You will pay the gas fees (~$0.10-0.50 USD)</li>
        </ul>
      </div>
    </div>
  );
}
