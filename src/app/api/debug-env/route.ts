// Debug endpoint to check env vars
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

  return NextResponse.json({
    supabaseUrl: {
      value: supabaseUrl.slice(0, 40) + '...',
      length: supabaseUrl.length,
      endsWithNewline: supabaseUrl.endsWith('\n'),
      lastChar: supabaseUrl.charCodeAt(supabaseUrl.length - 1),
    },
    supabaseKey: {
      length: supabaseKey.length,
      endsWithNewline: supabaseKey.endsWith('\n'),
      lastChar: supabaseKey.charCodeAt(supabaseKey.length - 1),
    },
  });
}
