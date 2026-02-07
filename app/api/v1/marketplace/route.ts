import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/v1/marketplace
 * Public oracle discovery endpoint with filters and sorting
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Filter parameters
    const type = searchParams.get('type'); // price, farcaster, liquidity, custom
    const search = searchParams.get('search'); // Search in name, description
    const minRating = searchParams.get('minRating'); // Minimum average rating
    const pricingModel = searchParams.get('pricingModel'); // free, pay_per_call, subscription, donation

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'popularity'; // popularity, rating, newest, usage
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build query
    let query = supabase
      .from('oracles')
      .select(`
        *,
        oracle_stats(
          average_rating,
          total_reviews,
          total_api_calls,
          unique_users,
          calls_last_24h,
          calls_last_7d,
          popularity_score
        )
      `, { count: 'exact' })
      .eq('is_public', true)
      .eq('is_hidden', false) // Exclude retired oracles
      .not('contract_address', 'is', null); // Only deployed oracles

    // Apply filters
    if (type) {
      query = query.eq('oracle_type', type);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,target_token.ilike.%${search}%`);
    }

    if (minRating) {
      query = query.gte('oracle_stats.average_rating', parseFloat(minRating));
    }

    if (pricingModel) {
      query = query.eq('pricing_model', pricingModel);
    }

    // Apply sorting
    switch (sortBy) {
      case 'rating':
        query = query.order('average_rating', { foreignTable: 'oracle_stats', ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'usage':
        query = query.order('total_api_calls', { foreignTable: 'oracle_stats', ascending: false });
        break;
      case 'popularity':
      default:
        query = query.order('popularity_score', { foreignTable: 'oracle_stats', ascending: false, nullsFirst: false });
        break;
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: oracles, error, count } = await query;

    if (error) {
      console.error('Marketplace query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch oracles', details: error.message },
        { status: 500 }
      );
    }

    // Format response
    const formattedOracles = (oracles || []).map(oracle => ({
      id: oracle.id,
      name: oracle.name,
      description: oracle.description,
      type: oracle.oracle_type,
      targetToken: oracle.target_token,
      contractAddress: oracle.contract_address,
      creator: oracle.user_id,

      // Pricing
      pricingModel: oracle.pricing_model || 'free',
      pricePerCall: oracle.price_per_call,
      monthlyPrice: oracle.monthly_price,

      // Stats
      stats: oracle.oracle_stats?.[0] || {
        average_rating: 0,
        total_reviews: 0,
        total_api_calls: 0,
        unique_users: 0,
        calls_last_24h: 0,
        calls_last_7d: 0,
        popularity_score: 0,
      },

      // Metadata
      createdAt: oracle.created_at,
      updateFrequency: oracle.update_frequency,
      consensusThreshold: oracle.consensus_threshold,
    }));

    return NextResponse.json({
      success: true,
      oracles: formattedOracles,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      filters: {
        type,
        search,
        minRating,
        pricingModel,
        sortBy,
      },
    });
  } catch (error: any) {
    console.error('Marketplace API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
