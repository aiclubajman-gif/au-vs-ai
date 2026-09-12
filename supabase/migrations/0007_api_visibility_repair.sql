-- ============================================================================
-- AU vs AI — 0007 API visibility repair
--
-- SYMPTOM
--   Views and functions work, but every table returns PGRST205
--   ("Could not find the table in the schema cache") through the REST API.
--
-- WHY IT HAPPENS
--   PostgREST — the service that turns your tables into a REST API — keeps an
--   in-memory cache of the schema. It normally refreshes when DDL runs, but a
--   large batch of migrations pasted into the SQL Editor can finish before the
--   reload fires, leaving the API serving a picture of the database from
--   before your tables existed.
--
--   A second possibility is that the table-level grants Supabase normally
--   applies did not land on tables created inside a long migration script.
--
-- This file fixes both. It is SAFE TO RE-RUN as many times as you like.
-- It does NOT weaken Row Level Security: RLS is evaluated after grants, so
-- granting table access to anon still leaves every gameplay table locked by
-- the policies in 0004. The break-in tests in `npm run verify:db` prove this.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Restore the standard Supabase role grants.
--
-- anon and authenticated get table-level SELECT so PostgREST will route to the
-- table at all; RLS then decides whether any row is actually returned. For
-- every gameplay table that answer is "none", because 0004 defines no policy.
-- ---------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all privileges on all tables    in schema public to postgres, service_role;
grant all privileges on all sequences in schema public to postgres, service_role;

grant select on all tables in schema public to anon, authenticated;

-- Sequences are needed for identity columns on rows the server inserts.
grant usage, select on all sequences in schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Re-apply the function lockdown from 0006.
--
-- The blanket grants above do not touch functions, but running this again
-- costs nothing and guarantees the two files cannot drift apart.
-- ---------------------------------------------------------------------------
revoke all on function public.start_attempt(uuid)                   from public, anon, authenticated;
revoke all on function public.get_attempt_assignment(uuid)          from public, anon, authenticated;
revoke all on function public.get_attempt_result_public(uuid, uuid) from public, anon, authenticated;
revoke all on function public.abandon_stale_attempts()              from public, anon, authenticated;
revoke all on function public.is_admin(uuid)                        from public, anon, authenticated;
revoke all on function public.touch_updated_at()                    from public, anon, authenticated;
revoke all on function public.hook_restrict_au_domain(jsonb)        from public, anon, authenticated;

grant execute on function public.start_attempt(uuid)                   to service_role;
grant execute on function public.get_attempt_assignment(uuid)          to service_role;
grant execute on function public.get_attempt_result_public(uuid, uuid) to service_role;
grant execute on function public.abandon_stale_attempts()              to service_role;
grant execute on function public.is_admin(uuid)                        to service_role;
grant execute on function public.hook_restrict_au_domain(jsonb)        to supabase_auth_admin;

-- Clients must not be able to create objects in the public schema.
revoke create on schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Confirm RLS is still on for every gameplay table.
--
-- This is the guard that makes step 1 safe. If any of these were off, the
-- SELECT grant above would genuinely expose data, so we assert rather than
-- assume. The script raises loudly instead of failing quietly.
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_unprotected text[] := '{}';
begin
  foreach v_table in array array[
    'profiles', 'attempts', 'attempt_round1', 'attempt_round2', 'attempt_round3',
    'round1_images', 'round2_classes', 'round3_question', 'colleges',
    'event_settings', 'admins', 'admin_actions', 'staff_override_codes',
    'club_registrations', 'raffle_runs', 'dataset_tokens', 'dataset_responses',
    'app_events'
  ]
  loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity
    ) then
      v_unprotected := v_unprotected || v_table;
    end if;
  end loop;

  if array_length(v_unprotected, 1) > 0 then
    raise exception
      'RLS IS OFF on: %. Do not deploy. Re-run 0004_rls_and_views.sql.',
      array_to_string(v_unprotected, ', ');
  end if;

  raise notice 'RLS confirmed enabled on all 18 gameplay tables.';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tell PostgREST to rebuild its cache. This is the actual fix.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
