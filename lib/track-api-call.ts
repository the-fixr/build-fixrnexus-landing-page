// Utility to track API calls in Supabase
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

interface TrackApiCallParams {
  oracleAddress: string;
  endpoint: string;
  method?: string;
  statusCode: number;
  responseTimeMs: number;
}

export async function trackApiCall({
  oracleAddress,
  endpoint,
  method = 'GET',
  statusCode,
  responseTimeMs,
}: TrackApiCallParams) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get oracle_id from contract_address
    const { data: oracle } = await supabase
      .from('oracles')
      .select('id, user_id')
      .eq('contract_address', oracleAddress)
      .single();

    if (!oracle) {
      console.warn(`Oracle not found for address: ${oracleAddress}`);
      return;
    }

    // Get request metadata
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] ||
                     headersList.get('x-real-ip') ||
                     'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Insert API call record
    await supabase.from('api_calls').insert({
      oracle_id: oracle.id,
      user_id: oracle.user_id,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

  } catch (error) {
    // Don't throw - we don't want tracking failures to break API responses
    console.error('Failed to track API call:', error);
  }
}
