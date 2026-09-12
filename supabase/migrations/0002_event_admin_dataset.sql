-- ============================================================================
-- AU vs AI — 0002 Event settings, admin, registration, raffle, dataset
-- ============================================================================

-- ---------------------------------------------------------------------------
-- event_settings  (§41 — single row; every tunable number lives here so that
-- changing a timer at the booth is a form field, not a redeploy)
-- ---------------------------------------------------------------------------
create table public.event_settings (
  id smallint primary key default 1,

  -- Event control
  challenge_open        boolean not null default false,
  new_games_paused      boolean not null default false,
  entries_closed        boolean not null default false,  -- gates R3 reveal (§21)
  maintenance_message   text,

  -- Timers (ms)
  round1_ms_per_image   integer not null default 6000,
  round2_draw_ms        integer not null default 20000,
  round3_ms             integer not null default 12000,

  -- Scoring
  human_win_threshold   integer not null default 600,
  round2_recognition_threshold real not null default 0.55,
  round2_speed_bonus_max integer not null default 40,

  -- Round 3 (§20). HIDDEN from students. Decoupled from the slider range:
  -- min_value/max_value bound what a student can select, nothing more. These
  -- two values alone control scoring difficulty, so the range can be widened
  -- for usability without accidentally making the round easier.
  -- A guess further than `tolerance` from the answer scores exactly zero.
  -- Both must be tuned during testing week and FROZEN before the fair.
  round3_scoring_tolerance  numeric not null default 20,
  round3_tolerance_exponent real   not null default 1.5,

  -- Display
  leaderboard_display   leaderboard_display_mode not null default 'name_and_masked_id',
  collect_college       boolean not null default true,

  -- Housekeeping
  abandon_after_minutes integer not null default 20,

  updated_at timestamptz not null default now(),

  constraint event_settings_singleton check (id = 1),
  constraint event_settings_threshold_range check (human_win_threshold between 0 and 1000),
  constraint event_settings_r2_threshold_range check (round2_recognition_threshold between 0 and 1),
  -- Tolerance is a divisor in the scoring curve; zero would divide by zero.
  constraint event_settings_r3_tolerance_positive check (round3_scoring_tolerance > 0),
  constraint event_settings_r3_exponent_positive check (round3_tolerance_exponent > 0)
);

insert into public.event_settings (id) values (1);

create trigger event_settings_touch_updated_at
  before update on public.event_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- admins  (§39 — server-side allowlist; hiding buttons is not access control)
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  can_reset  boolean not null default true,
  can_raffle boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = uid);
$$;

-- ---------------------------------------------------------------------------
-- admin_actions  (§39 audit log)
-- ---------------------------------------------------------------------------
create table public.admin_actions (
  id           bigint generated always as identity primary key,
  admin_id     uuid references auth.users(id),
  admin_email  text,
  action       text not null,
  target_type  text,
  target_id    text,
  details      jsonb,
  created_at   timestamptz not null default now()
);

create index admin_actions_created_idx on public.admin_actions(created_at desc);

-- ---------------------------------------------------------------------------
-- staff_override_codes  (§38)
-- ---------------------------------------------------------------------------
create table public.staff_override_codes (
  id           uuid primary key default gen_random_uuid(),
  email        text        not null,
  code_hash    text        not null,
  id_verified  boolean     not null default false,
  issued_by    uuid        references auth.users(id),
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  used_at      timestamptz,

  constraint override_email_domain check (email like '%@ajmanuni.ac.ae')
);

create index override_email_idx on public.staff_override_codes(email) where used_at is null;

-- ---------------------------------------------------------------------------
-- club_registrations  (§27 — consent is explicit and separate from gameplay)
-- ---------------------------------------------------------------------------
create table public.club_registrations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  full_name     text not null,
  contact_email text not null,
  phone         text,
  college_id    smallint references public.colleges(id),
  study_year    text,
  interests     text[] not null default '{}',
  consent_comms boolean not null default false,
  consent_raffle boolean not null default false,
  created_at    timestamptz not null default now(),

  -- Registration rows may only exist with explicit consent.
  constraint registration_requires_consent check (consent_comms)
);

-- ---------------------------------------------------------------------------
-- raffle_runs  (§28 — auditable)
-- ---------------------------------------------------------------------------
create table public.raffle_runs (
  id                 uuid primary key default gen_random_uuid(),
  winner_user_id     uuid references auth.users(id),
  winner_name        text,
  eligible_count     integer not null,
  eligible_user_ids  uuid[] not null,
  random_seed        text   not null,
  run_by             uuid references auth.users(id),
  run_by_email       text,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ANONYMOUS DATASET (§32)
--
-- Anonymity design:
--   1. dataset_tokens has NO user_id column. It cannot exist here. A hashed
--      one-time token is the only artefact linking a completed attempt to the
--      right to submit once.
--   2. dataset_responses stores answers + a DATE only. Not a timestamp — a
--      precise timestamp could be correlated against attempt completion times
--      to re-identify a respondent.
--   3. Export is shuffled, so even row order carries no signal.
-- ---------------------------------------------------------------------------
create table public.dataset_tokens (
  token_hash text primary key,
  created_on date not null default current_date,
  used       boolean not null default false
);

create table public.dataset_responses (
  id           bigint generated always as identity primary key,
  answers      jsonb not null,
  submitted_on date  not null default current_date
);

-- ---------------------------------------------------------------------------
-- app_events  (§48 lightweight logging; never OTP codes, never secrets)
-- ---------------------------------------------------------------------------
create table public.app_events (
  id         bigint generated always as identity primary key,
  event      text not null,
  ref_code   text,
  user_id    uuid,
  details    jsonb,
  created_at timestamptz not null default now()
);

create index app_events_created_idx on public.app_events(created_at desc);
create index app_events_ref_idx on public.app_events(ref_code) where ref_code is not null;
