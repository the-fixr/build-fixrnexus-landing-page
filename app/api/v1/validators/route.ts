import { NextResponse } from 'next/server';

const VALIDATORS = [
  {
    index: 0,
    address: '0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4',
    endpoint: 'https://feeds-validator-1.see21289.workers.dev',
  },
  {
    index: 1,
    address: '0xdd97618068a90c54F128ffFdfc49aa7847A52316',
    endpoint: 'https://feeds-validator-2.see21289.workers.dev',
  },
  {
    index: 2,
    address: '0x44E5018de76E9abFc6Ea2D5c3be7565Ea752088C',
    endpoint: 'https://feeds-validator-3.see21289.workers.dev',
  },
  {
    index: 3,
    address: '0xeC4119bCF8378d683dc223056e07c23E5998b8a6',
    endpoint: 'https://feeds-validator-4.see21289.workers.dev',
  },
  {
    index: 4,
    address: '0x0b103e2F80f232Abfee310b9DF6165b3e2f3357c',
    endpoint: 'https://feeds-validator-5.see21289.workers.dev',
  },
];

/**
 * GET /api/v1/validators
 * Check health and status of all validators
 */
export async function GET() {
  try {
    const healthChecks = await Promise.allSettled(
      VALIDATORS.map(async (validator) => {
        const startTime = Date.now();

        try {
          const response = await fetch(`${validator.endpoint}/health`, {
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          const responseTime = Date.now() - startTime;
          const data = await response.json();

          return {
            ...validator,
            status: 'online',
            healthy: response.ok,
            responseTime,
            data,
          };
        } catch (error: any) {
          return {
            ...validator,
            status: 'offline',
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error.message,
          };
        }
      })
    );

    const validators = healthChecks.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          status: 'error',
          healthy: false,
          responseTime: 0,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    const summary = {
      total: validators.length,
      online: validators.filter((v) => v.status === 'online').length,
      offline: validators.filter((v) => v.status === 'offline').length,
      healthy: validators.filter((v) => v.healthy).length,
      avgResponseTime:
        validators
          .filter((v) => v.responseTime && v.responseTime > 0)
          .reduce((sum, v) => sum + v.responseTime, 0) /
          Math.max(1, validators.filter((v) => v.responseTime && v.responseTime > 0).length),
    };

    return NextResponse.json({
      success: true,
      summary,
      validators,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Validators API error:', error);
    return NextResponse.json(
      { error: 'Failed to check validators', details: error.message },
      { status: 500 }
    );
  }
}
