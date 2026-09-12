/**
 * Browser Supabase client. Uses the PUBLIC anon key and is bound by RLS.
 * It can read the leaderboard views, colleges, and the student's own rows.
 * It cannot write any gameplay table (§39).
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
