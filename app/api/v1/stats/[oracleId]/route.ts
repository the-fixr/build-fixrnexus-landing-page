import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/v1/stats/[oracleId]
 * Fetch API call statistics for an oracle
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ oracleId: string }> }
) {
  try {
    const { oracleId } = await params;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get oracle details with cached counters
    const { data: oracle, error: oracleError } = await supabase
      .from('oracles')
      .select('id, name, contract_address, total_api_calls, calls_today, calls_this_week, calls_this_month, last_call_at')
      .eq('id', oracleId)
      .single();

    if (oracleError || !oracle) {
      return NextResponse.json(
        { error: 'Oracle not found' },
        { status: 404 }
      );
    }

    // Get recent call history (last 7 days, grouped by day)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentCalls, error: callsError } = await supabase
      .from('api_calls')
      .select('created_at, endpoint, status_code, response_time_ms')
      .eq('oracle_id', oracleId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (callsError) {
      console.error('Error fetching recent calls:', callsError);
      return NextResponse.json(
        { error: 'Failed to fetch call history' },
        { status: 500 }
      );
    }

    // Group calls by day for charting
    const callsByDay: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    // Initialize all days to 0
    last7Days.forEach(day => {
      callsByDay[day] = 0;
    });

    // Count calls per day
    (recentCalls || []).forEach(call => {
      const day = call.created_at.split('T')[0];
      if (callsByDay[day] !== undefined) {
        callsByDay[day]++;
      }
    });

    // Calculate average response time
    const responseTimes = (recentCalls || [])
      .filter(c => c.response_time_ms !== null)
      .map(c => c.response_time_ms);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    // Calculate success rate
    const totalRecentCalls = (recentCalls || []).length;
    const successfulCalls = (recentCalls || []).filter(c => c.status_code === 200).length;
    const successRate = totalRecentCalls > 0
      ? Math.round((successfulCalls / totalRecentCalls) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      oracle: {
        id: oracle.id,
        name: oracle.name,
        address: oracle.contract_address,
      },
      stats: {
        totalCalls: oracle.total_api_calls || 0,
        callsToday: oracle.calls_today || 0,
        callsThisWeek: oracle.calls_this_week || 0,
        callsThisMonth: oracle.calls_this_month || 0,
        lastCallAt: oracle.last_call_at,
        avgResponseTimeMs: avgResponseTime,
        successRate,
      },
      history: {
        last7Days: last7Days.map(day => ({
          date: day,
          calls: callsByDay[day],
        })),
      },
    });
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics', details: error.message },
      { status: 500 }
    );
  }
}
