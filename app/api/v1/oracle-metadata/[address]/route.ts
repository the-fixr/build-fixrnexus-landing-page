import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/v1/oracle-metadata/[address]
 * Fetch oracle metadata from database (used by validators to get target token and data source)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: oracle, error } = await supabase
      .from('oracles')
      .select('*')
      .eq('contract_address', address)
      .single();

    if (error || !oracle) {
      return NextResponse.json(
        { error: 'Oracle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      oracle: {
        address: oracle.contract_address,
        name: oracle.name,
        oracleType: oracle.oracle_type,
        targetToken: oracle.target_token,
        dataSource: oracle.data_source,
        updateFrequency: oracle.update_frequency,
        consensusThreshold: oracle.consensus_threshold,
      },
    });
  } catch (error: any) {
    console.error('Oracle metadata API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch oracle metadata', details: error.message },
      { status: 500 }
    );
  }
}
