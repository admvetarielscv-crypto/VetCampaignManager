/**
 * Supabase client (singleton).
 *
 * Only initialized when `HAS_SUPABASE` is true (both SUPABASE_URL and
 * SUPABASE_ANON_KEY are set). Otherwise the app falls back to localStorage.
 *
 * For server-side secrets (webhook URL, HMAC key), the anon key is safe in
 * the browser — RLS policies in `supabase/migrations/` enforce that users can
 * only see/modify rows belonging to their tenant.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { RUNTIME } from '@/app/runtime'

/** Re-export so feature code can branch on a single import. */
export const HAS_SUPABASE = RUNTIME.VITE_SUPABASE_URL !== ''

let client: SupabaseClient | null = null

if (HAS_SUPABASE) {
  client = createClient(RUNTIME.VITE_SUPABASE_URL, RUNTIME.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
}

export const supabase = client

/**
 * Throws when the app tries to use Supabase but it wasn't configured. Callers
 * that depend on Supabase should guard with `HAS_SUPABASE` first.
 */
export function requireSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env',
    )
  }
  return client
}