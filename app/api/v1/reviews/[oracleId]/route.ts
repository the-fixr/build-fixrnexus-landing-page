import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/v1/reviews/[oracleId]
 * Get all reviews for an oracle
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ oracleId: string }> }
) {
  try {
    const { oracleId } = await params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'helpful'; // helpful, recent, rating

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build query
    let query = supabase
      .from('oracle_reviews')
      .select(`
        *,
        profiles(username, avatar_url)
      `, { count: 'exact' })
      .eq('oracle_id', oracleId);

    // Sorting
    switch (sortBy) {
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'helpful':
      default:
        query = query.order('helpful_count', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch reviews', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reviews: reviews || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error: any) {
    console.error('Reviews API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reviews/[oracleId]
 * Create a new review for an oracle
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ oracleId: string }> }
) {
  try {
    const { oracleId } = await params;
    const body = await request.json();

    const {
      rating,
      title,
      review_text,
      data_quality_rating,
      performance_rating,
      value_rating,
      support_rating,
    } = body;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be between 1 and 5' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length < 3) {
      return NextResponse.json(
        { error: 'Title must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!review_text || review_text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Review must be at least 10 characters' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if oracle exists and is public
    const { data: oracle, error: oracleError } = await supabase
      .from('oracles')
      .select('id, is_public')
      .eq('id', oracleId)
      .single();

    if (oracleError || !oracle) {
      return NextResponse.json(
        { error: 'Oracle not found' },
        { status: 404 }
      );
    }

    if (!oracle.is_public) {
      return NextResponse.json(
        { error: 'Cannot review private oracles' },
        { status: 403 }
      );
    }

    // Check if user has made API calls to this oracle (for verified badge)
    const { data: apiCalls } = await supabase
      .from('api_calls')
      .select('id', { count: 'exact', head: true })
      .eq('oracle_id', oracleId)
      .eq('user_id', user.id);

    const usageCount = apiCalls?.length || 0;
    const verified = usageCount >= 10; // Minimum 10 calls to be verified

    // Insert review
    const { data: review, error: insertError } = await supabase
      .from('oracle_reviews')
      .insert({
        oracle_id: oracleId,
        user_id: user.id,
        rating,
        title: title.trim(),
        review_text: review_text.trim(),
        data_quality_rating,
        performance_rating,
        value_rating,
        support_rating,
        verified_user: verified,
        usage_count: usageCount,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'You have already reviewed this oracle' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create review', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create review error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
