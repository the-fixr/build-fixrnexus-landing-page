'use client';

import { useEffect, useState } from 'react';

interface ValidatorHealth {
  status: string;
  validator: string;
  timestamp: number;
  error?: string;
}

interface ValidatorInfo {
  index: number;
  name: string;
  endpoint: string;
  address: string;
  health: ValidatorHealth | null;
  loading: boolean;
}

const VALIDATORS: Omit<ValidatorInfo, 'health' | 'loading'>[] = [
  {
    index: 1,
    name: 'Validator 1',
    endpoint: 'https://feeds-validator-1.see21289.workers.dev',
    address: '0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4'
  },
  {
    index: 2,
    name: 'Validator 2',
    endpoint: 'https://feeds-validator-2.see21289.workers.dev',
    address: '0xdd97618068a90c54F128ffFdfc49aa7847A52316'
  },
  {
    index: 3,
    name: 'Validator 3',
    endpoint: 'https://feeds-validator-3.see21289.workers.dev',
    address: '0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C'
  },
  {
    index: 4,
    name: 'Validator 4',
    endpoint: 'https://feeds-validator-4.see21289.workers.dev',
    address: '0xeC4119bCF8378d683dc223056e07c23E5998b8a6'
  },
  {
    index: 5,
    name: 'Validator 5',
    endpoint: 'https://feeds-validator-5.see21289.workers.dev',
    address: '0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c'
  }
];

export default function HealthPage() {
  const [validators, setValidators] = useState<ValidatorInfo[]>(
    VALIDATORS.map(v => ({ ...v, health: null, loading: true }))
  );
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const checkHealth = async () => {
    const results = await Promise.all(
      VALIDATORS.map(async (validator) => {
        try {
          const response = await fetch(`${validator.endpoint}/health`);
          const health = await response.json();
          return { ...validator, health, loading: false };
        } catch (error) {
          return {
            ...validator,
            health: {
              status: 'unhealthy',
              error: 'Connection failed',
              validator: validator.address,
              timestamp: Date.now()
            },
            loading: false
          };
        }
      })
    );

    setValidators(results);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const healthyCount = validators.filter(v => v.health?.status === 'healthy').length;
  const totalCount = validators.length;

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Validator Network Status</h1>
          <p className="text-gray-600">Real-time health monitoring of FEEDS oracle validators</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Network Status</div>
            <div className="text-3xl font-bold">
              {healthyCount === totalCount ? (
                <span className="text-green-600">Operational</span>
              ) : healthyCount >= 3 ? (
                <span className="text-yellow-600">Degraded</span>
              ) : (
                <span className="text-red-600">Critical</span>
              )}
            </div>
          </div>

          <div className="border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Active Validators</div>
            <div className="text-3xl font-bold">
              {healthyCount}/{totalCount}
            </div>
          </div>

          <div className="border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Last Updated</div>
            <div className="text-lg font-mono">
              {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {validators.map((validator) => (
            <div
              key={validator.index}
              className="border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{validator.name}</h3>
                  <div className="font-mono text-sm text-gray-600">
                    {validator.address}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {validator.loading ? (
                    <span className="text-sm text-gray-400">Checking...</span>
                  ) : (
                    <>
                      <div
                        className={`w-3 h-3 rounded-full ${
                          validator.health?.status === 'healthy'
                            ? 'bg-green-600'
                            : 'bg-red-600'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          validator.health?.status === 'healthy'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {validator.health?.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {validator.health && !validator.loading && validator.health.status === 'healthy' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Endpoint</div>
                    <a
                      href={validator.endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Check
                    </a>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Last Seen</div>
                    <div className="font-mono text-sm">
                      {validator.health.timestamp ? new Date(validator.health.timestamp).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Response Time</div>
                    <div className="font-mono text-sm">
                      {validator.health.timestamp && Date.now() - validator.health.timestamp < 5000 ? (
                        <span className="text-green-600">Fast</span>
                      ) : (
                        <span className="text-yellow-600">Slow</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {validator.health?.error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200">
                  <div className="text-sm text-red-800">
                    Error: {validator.health.error}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 border border-gray-200 bg-gray-50">
          <h3 className="font-bold mb-2">Contract Addresses</h3>
          <div className="space-y-2 text-sm font-mono">
            <div>
              <span className="text-gray-600">Registry:</span>{' '}
              <a
                href="https://basescan.org/address/0x9262cDe71f1271Ea542545C7A379E112f904439b"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                0x9262cDe71f1271Ea542545C7A379E112f904439b
              </a>
            </div>
            <div>
              <span className="text-gray-600">Factory:</span>{' '}
              <a
                href="https://basescan.org/address/0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                0xD73d27A47570c11c231a97Ab6E06B33a72AB64B6
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
