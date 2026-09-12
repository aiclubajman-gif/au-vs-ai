-- ============================================================================
-- AU vs AI — 0001 Core Schema
-- Ajman University Club Fair, 22-23 September 2026
--
-- Design rules enforced here:
--   * ONE official attempt per authenticated user (DB-level partial unique index)
--   * Round assignments frozen at attempt creation (see 0003 function)
--   * Browsers can never write gameplay tables (see 0004 RLS)
--   * Round 1 / Round 3 correct answers never leave the server
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type attempt_status as enum (
  'not_started',
  'in_progress',
  'completed',
  'abandoned',
  'invalidated'
);

create type verification_method as enum (
  'email_otp',
  'staff_override'
);

-- Locked spec §10: Round 1 is image-only. A question shows ONE image and the
-- student answers REAL or AI_GENERATED. The label IS the correct answer.
create type image_label as enum (
  'real',
  'ai_generated'
);

create type leaderboard_display_mode as enum (
  'name_only',
  'masked_id_only',
  'name_and_masked_id'
);

-- ---------------------------------------------------------------------------
-- colleges  (§6 — configurable, never shown next to an individual publicly)
-- ---------------------------------------------------------------------------
create table public.colleges (
  id          smallint generated always as identity primary key,
  name        text        not null unique,
  sort_order  smallint    not null default 100,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles  (§4, §5 — real name; email stays private; student id derived)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null,
  -- Local-part of the AU email, e.g. '202310421'. Used ONLY to render a masked
  -- suffix on the leaderboard. Never exposed in full through any public view.
  student_id          text not null,
  college_id          smallint references public.colleges(id),
  verification_method verification_method not null default 'email_otp',
  -- Staff-override players are prize-ineligible unless a board member
  -- physically checked the student's AU ID card at issue time (§38).
  id_verified         boolean     not null default false,
  is_test             boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint profiles_full_name_len check (char_length(trim(full_name)) between 2 and 60),
  constraint profiles_student_id_len check (char_length(student_id) between 1 and 40)
);

create index profiles_college_idx on public.profiles(college_id);

-- ---------------------------------------------------------------------------
-- round1_images  (§10 — curated bank, no difficulty tiers)
-- ---------------------------------------------------------------------------
create table public.round1_images (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text        not null,
  -- THE ANSWER. Never selected by any client-facing view or policy.
  label         image_label not null,
  -- Shown only after the competition closes, or in admin review (§11).
  explanation   text,
  source_note   text,
  active        boolean     not null default true,
  is_test       boolean     not null default false,
  times_shown   integer     not null default 0,
  times_correct integer     not null default 0,
  created_at    timestamptz not null default now()
);

create index round1_images_active_idx on public.round1_images(active) where active;
create index round1_images_label_idx  on public.round1_images(label) where active;

-- ---------------------------------------------------------------------------
-- round2_classes  (§15 — the ~15 drawable classes the model supports)
-- ---------------------------------------------------------------------------
create table public.round2_classes (
  id          smallint generated always as identity primary key,
  -- Must match the model's output label exactly.
  class_key   text        not null unique,
  display_name text       not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- round3_question  (§18 — ONE shared question for the whole event)
--
-- Stored as a versioned table rather than a settings row so that the answer
-- and slider range are auditable, and so an admin edit before the event
-- leaves a trail. Exactly one row may be active at a time.
-- ---------------------------------------------------------------------------
create table public.round3_question (
  id            uuid primary key default gen_random_uuid(),
  prompt        text        not null,
  -- THE ANSWER. Never exposed to any client until entries close (§21).
  correct_answer numeric    not null,
  min_value     numeric     not null,
  max_value     numeric     not null,
  step          numeric     not null default 1,
  unit          text,
  reveal_text   text,
  active        boolean     not null default false,
  created_at    timestamptz not null default now(),

  constraint round3_range_valid check (max_value > min_value),
  constraint round3_answer_in_range check (correct_answer between min_value and max_value),
  constraint round3_step_positive check (step > 0)
);

-- Only one active Round 3 question event-wide.
create unique index round3_single_active_idx
  on public.round3_question ((active)) where active;

-- ---------------------------------------------------------------------------
-- attempts  (§7 — the heart of the fairness model)
-- ---------------------------------------------------------------------------
create table public.attempts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  status              attempt_status not null default 'in_progress',

  -- Frozen assignment (§7). Written atomically at creation; never rewritten.
  assigned_at         timestamptz not null default now(),
  round2_class_id     smallint not null references public.round2_classes(id),
  round3_question_id  uuid     not null references public.round3_question(id),

  -- Resume pointer. 1 | 2 | 3 | 4(=finished, on result screen)
  current_round       smallint not null default 1,

  round1_score        integer,
  round2_score        integer,
  round3_score        integer,
  total_score         integer,
  r1_correct_count    smallint,

  human_win           boolean,
  win_threshold_used  integer,

  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  elapsed_ms          integer,

  valid_for_prize     boolean not null default true,
  invalid_reason      text,
  is_test             boolean not null default false,

  created_at          timestamptz not null default now(),

  constraint attempts_current_round_range check (current_round between 1 and 4),
  constraint attempts_scores_range check (
    (round1_score is null or round1_score between 0 and 500) and
    (round2_score is null or round2_score between 0 and 250) and
    (round3_score is null or round3_score between 0 and 250) and
    (total_score  is null or total_score  between 0 and 1000)
  ),
  constraint attempts_completed_consistency check (
    status <> 'completed' or (
      completed_at is not null and total_score is not null and
      round1_score is not null and round2_score is not null and round3_score is not null
    )
  )
);

-- ===========================================================================
-- THE ONE-ATTEMPT GUARANTEE.
-- Practice mode is removed (§31), so every attempt is official. This index is
-- what makes a second attempt physically impossible — not application code.
-- Invalidated attempts are excluded so an admin reset can issue a fresh one.
-- ===========================================================================
create unique index attempts_one_official_per_user_idx
  on public.attempts(user_id)
  where status <> 'invalidated';

create index attempts_leaderboard_idx
  on public.attempts(total_score desc, r1_correct_count desc, completed_at asc)
  where status = 'completed' and not is_test;

create index attempts_status_idx  on public.attempts(status);
create index attempts_active_idx  on public.attempts(started_at) where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- attempt_round1  (three frozen image slots per attempt)
-- ---------------------------------------------------------------------------
create table public.attempt_round1 (
  attempt_id       uuid     not null references public.attempts(id) on delete cascade,
  slot             smallint not null,
  image_id         uuid     not null references public.round1_images(id),
  selected_answer  image_label,
  correct          boolean,
  points           integer,
  answered_at      timestamptz,
  response_time_ms integer,

  primary key (attempt_id, slot),
  constraint attempt_round1_slot_range check (slot between 1 and 3)
);

-- A student can never receive the same image twice in one attempt.
create unique index attempt_round1_unique_image_idx
  on public.attempt_round1(attempt_id, image_id);

-- ---------------------------------------------------------------------------
-- attempt_round2  (§16, §17)
-- ---------------------------------------------------------------------------
create table public.attempt_round2 (
  attempt_id        uuid primary key references public.attempts(id) on delete cascade,
  target_class_id   smallint not null references public.round2_classes(id),
  recognized        boolean  not null default false,
  target_confidence real     not null default 0,
  top_predictions   jsonb,
  draw_time_ms      integer,
  points            integer,
  -- §17: the 28x28 normalized bitmap the model actually saw (784 bytes),
  -- retained temporarily for prize verification only. Not the raw drawing.
  bitmap28          bytea,
  submitted_at      timestamptz,

  constraint attempt_round2_conf_range check (target_confidence between 0 and 1)
);

-- ---------------------------------------------------------------------------
-- attempt_round3  (§20, §21 — result never shown to the student)
-- ---------------------------------------------------------------------------
create table public.attempt_round3 (
  attempt_id   uuid primary key references public.attempts(id) on delete cascade,
  question_id  uuid    not null references public.round3_question(id),
  -- NULL = not answered yet. Never pre-populated with 0, because 0 is a
  -- legitimate guess and would be indistinguishable from "no answer".
  -- answered_at remains the authoritative submission state.
  guess        numeric,
  abs_error    numeric,
  points       integer,
  answered_at  timestamptz,

  -- A guess and a submission timestamp must appear together.
  constraint attempt_round3_answer_consistency check (
    (guess is null and answered_at is null) or
    (guess is not null and answered_at is not null)
  )
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
