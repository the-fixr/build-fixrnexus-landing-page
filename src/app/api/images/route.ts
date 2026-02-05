// Fixr Images Endpoint - Fetches from Supabase fixr-images bucket
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Images API: Missing Supabase credentials');
      return NextResponse.json({
        success: false,
        error: 'Missing credentials',
        images: []
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // List files from the fixr-images bucket (no sortBy to avoid potential issues)
    const { data: files, error } = await supabase.storage
      .from('fixr-images')
      .list('', {
        limit: 100,
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        images: [],
        debug: { supabaseUrl, bucket: 'fixr-images' }
      }, { status: 500 });
    }

    console.log('Files from bucket:', files?.length || 0, 'files found');

    // Filter for image files and build public URLs
    const images = (files || [])
      .filter((file) => {
        // Skip folders (they have no metadata)
        if (!file.name || file.id === null) return false;
        const name = file.name.toLowerCase();
        return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.gif');
      })
      .map((file) => ({
        id: file.id || file.name,
        url: `${supabaseUrl}/storage/v1/object/public/fixr-images/${file.name}`,
        title: file.name
          .replace(/\.[^/.]+$/, '')  // Remove extension
          .replace(/-\d{13}$/, '')   // Remove timestamp
          .replace(/-/g, ' ')        // Replace dashes with spaces
          .trim(),
        created_at: file.created_at || new Date().toISOString(),
      }))
      // Sort by created_at descending (newest first)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      success: true,
      images,
      count: images.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Images API error:', error);
    return NextResponse.json(
      { success: false, error: String(error), images: [] },
      { status: 500 }
    );
  }
}
