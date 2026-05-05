import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service role key.
 * Import only in API routes (app/api/**) — never in client components.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('SUPABASE_URL is not set in environment variables');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
  if (!url.startsWith('https://')) throw new Error(`SUPABASE_URL looks wrong: "${url}" — must start with https://`);

  console.log('[supabase] connecting to:', url);
  return createClient(url, key, { auth: { persistSession: false } });
}
