import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client using the service role key
 * This bypasses Row Level Security (RLS) and should only be used by
 * trusted backend services like workers.
 * 
 * WARNING: Never expose this client to the frontend or untrusted code.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
