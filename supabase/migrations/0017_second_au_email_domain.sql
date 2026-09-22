-- ===========================================================================
-- 0017 — Ajman University's second email domain.
--
-- Students are issued addresses on both @ajmanuni.ac.ae and @ajman.ac.ae.
-- The app already accepts either (AU_EMAIL_DOMAINS in src/types); this widens
-- the two database-side gates so they agree:
--
--   * hook_restrict_au_domain — the authoritative Before User Created hook
--   * staff_override_codes.override_email_domain — the booth override path
--
-- Run this BEFORE deploying the matching app build. Until it runs, an
-- @ajman.ac.ae address passes validation and is then rejected by the auth
-- hook, so the student sees a send failure and never gets a code.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Before User Created hook (§3) — replaces the version from 0003.
-- Wired up in Dashboard -> Authentication -> Hooks -> Before User Created;
-- replacing the function in place keeps that wiring intact.
-- ---------------------------------------------------------------------------
create or replace function public.hook_restrict_au_domain(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_email text;
begin
  v_email := lower(trim(event->'user'->>'email'));

  -- Exact alternation, never a suffix match: 'a@sub.ajman.ac.ae' and
  -- 'a@ajman.ac.ae.evil.com' must both still fail.
  if v_email is null or v_email !~ '^[^@\s]+@(ajmanuni\.ac\.ae|ajman\.ac\.ae)$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Use your Ajman University email address to play.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_restrict_au_domain to supabase_auth_admin;
revoke execute on function public.hook_restrict_au_domain from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- staff_override_codes (§38) — the CHECK constraint from 0002.
-- A strict widening of the old predicate, so every existing row still passes.
-- ---------------------------------------------------------------------------
alter table public.staff_override_codes
  drop constraint if exists override_email_domain;

alter table public.staff_override_codes
  add constraint override_email_domain
  check (email like '%@ajmanuni.ac.ae' or email like '%@ajman.ac.ae');

-- ---------------------------------------------------------------------------
-- Verification. Both should return true.
-- ---------------------------------------------------------------------------
-- select public.hook_restrict_au_domain(
--   jsonb_build_object('user', jsonb_build_object('email', '202312345@ajman.ac.ae'))
-- ) = '{}'::jsonb as ajman_allowed;
--
-- select public.hook_restrict_au_domain(
--   jsonb_build_object('user', jsonb_build_object('email', 'someone@gmail.com'))
-- ) ? 'error' as gmail_blocked;
