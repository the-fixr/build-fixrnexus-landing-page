import { createBrowserClient } from '@supabase/ssr';

// Cache the client to avoid recreating it on every call
let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // During SSR/build, return a mock client that won't make network requests
    // This prevents build errors while allowing runtime to work properly
    console.warn('Supabase environment variables not available');
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }

  cachedClient = createBrowserClient(supabaseUrl, supabaseKey);
  return cachedClient;
};
