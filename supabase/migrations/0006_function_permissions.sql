-- ============================================================================
-- AU vs AI — 0006 Function execution permissions (SECURITY)
--
-- WHY THIS FILE EXISTS
--
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Combined
-- with SECURITY DEFINER (which makes a function run with its owner's rights,
-- ignoring RLS), that default is dangerous: any anon or authenticated client
-- holding the public anon key could call our functions directly through
-- PostgREST and bypass the "all writes go through the server" architecture.
--
-- Concretely, without this file a student could call:
--   start_attempt()             -> create attempts for arbitrary user ids
--   get_attempt_assignment()    -> read any attempt's assignment
--   get_attempt_result_public() -> read any student's result
--   abandon_stale_attempts()    -> mass-abandon live games mid-fair
--   is_admin()                  -> probe the admin allowlist
--
-- This migration makes execution OPT-IN. Run it LAST, after 0001-0005.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Future-proofing.
--
-- Any function created later by this role in `public` starts with no PUBLIC
-- execute grant, so a forgotten REVOKE cannot silently open a hole. This is
-- the safety net for whoever adds a function at 1am on 20 September.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  revoke execute on functions from public;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Revoke the defaults already granted on existing functions.
--
-- Each REVOKE names PUBLIC explicitly. Revoking from anon/authenticated alone
-- is NOT sufficient — they inherit the PUBLIC grant, so PUBLIC must go too.
-- ---------------------------------------------------------------------------

-- Attempt lifecycle (0003)
revoke all on function public.start_attempt(uuid)
  from public, anon, authenticated;
revoke all on function public.get_attempt_assignment(uuid)
  from public, anon, authenticated;
revoke all on function public.get_attempt_result_public(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.abandon_stale_attempts()
  from public, anon, authenticated;

-- Admin check (0002)
revoke all on function public.is_admin(uuid)
  from public, anon, authenticated;

-- Trigger helper (0001). Trigger functions are invoked by the system in the
-- table owner's context, so revoking direct EXECUTE does not break triggers.
revoke all on function public.touch_updated_at()
  from public, anon, authenticated;

-- Auth hook (0003). Already granted to supabase_auth_admin in that migration;
-- repeated here so the full permission picture lives in one auditable file.
revoke all on function public.hook_restrict_au_domain(jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Grant execution to exactly the roles that need it.
--
-- service_role is the key our Next.js server routes hold. Nothing else in the
-- application should be able to call these.
-- ---------------------------------------------------------------------------
grant execute on function public.start_attempt(uuid)                to service_role;
grant execute on function public.get_attempt_assignment(uuid)       to service_role;
grant execute on function public.get_attempt_result_public(uuid, uuid) to service_role;
grant execute on function public.abandon_stale_attempts()           to service_role;
grant execute on function public.is_admin(uuid)                     to service_role;

-- The auth hook is called by Supabase's auth server, never by us.
grant execute on function public.hook_restrict_au_domain(jsonb)     to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 4. Lock down the schema itself.
--
-- anon and authenticated still need USAGE on `public` to reach the granted
-- views (leaderboard_public, event_stats_public and friends). They do not
-- need CREATE, which would let a client define its own objects.
-- ---------------------------------------------------------------------------
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. VERIFICATION QUERY
--
-- Run this after applying. Every row returned is a function still callable by
-- anon or authenticated. The expected result is ZERO ROWS.
--
--   select p.proname,
--          pg_get_function_identity_arguments(p.oid) as args,
--          r.rolname
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral (values ('anon'),('authenticated')) as r(rolname)
--   where n.nspname = 'public'
--     and has_function_privilege(r.rolname, p.oid, 'EXECUTE');
--
-- And this one lists every SECURITY DEFINER function with its grants, which is
-- the review to repeat before the fair:
--
--   select p.proname, p.prosecdef as security_definer, p.proacl as grants
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--   order by p.prosecdef desc, p.proname;
-- ---------------------------------------------------------------------------
