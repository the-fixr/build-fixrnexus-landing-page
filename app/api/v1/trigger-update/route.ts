import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COOLDOWN_MINUTES = 60;

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
 * GET /api/v1/trigger-update?address=0x...
 * Check cooldown status for an oracle without triggering
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const oracleAddress = searchParams.get('address');

    if (!oracleAddress) {
      return NextResponse.json(
        { error: 'Oracle address is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: oracle, error: oracleError } = await supabase
      .from('oracles')
      .select('id, last_triggered_at, name')
      .eq('contract_address', oracleAddress)
      .single();

    if (oracleError || !oracle) {
      return NextResponse.json(
        { error: 'Oracle not found in database' },
        { status: 404 }
      );
    }

    let canTrigger = true;
    let minutesRemaining = 0;
    let nextAvailableAt = null;

    if (oracle.last_triggered_at) {
      const lastTriggered = new Date(oracle.last_triggered_at);
      const now = new Date();
      const minutesSinceLastTrigger = (now.getTime() - lastTriggered.getTime()) / (1000 * 60);

      if (minutesSinceLastTrigger < COOLDOWN_MINUTES) {
        canTrigger = false;
        minutesRemaining = Math.ceil(COOLDOWN_MINUTES - minutesSinceLastTrigger);
        nextAvailableAt = new Date(lastTriggered.getTime() + COOLDOWN_MINUTES * 60 * 1000).toISOString();
      }
    }

    return NextResponse.json({
      success: true,
      oracleAddress,
      oracleName: oracle.name,
      canTrigger,
      cooldownMinutes: COOLDOWN_MINUTES,
      lastTriggeredAt: oracle.last_triggered_at,
      minutesRemaining: canTrigger ? 0 : minutesRemaining,
      nextAvailableAt,
    });
  } catch (error: any) {
    console.error('Check cooldown API error:', error);
    return NextResponse.json(
      { error: 'Failed to check cooldown status', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/trigger-update
 * Triggers all validators to check and submit prices for a specific oracle immediately
 * Enforces 60-minute cooldown to prevent abuse
 */
export async function POST(request: Request) {
  try {
    const { oracleAddress } = await request.json();

    if (!oracleAddress) {
      return NextResponse.json(
        { error: 'Oracle address is required' },
        { status: 400 }
      );
    }

    // Check cooldown in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: oracle, error: oracleError } = await supabase
      .from('oracles')
      .select('id, last_triggered_at, name')
      .eq('contract_address', oracleAddress)
      .single();

    if (oracleError || !oracle) {
      return NextResponse.json(
        { error: 'Oracle not found in database' },
        { status: 404 }
      );
    }

    // Check if cooldown is still active
    if (oracle.last_triggered_at) {
      const lastTriggered = new Date(oracle.last_triggered_at);
      const now = new Date();
      const minutesSinceLastTrigger = (now.getTime() - lastTriggered.getTime()) / (1000 * 60);

      if (minutesSinceLastTrigger < COOLDOWN_MINUTES) {
        const minutesRemaining = Math.ceil(COOLDOWN_MINUTES - minutesSinceLastTrigger);
        return NextResponse.json(
          {
            error: 'Cooldown active',
            message: `Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} before triggering again`,
            cooldownMinutes: COOLDOWN_MINUTES,
            minutesRemaining,
            nextAvailableAt: new Date(lastTriggered.getTime() + COOLDOWN_MINUTES * 60 * 1000).toISOString(),
          },
          { status: 429 } // 429 Too Many Requests
        );
      }
    }

    // Trigger all validators in parallel
    const results = await Promise.allSettled(
      VALIDATORS.map(async (validator) => {
        try {
          const response = await fetch(`${validator.endpoint}/trigger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ oracleAddress }),
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          const data = await response.json();

          return {
            validator: validator.address,
            endpoint: validator.endpoint,
            success: response.ok,
            data,
          };
        } catch (error: any) {
          return {
            validator: validator.address,
            endpoint: validator.endpoint,
            success: false,
            error: error.message,
          };
        }
      })
    );

    const validatorResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          validator: VALIDATORS[index].address,
          endpoint: VALIDATORS[index].endpoint,
          success: false,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    const successCount = validatorResults.filter((r) => r.success).length;
    const totalCount = validatorResults.length;

    // Update last_triggered_at timestamp
    await supabase
      .from('oracles')
      .update({ last_triggered_at: new Date().toISOString() })
      .eq('id', oracle.id);

    return NextResponse.json({
      success: true,
      message: `Triggered ${successCount}/${totalCount} validators`,
      oracleAddress,
      validators: validatorResults,
      timestamp: new Date().toISOString(),
      cooldownMinutes: COOLDOWN_MINUTES,
    });
  } catch (error: any) {
    console.error('Trigger update API error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger validators', details: error.message },
      { status: 500 }
    );
  }
}
