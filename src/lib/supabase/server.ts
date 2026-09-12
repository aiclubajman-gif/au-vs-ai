/**
 * Server-side Supabase clients.
 *
 * createServerSupabase()  — acts AS the signed-in student, still bound by RLS.
 *                           Use for reading who the caller is.
 *
 * createAdminSupabase()   — SERVICE ROLE. Bypasses RLS entirely. Every
 *                           gameplay write goes through this. It must never
 *                           reach a browser bundle; the import guard below
 *                           throws loudly if it ever does.
 */
import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  );
}

let adminWarned = false;

export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Server-side writes cannot run.',
    );
  }

  if (typeof window !== 'undefined') {
    throw new Error(
      'FATAL: the service role client was constructed in a browser context.',
    );
  }

  if (!adminWarned && process.env.NODE_ENV === 'development') {
    adminWarned = true;
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
