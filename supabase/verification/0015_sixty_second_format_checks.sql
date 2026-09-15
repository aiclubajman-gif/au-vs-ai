-- ============================================================================
-- AU vs AI — rehearsal and verification for migration 0015 (60-second format)
--
-- NOT A MIGRATION. Never copy this into supabase/migrations.
--
-- WHEN  BEFORE applying 0015 for real, with the challenge CLOSED. (It also
--       runs after 0015 is applied, and then checks a re-run changes nothing.)
--
-- HOW   Paste the WHOLE file into the Supabase SQL Editor and run it as one
--       query, or: psql -v ON_ERROR_STOP=1 -f <this file>
--       Do not run parts of it on their own.
--
-- WHAT  Inside one transaction it:
--         1. records the live event_settings row,
--         2. runs a verbatim copy of 0015 against the real schema and data,
--         3. checks the result, then exercises the constraints, format lock,
--            functions and permissions with temporary users, images and
--            attempts (undone again at the end of their own block),
--       and finally ROLLBACK. Nothing is kept — not even the migration.
--
-- RESULT
--   PASS  A single row:  0015 VERIFIED: all checks passed
--         `details` shows the settings before and after, and how many
--         non-test attempts would lock the Round 1 format until reset.
--         The script then rolls itself back.
--   FAIL  An error, and no VERIFIED row. "0015 CHECK FAILED: ..." names the
--         check; any other error means a step could not run. Nothing is kept
--         either way. If your client keeps the session open after an error,
--         run  rollback;  before anything else.
--
-- It holds locks on event_settings, attempts, attempt_round1 and the image
-- bank for the second or so it runs. The editor may warn about destructive
-- statements: they are 0015's own DROP ... IF EXISTS and this script's
-- temporary DELETE / UPDATEs, all rolled back.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. The live settings row, as it is before 0015
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config(
    'verify_0015.settings_before',
    coalesce((select to_jsonb(s)::text from public.event_settings s where s.id = 1), ''),
    true
  );
  perform set_config(
    'verify_0015.applied_before',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'event_settings'
        and column_name = 'round1_image_count'
    )::text,
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Migration 0015, verbatim. tests/sixty-second-format.test.ts fails if this
--    copy differs from supabase/migrations/0015_sixty_second_format.sql.
-- ---------------------------------------------------------------------------
-- >>>>>>>> BEGIN VERBATIM COPY OF supabase/migrations/0015_sixty_second_format.sql
-- ============================================================================
-- AU vs AI — 0015 The 60-second format: Round 1 presets, per-attempt timing
--
-- The challenge is exactly 60 seconds of play. That is now a database
-- invariant, not three numbers an admin has to keep adding up:
--
--   Round 1   8 images x 5s   or   10 images x 4s   = 40s
--   Round 2   12s drawing
--   Round 3   8s
--
-- 1. event_settings gains round1_image_count. CHECK constraints allow only the
--    two Round 1 presets, fix Rounds 2 and 3, and require a 60-second total.
-- 2. start_attempt() assigns exactly round1_image_count images and snapshots
--    the timing onto the attempt. A resumed game keeps the timing it started
--    with, whatever /admin says afterwards.
-- 3. Round 1 is scored once, at completion: round(500 x correct / assigned).
--    Slot position can never change a score.
-- 4. The Round 1 preset locks as soon as any non-test attempt exists that has
--    not been reset ('invalidated'), so 8- and 10-image games never share a
--    leaderboard.
--
-- Attempts created before this migration have no timing snapshot. They are
-- NOT converted to the new format: the game refuses to play them, and they
-- count towards the format lock until reset. Reset every non-test attempt
-- created before 0015 before the challenge reopens.
--
-- Paste and run as ONE query. Postgres runs it as a single transaction, so a
-- failure part-way leaves the database exactly as it was.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. event_settings — the only two games that can exist
--
-- Order matters. Each step only relies on what the step before made true:
--   a. add the column with NO default and NO constraint
--   b. rewrite every row that is not already a valid 60-second game
--   c. only then DEFAULT 8 and NOT NULL
--   d. only then the CHECK constraints
-- ---------------------------------------------------------------------------

-- a.
alter table public.event_settings
  add column if not exists round1_image_count smallint;

-- b. Selected by "not already a valid format", never by the new column being
-- NULL, so the live 8000 / 20000 / 8000 row is rewritten whatever
-- round1_image_count holds. `is not true` also catches rows where the test is
-- NULL. A row that already satisfies (d) — a re-run, possibly on 10 x 4 — is
-- left alone, so this can never undo a preset or trip the format lock (§9).
update public.event_settings
set round1_image_count  = 8,
    round1_ms_per_image = 5000,
    round2_draw_ms      = 12000,
    round3_ms           = 8000
where (
  ((round1_image_count = 8  and round1_ms_per_image = 5000) or
   (round1_image_count = 10 and round1_ms_per_image = 4000))
  and round2_draw_ms = 12000
  and round3_ms = 8000
) is not true;

-- c. Defaults change too, so a recreated settings row satisfies the checks.
alter table public.event_settings
  alter column round1_image_count  set default 8,
  alter column round1_image_count  set not null,
  alter column round1_ms_per_image set default 5000,
  alter column round2_draw_ms      set default 12000,
  alter column round3_ms           set default 8000;

-- d.
alter table public.event_settings
  drop constraint if exists event_settings_round1_preset,
  drop constraint if exists event_settings_round2_fixed,
  drop constraint if exists event_settings_round3_fixed,
  drop constraint if exists event_settings_sixty_seconds;

alter table public.event_settings
  add constraint event_settings_round1_preset check (
    (round1_image_count = 8  and round1_ms_per_image = 5000) or
    (round1_image_count = 10 and round1_ms_per_image = 4000)
  ),
  add constraint event_settings_round2_fixed check (round2_draw_ms = 12000),
  add constraint event_settings_round3_fixed check (round3_ms = 8000),
  add constraint event_settings_sixty_seconds check (
    round1_image_count * round1_ms_per_image + round2_draw_ms + round3_ms = 60000
  );

-- ---------------------------------------------------------------------------
-- 2. attempt_round1 — up to ten slots; per-slot points retired
-- ---------------------------------------------------------------------------
alter table public.attempt_round1
  drop constraint if exists attempt_round1_slot_range;

alter table public.attempt_round1
  add constraint attempt_round1_slot_range check (slot between 1 and 10);

-- The column is nullable and nothing else reads it, so it simply stops being
-- written. Existing values are left alone as an audit trail.
comment on column public.attempt_round1.points is
  'Not written since 0015. Round 1 is scored once in complete_attempt() as '
  'round(500 x correct / assigned), because 500 does not divide evenly by 8. '
  'Rows answered before 0015 keep their original values for audit only.';

-- ---------------------------------------------------------------------------
-- 3. attempts — the timing each game was created with
--
-- The image count is not copied: the attempt's attempt_round1 rows already
-- freeze it, and a second copy could only disagree.
-- ---------------------------------------------------------------------------
alter table public.attempts
  add column if not exists round1_ms_per_image integer,
  add column if not exists round2_draw_ms      integer,
  add column if not exists round3_ms           integer;

alter table public.attempts
  drop constraint if exists attempts_timing_snapshot;

alter table public.attempts
  add constraint attempts_timing_snapshot check (
    (round1_ms_per_image is null and round2_draw_ms is null and round3_ms is null) or
    (round1_ms_per_image is not null and round2_draw_ms is not null and round3_ms is not null
      and round1_ms_per_image > 0 and round2_draw_ms > 0 and round3_ms > 0)
  );

comment on column public.attempts.round1_ms_per_image is
  'Frozen by start_attempt() from event_settings. NULL only for attempts created '
  'before 0015, which the game refuses to play.';

-- ---------------------------------------------------------------------------
-- 4. round1_real_bounds — how many REAL images a game may contain
--
-- Between 25% and 75% of the images (1-3 of 4, 2-6 of 8, 3-7 of 10), so no
-- game is all one label, narrowed to what the bank can actually supply.
-- real_min > real_max means the bank cannot fill a game. Shared by
-- start_attempt() and round1_bank_health() so readiness and play agree.
-- ---------------------------------------------------------------------------
create or replace function public.round1_real_bounds(
  p_image_count integer,
  p_real_avail  integer,
  p_ai_avail    integer,
  out real_min  integer,
  out real_max  integer
)
language sql
immutable
set search_path = public
as $$
  select greatest(ceil(p_image_count / 4.0)::integer, p_image_count - p_ai_avail),
         least(p_image_count - ceil(p_image_count / 4.0)::integer, p_real_avail);
$$;

-- ---------------------------------------------------------------------------
-- 5. start_attempt — the configured image count, and a timing snapshot
-- ---------------------------------------------------------------------------
create or replace function public.start_attempt(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings     public.event_settings%rowtype;
  v_attempt      public.attempts%rowtype;
  v_class_id     smallint;
  v_question_id  uuid;
  v_image_ids    uuid[];
  v_profile      public.profiles%rowtype;
  v_image_count  integer;
  v_real_avail   integer;
  v_ai_avail     integer;
  v_real_min     integer;
  v_real_max     integer;
  v_want_real    integer;
  v_want_ai      integer;
  v_prize_ok     boolean;
  v_invalid_note text;
begin
  -- ---- Resume: the assignment AND timing the game started with ------------
  select * into v_attempt
  from public.attempts
  where user_id = p_user_id and status <> 'invalidated'
  limit 1;

  if found then
    if v_attempt.status = 'completed' then
      return jsonb_build_object(
        'attempt_id', v_attempt.id,
        'resumed', true,
        'status', 'completed',
        'total_score', v_attempt.total_score
      );
    end if;

    if v_attempt.status = 'abandoned' then
      update public.attempts set status = 'in_progress' where id = v_attempt.id;
    end if;

    return public.get_attempt_assignment(v_attempt.id) || jsonb_build_object('resumed', true);
  end if;

  -- ---- Settings ------------------------------------------------------------
  -- FOR SHARE: a preset change in flight makes this wait and then use the new
  -- preset; a preset change arriving now waits for this attempt to commit,
  -- then sees it and is refused by the format lock. Never a mix.
  select * into v_settings from public.event_settings where id = 1 for share;

  if not found then
    raise exception 'SETTINGS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_image_count := v_settings.round1_image_count;

  -- The CHECK constraints already guarantee this. Asserted again because this
  -- is the moment a game's length is decided.
  if v_image_count is null
     or v_settings.round1_ms_per_image is null
     or v_settings.round2_draw_ms is null
     or v_settings.round3_ms is null
     or v_image_count not between 1 and 10
     or v_image_count * v_settings.round1_ms_per_image
        + v_settings.round2_draw_ms + v_settings.round3_ms <> 60000 then
    raise exception 'SETTINGS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not v_settings.challenge_open then
    raise exception 'CHALLENGE_CLOSED' using errcode = 'P0001';
  end if;

  if v_settings.new_games_paused then
    raise exception 'NEW_GAMES_PAUSED' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  if v_profile.verification_method = 'staff_override' and not v_profile.id_verified then
    v_prize_ok := false;
    v_invalid_note := 'staff override without ID check';
  else
    v_prize_ok := true;
    v_invalid_note := null;
  end if;

  select id into v_class_id
  from public.round2_classes where active order by random() limit 1;
  if v_class_id is null then
    raise exception 'NO_DRAWING_CLASSES' using errcode = 'P0001';
  end if;

  select id into v_question_id
  from public.round3_question
  where active and day_slot = v_settings.current_day
  limit 1;

  if v_question_id is null then
    raise exception 'NO_ROUND3_QUESTION' using errcode = 'P0001';
  end if;

  -- ---- Round 1: exactly v_image_count images, 25-75% real -----------------
  select count(*) filter (where label = 'real'),
         count(*) filter (where label = 'ai_generated')
    into v_real_avail, v_ai_avail
  from public.round1_images where active;

  if v_real_avail + v_ai_avail < v_image_count then
    raise exception 'ROUND1_BANK_TOO_SMALL' using errcode = 'P0001';
  end if;

  select b.real_min, b.real_max into v_real_min, v_real_max
  from public.round1_real_bounds(v_image_count, v_real_avail, v_ai_avail) as b;

  if v_real_min > v_real_max then
    raise exception 'ROUND1_BANK_UNBALANCED' using errcode = 'P0001';
  end if;

  -- Every allowed split is equally likely, so the mix carries no information.
  v_want_real := v_real_min + floor(random() * (v_real_max - v_real_min + 1))::integer;
  v_want_ai   := v_image_count - v_want_real;

  with picked_real as (
    select id from public.round1_images
    where active and label = 'real'
    order by random() limit v_want_real
  ),
  picked_ai as (
    select id from public.round1_images
    where active and label = 'ai_generated'
    order by random() limit v_want_ai
  ),
  combined as (
    select id from picked_real union all select id from picked_ai
  )
  -- Shuffled, so slot position reveals nothing about the label.
  select array_agg(id order by random()) into v_image_ids from combined;

  if coalesce(array_length(v_image_ids, 1), 0) <> v_image_count then
    raise exception 'ROUND1_BANK_UNBALANCED' using errcode = 'P0001';
  end if;

  begin
    insert into public.attempts (
      user_id, status, round2_class_id, round3_question_id, current_round,
      is_test, valid_for_prize, invalid_reason,
      round1_ms_per_image, round2_draw_ms, round3_ms
    ) values (
      p_user_id, 'in_progress', v_class_id, v_question_id, 1,
      coalesce(v_profile.is_test, false), v_prize_ok, v_invalid_note,
      v_settings.round1_ms_per_image, v_settings.round2_draw_ms, v_settings.round3_ms
    )
    returning * into v_attempt;
  exception
    when unique_violation then
      select * into v_attempt
      from public.attempts
      where user_id = p_user_id and status <> 'invalidated' limit 1;
      return public.get_attempt_assignment(v_attempt.id) || jsonb_build_object('resumed', true);
  end;

  insert into public.attempt_round1 (attempt_id, slot, image_id)
  select v_attempt.id, ordinality::smallint, image_id
  from unnest(v_image_ids) with ordinality as t(image_id, ordinality);

  insert into public.attempt_round2 (attempt_id, target_class_id)
  values (v_attempt.id, v_class_id);

  insert into public.attempt_round3 (attempt_id, question_id)
  values (v_attempt.id, v_question_id);

  insert into public.app_events (event, user_id, details)
  values ('attempt_started', p_user_id, jsonb_build_object(
    'attempt_id', v_attempt.id,
    'day', v_settings.current_day,
    'round1_images', v_image_count,
    'round1_ms_per_image', v_settings.round1_ms_per_image,
    'ratio', v_want_real || ':' || v_want_ai,
    'prize_eligible', v_prize_ok
  ));

  return public.get_attempt_assignment(v_attempt.id) || jsonb_build_object('resumed', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_attempt_assignment — now carries the frozen timing
--
-- `timing` is NULL for an attempt created before 0015. The client treats that
-- as unplayable rather than guessing.
-- ---------------------------------------------------------------------------
create or replace function public.get_attempt_assignment(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_result  jsonb;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_attempt.status,
    'current_round', v_attempt.current_round,
    'started_at', v_attempt.started_at,

    'timing', case
      when v_attempt.round1_ms_per_image is null then null
      else jsonb_build_object(
        'round1_ms_per_image', v_attempt.round1_ms_per_image,
        'round2_draw_ms', v_attempt.round2_draw_ms,
        'round3_ms', v_attempt.round3_ms
      )
    end,

    'round1', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'slot', ar.slot,
          'image_id', ar.image_id,
          'storage_path', ri.storage_path,
          'answered', ar.selected_answer is not null
        ) order by ar.slot
      ), '[]'::jsonb)
      from public.attempt_round1 ar
      join public.round1_images ri on ri.id = ar.image_id
      where ar.attempt_id = v_attempt.id
    ),

    'round2', (
      select jsonb_build_object(
        'class_key', rc.class_key,
        'display_name', rc.display_name,
        'submitted', ar2.submitted_at is not null
      )
      from public.attempt_round2 ar2
      join public.round2_classes rc on rc.id = ar2.target_class_id
      where ar2.attempt_id = v_attempt.id
    ),

    'round3', (
      select jsonb_build_object(
        'prompt', q.prompt,
        'min_value', q.min_value,
        'max_value', q.max_value,
        'step', q.step,
        'unit', q.unit,
        'answered', ar3.answered_at is not null
      )
      from public.attempt_round3 ar3
      join public.round3_question q on q.id = ar3.question_id
      where ar3.attempt_id = v_attempt.id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. complete_attempt — Round 1 from correct / assigned
--
-- Unchanged from 0008 except the Round 1 line. For a four-image attempt the
-- formula gives exactly 125 per correct answer, the same as the old per-slot
-- sum, so legacy games score as they always did. Completed attempts still
-- return their stored result and are never rescored.
-- ---------------------------------------------------------------------------
create or replace function public.complete_attempt(p_attempt_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt     public.attempts%rowtype;
  v_r1          integer;
  v_r1_correct  smallint;
  v_r1_assigned integer;
  v_r2          integer;
  v_r3          integer;
  v_total       integer;
  v_threshold   integer;
  v_elapsed     integer;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_attempt.status = 'completed' then
    return public.get_attempt_result_public(p_attempt_id, p_user_id);
  end if;

  -- An unanswered or timed-out slot is assigned but not correct.
  select count(*), count(*) filter (where correct)
    into v_r1_assigned, v_r1_correct
  from public.attempt_round1 where attempt_id = p_attempt_id;

  v_r1 := case
    when v_r1_assigned > 0 then round(500.0 * v_r1_correct / v_r1_assigned)::integer
    else 0
  end;

  select coalesce(points, 0) into v_r2
  from public.attempt_round2 where attempt_id = p_attempt_id;

  select coalesce(points, 0) into v_r3
  from public.attempt_round3 where attempt_id = p_attempt_id;

  -- Defensive clamps. These mirror the TypeScript scoring ceilings so a bug in
  -- one layer cannot produce an impossible leaderboard entry.
  v_r1 := least(greatest(coalesce(v_r1, 0), 0), 500);
  v_r2 := least(greatest(coalesce(v_r2, 0), 0), 250);
  v_r3 := least(greatest(coalesce(v_r3, 0), 0), 250);
  v_total := v_r1 + v_r2 + v_r3;

  select human_win_threshold into v_threshold from public.event_settings where id = 1;

  v_elapsed := greatest(0, extract(epoch from (now() - v_attempt.started_at)) * 1000)::integer;

  update public.attempts
  set status             = 'completed',
      round1_score       = v_r1,
      round2_score       = v_r2,
      round3_score       = v_r3,
      total_score        = v_total,
      r1_correct_count   = v_r1_correct,
      human_win          = (v_total >= v_threshold),
      win_threshold_used = v_threshold,
      completed_at       = now(),
      elapsed_ms         = v_elapsed,
      current_round      = 4
  where id = p_attempt_id;

  insert into public.app_events (event, user_id, details)
  values ('attempt_completed', p_user_id,
          jsonb_build_object('attempt_id', p_attempt_id, 'total', v_total));

  return public.get_attempt_result_public(p_attempt_id, p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. round1_bank_health — judged against the CURRENT preset
--
-- `playable` uses exactly the rule start_attempt() applies, so a ten-image
-- event cannot look healthy with four usable images. `playable_by_image_count`
-- lets /admin show whether the other preset would work before switching.
-- ---------------------------------------------------------------------------
create or replace function public.round1_bank_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bank as (
    select
      count(*)::integer                                                  as total_count,
      count(*) filter (where active)::integer                            as active_count,
      count(*) filter (where active and label = 'real')::integer         as real_count,
      count(*) filter (where active and label = 'ai_generated')::integer as ai_count,
      count(*) filter (where active and is_test)::integer                as placeholder_count,
      count(*) filter (where active and (explanation is null or explanation = ''))::integer
                                                                         as unexplained_count
    from public.round1_images
  ),
  fill as (
    select n, (b.real_min <= b.real_max) as can_fill
    from bank,
         (values (8), (10)) as presets(n),
         lateral public.round1_real_bounds(n, bank.real_count, bank.ai_count) as b
  )
  select jsonb_build_object(
    'total',               bank.total_count,
    'active',              bank.active_count,
    'real',                bank.real_count,
    'ai',                  bank.ai_count,
    'placeholders',        bank.placeholder_count,
    'missing_explanation', bank.unexplained_count,
    'images_per_game',     s.round1_image_count,
    'playable',            coalesce((select can_fill from fill where n = s.round1_image_count), false),
    'playable_by_image_count', (select jsonb_object_agg(n::text, can_fill) from fill)
  )
  from bank
  left join public.event_settings s on s.id = 1;
$$;

-- ---------------------------------------------------------------------------
-- 9. The Round 1 format lock
--
-- Locked while any attempt is BOTH:
--   * not a test attempt (is_test, copied from the profile at creation), and
--   * not reset: status <> 'invalidated', the status /admin's Reset and
--     Invalidate write. Invalidated attempts are already excluded from the
--     leaderboard, rank and event stats, so they cannot mix formats there.
-- In progress, abandoned and completed attempts all lock it.
-- Enforced here rather than in the admin route so no UPDATE from any path —
-- /admin, a script, the SQL editor — can put 8- and 10-image games on one
-- leaderboard.
-- ---------------------------------------------------------------------------
create or replace function public.guard_round1_format_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.round1_image_count, new.round1_ms_per_image)
       is distinct from (old.round1_image_count, old.round1_ms_per_image)
     and exists (
       select 1 from public.attempts
       where not is_test and status <> 'invalidated'
     ) then
    raise exception 'ROUND1_FORMAT_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists event_settings_round1_format_lock on public.event_settings;
create trigger event_settings_round1_format_lock
  before update of round1_image_count, round1_ms_per_image on public.event_settings
  for each row execute function public.guard_round1_format_change();

-- ---------------------------------------------------------------------------
-- 10. Permissions (same pattern as 0006: server-only)
-- ---------------------------------------------------------------------------
revoke all on function public.round1_real_bounds(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.round1_real_bounds(integer, integer, integer)
  to service_role;

revoke all on function public.start_attempt(uuid)            from public, anon, authenticated;
revoke all on function public.get_attempt_assignment(uuid)   from public, anon, authenticated;
revoke all on function public.complete_attempt(uuid, uuid)   from public, anon, authenticated;
revoke all on function public.round1_bank_health()           from public, anon, authenticated;
revoke all on function public.guard_round1_format_change()   from public, anon, authenticated;

grant execute on function public.start_attempt(uuid)          to service_role;
grant execute on function public.get_attempt_assignment(uuid) to service_role;
grant execute on function public.complete_attempt(uuid, uuid) to service_role;
grant execute on function public.round1_bank_health()         to service_role;

notify pgrst, 'reload schema';
-- <<<<<<<< END VERBATIM COPY OF supabase/migrations/0015_sixty_second_format.sql

-- ---------------------------------------------------------------------------
-- 3. Checks
-- ---------------------------------------------------------------------------
do $$
declare
  v_before       jsonb   := nullif(current_setting('verify_0015.settings_before'), '')::jsonb;
  v_applied      boolean := current_setting('verify_0015.applied_before')::boolean;
  v_settings     public.event_settings%rowtype;
  v_not_null     boolean;
  v_default      text;
  v_locking      integer;
  v_summary      text;
  v_case         text;
  v_parts        integer[];
  v_constraint   text;
  v_err          text;
  v_n            integer;
  v_ms           integer;
  v_other_n      integer;
  v_other_ms     integer;
  v_count        integer;
  v_real         integer;
  v_score        integer;
  v_correct      integer;
  v_result       jsonb;
  v_health       jsonb;
  v_att          public.attempts%rowtype;
  v_attempt_a    uuid;
  v_attempt_b    uuid;
  v_attempt_old  uuid;
  v_attempt_real uuid;
  v_class_id     smallint;
  v_question_id  uuid;
  v_real_ids     uuid[];
  v_ai_ids       uuid[];
  v_fn           text;
  v_role         text;
  u_a            uuid := gen_random_uuid();
  u_b            uuid := gen_random_uuid();
  u_old          uuid := gen_random_uuid();
  u_nosettings   uuid := gen_random_uuid();
  u_smallbank    uuid := gen_random_uuid();
  u_real         uuid := gen_random_uuid();
  u              uuid;
begin
  -- ==========================================================================
  -- 0. The live settings row came through 0015 correctly (read-only)
  -- ==========================================================================
  if v_before is null then
    raise exception '0015 CHECK FAILED: there is no event_settings row';
  end if;

  select * into v_settings from public.event_settings where id = 1;

  if not v_applied then
    -- Before 0015 there is no image count. Whatever the old timings were
    -- (live: 8000 / 20000 / 8000), the row must now be the initial format.
    if (v_settings.round1_image_count, v_settings.round1_ms_per_image,
        v_settings.round2_draw_ms, v_settings.round3_ms)
       is distinct from (8, 5000, 12000, 8000) then
      raise exception '0015 CHECK FAILED: settings % / % / % ms became % x % / % / % ms',
        v_before->>'round1_ms_per_image', v_before->>'round2_draw_ms', v_before->>'round3_ms',
        v_settings.round1_image_count, v_settings.round1_ms_per_image,
        v_settings.round2_draw_ms, v_settings.round3_ms;
    end if;
  elsif (v_settings.round1_image_count, v_settings.round1_ms_per_image,
         v_settings.round2_draw_ms, v_settings.round3_ms)
        is distinct from ((v_before->>'round1_image_count')::integer,
                          (v_before->>'round1_ms_per_image')::integer,
                          (v_before->>'round2_draw_ms')::integer,
                          (v_before->>'round3_ms')::integer) then
    raise exception '0015 CHECK FAILED: re-running 0015 changed the settings from % to %',
      v_before, to_jsonb(v_settings);
  end if;

  -- The constraints exist and were validated against that row.
  select count(*) into v_count
  from pg_constraint
  where conrelid = 'public.event_settings'::regclass
    and contype = 'c'
    and convalidated
    and conname in ('event_settings_round1_preset', 'event_settings_round2_fixed',
                    'event_settings_round3_fixed', 'event_settings_sixty_seconds');
  if v_count <> 4 then
    raise exception '0015 CHECK FAILED: % of 4 validated settings constraints exist', v_count;
  end if;

  select a.attnotnull, pg_get_expr(d.adbin, d.adrelid) into v_not_null, v_default
  from pg_attribute a
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'public.event_settings'::regclass and a.attname = 'round1_image_count';
  if not coalesce(v_not_null, false) or coalesce(v_default, '') !~ '^''?8''?(::smallint)?$' then
    raise exception '0015 CHECK FAILED: round1_image_count is not NOT NULL DEFAULT 8 (not null %, default %)',
      v_not_null, v_default;
  end if;

  select count(*) into v_locking
  from public.attempts where not is_test and status <> 'invalidated';

  v_summary := format(
    'settings %s -> %s x %s / %s / %s ms; %s non-test attempt(s) not reset (each locks the Round 1 format until reset)',
    case when v_applied then 'already on 0015'
         else format('%s / %s / %s ms', v_before->>'round1_ms_per_image',
                     v_before->>'round2_draw_ms', v_before->>'round3_ms') end,
    v_settings.round1_image_count, v_settings.round1_ms_per_image,
    v_settings.round2_draw_ms, v_settings.round3_ms, v_locking
  );
  raise notice 'ok   %', v_summary;

  -- ==========================================================================
  -- Everything from here to VR015 at the end of this block is temporary.
  -- Raising VR015 rolls the block back, so users, images, attempts and
  -- settings changes are gone before the final ROLLBACK even runs. A failed
  -- check raises anything but VR015 and fails the whole script.
  -- ==========================================================================
  begin
    -- ========================================================================
    -- 1. Only 60-second settings can exist
    --
    -- Inserting row id 1 again: CHECK constraints are evaluated before the
    -- primary key, so a bad row fails with check_violation and a good row gets
    -- as far as unique_violation. The format lock (an UPDATE trigger) is not
    -- involved.
    -- ========================================================================
    foreach v_case in array array[
      '8,4000,12000,8000',     -- wrong per-image time for 8
      '10,5000,12000,8000',    -- wrong per-image time for 10
      '8,8000,20000,8000',     -- today's timings
      '4,8000,20000,8000',     -- the old format (also 60s, but not allowed)
      '6,5000,12000,18000',    -- 60s, but not a preset
      '8,5000,13000,8000',     -- Round 2 changed
      '8,5000,12000,9000',     -- Round 3 changed
      '10,4000,12000,7000'     -- 59 seconds
    ] loop
      v_parts := string_to_array(v_case, ',')::integer[];
      begin
        insert into public.event_settings (id, round1_image_count, round1_ms_per_image, round2_draw_ms, round3_ms)
        values (1, v_parts[1], v_parts[2], v_parts[3], v_parts[4]);
        raise exception '0015 CHECK FAILED: settings % were inserted', v_case;
      exception
        when check_violation then
          get stacked diagnostics v_constraint = constraint_name;
          raise notice 'ok   settings (%) rejected by %', v_case, v_constraint;
        when unique_violation then
          raise exception '0015 CHECK FAILED: settings (%) passed every CHECK constraint', v_case;
      end;
    end loop;

    foreach v_case in array array['8,5000,12000,8000', '10,4000,12000,8000'] loop
      v_parts := string_to_array(v_case, ',')::integer[];
      begin
        insert into public.event_settings (id, round1_image_count, round1_ms_per_image, round2_draw_ms, round3_ms)
        values (1, v_parts[1], v_parts[2], v_parts[3], v_parts[4]);
        raise exception '0015 CHECK FAILED: a second settings row was inserted';
      exception
        when unique_violation then
          raise notice 'ok   settings (%) satisfy every CHECK constraint', v_case;
        when check_violation then
          get stacked diagnostics v_constraint = constraint_name;
          raise exception '0015 CHECK FAILED: valid settings (%) rejected by %', v_case, v_constraint;
      end;
    end loop;

    -- ========================================================================
    -- 2. Setup for play
    -- ========================================================================
    -- Real non-test attempts would lock the format and hide the preset checks.
    -- Marked reset for the rest of this block only — which is itself a check
    -- that reset attempts do not lock (section 4).
    update public.attempts set status = 'invalidated'
    where not is_test and status <> 'invalidated';

    v_n := v_settings.round1_image_count;
    v_ms := v_settings.round1_ms_per_image;
    if v_n = 8 then v_other_n := 10; v_other_ms := 4000; else v_other_n := 8; v_other_ms := 5000; end if;
    raise notice 'info current preset % x % ms', v_n, v_ms;

    update public.event_settings set challenge_open = true, new_games_paused = false where id = 1;

    select id into v_class_id from public.round2_classes where active limit 1;
    if v_class_id is null then
      insert into public.round2_classes (class_key, display_name)
      values ('verify_0015', 'VERIFY 0015') returning id into v_class_id;
    end if;

    select q.id into v_question_id
    from public.round3_question q, public.event_settings s
    where s.id = 1 and q.active and q.day_slot = s.current_day
    limit 1;
    if v_question_id is null then
      insert into public.round3_question (prompt, correct_answer, min_value, max_value, step, active, day_slot)
      select 'verify 0015', 1, 0, 10, 1, true, current_day from public.event_settings where id = 1
      returning id into v_question_id;
    end if;

    -- Enough images for either preset, whatever the real bank holds.
    with ins as (
      insert into public.round1_images (storage_path, label, active, is_test)
      select 'verify-0015/real-' || g, 'real', true, true from generate_series(1, 6) g
      returning id
    ) select array_agg(id) into v_real_ids from ins;
    with ins as (
      insert into public.round1_images (storage_path, label, active, is_test)
      select 'verify-0015/ai-' || g, 'ai_generated', true, true from generate_series(1, 6) g
      returning id
    ) select array_agg(id) into v_ai_ids from ins;

    foreach u in array array[u_a, u_b, u_old, u_nosettings, u_smallbank, u_real] loop
      insert into auth.users (id, email) values (u, 'verify-0015-' || u || '@ajmanuni.ac.ae');
    end loop;
    -- u_nosettings gets a profile later, to show a retry succeeds. u_real is the
    -- only non-test profile, used in section 8 for the format lock.
    insert into public.profiles (id, full_name, student_id, is_test) values
      (u_a, 'Verify A', 'verify0015a', true),
      (u_b, 'Verify B', 'verify0015b', true),
      (u_smallbank, 'Verify Bank', 'verify0015s', true),
      (u_real, 'Verify Real', 'verify0015r', false);

    -- ========================================================================
    -- 3. start_attempt under the current preset
    -- ========================================================================
    v_result := public.start_attempt(u_a);
    v_attempt_a := (v_result->>'attempt_id')::uuid;

    if (v_result->>'resumed')::boolean then
      raise exception '0015 CHECK FAILED: a fresh attempt was reported as resumed';
    end if;

    select count(*), count(*) filter (where ri.label = 'real') into v_count, v_real
    from public.attempt_round1 ar join public.round1_images ri on ri.id = ar.image_id
    where ar.attempt_id = v_attempt_a;

    if v_count <> v_n or jsonb_array_length(v_result->'round1') <> v_n then
      raise exception '0015 CHECK FAILED: preset % assigned % images', v_n, v_count;
    end if;
    if v_real not between ceil(v_n / 4.0) and v_n - ceil(v_n / 4.0) then
      raise exception '0015 CHECK FAILED: % real of % is outside the 25-75%% band', v_real, v_n;
    end if;

    select * into v_att from public.attempts where id = v_attempt_a;
    if (v_att.round1_ms_per_image, v_att.round2_draw_ms, v_att.round3_ms) is distinct from (v_ms, 12000, 8000) then
      raise exception '0015 CHECK FAILED: attempt snapshot is %/%/%',
        v_att.round1_ms_per_image, v_att.round2_draw_ms, v_att.round3_ms;
    end if;
    if v_n * v_att.round1_ms_per_image + v_att.round2_draw_ms + v_att.round3_ms <> 60000 then
      raise exception '0015 CHECK FAILED: the attempt is not a 60-second game';
    end if;
    if v_result->'timing' is distinct from
       jsonb_build_object('round1_ms_per_image', v_ms, 'round2_draw_ms', 12000, 'round3_ms', 8000) then
      raise exception '0015 CHECK FAILED: assignment timing is %', v_result->'timing';
    end if;
    if not v_att.is_test then
      raise exception '0015 CHECK FAILED: a test profile produced a non-test attempt';
    end if;
    raise notice 'ok   % x % ms: % images (% real), timing % / 12000 / 8000 snapshotted and returned',
      v_n, v_ms, v_count, v_real, v_ms;

    -- ========================================================================
    -- 4. Switching presets: allowed with only test and reset attempts, and
    --    never affects an attempt that already exists
    -- ========================================================================
    update public.event_settings
    set round1_image_count = v_other_n, round1_ms_per_image = v_other_ms
    where id = 1;
    raise notice 'ok   switched to % x % ms with only test and reset attempts present', v_other_n, v_other_ms;

    v_result := public.start_attempt(u_a);
    if not (v_result->>'resumed')::boolean
       or jsonb_array_length(v_result->'round1') <> v_n
       or v_result->'timing' is distinct from
          jsonb_build_object('round1_ms_per_image', v_ms, 'round2_draw_ms', 12000, 'round3_ms', 8000) then
      raise exception '0015 CHECK FAILED: the preset switch changed an existing attempt: %', v_result;
    end if;
    raise notice 'ok   existing attempt still resumes with % images at % ms, Round 2 at 12000 ms', v_n, v_ms;

    v_result := public.start_attempt(u_b);
    v_attempt_b := (v_result->>'attempt_id')::uuid;
    select count(*), count(*) filter (where ri.label = 'real') into v_count, v_real
    from public.attempt_round1 ar join public.round1_images ri on ri.id = ar.image_id
    where ar.attempt_id = v_attempt_b;
    select * into v_att from public.attempts where id = v_attempt_b;
    if v_count <> v_other_n
       or v_real not between ceil(v_other_n / 4.0) and v_other_n - ceil(v_other_n / 4.0)
       or v_att.round1_ms_per_image <> v_other_ms
       or v_other_n * v_att.round1_ms_per_image + v_att.round2_draw_ms + v_att.round3_ms <> 60000 then
      raise exception '0015 CHECK FAILED: % x % ms game had % images (% real) at % ms',
        v_other_n, v_other_ms, v_count, v_real, v_att.round1_ms_per_image;
    end if;
    raise notice 'ok   % x % ms: % images (% real), timing snapshotted', v_other_n, v_other_ms, v_count, v_real;

    update public.event_settings set round1_image_count = v_n, round1_ms_per_image = v_ms where id = 1;

    -- ========================================================================
    -- 5. Round 1 scoring: round(500 x correct / assigned), once
    -- ========================================================================
    update public.attempt_round1 ar
    set selected_answer = case when ar.slot <= 3 then ri.label else null end,
        correct         = (ar.slot <= 3),
        answered_at     = now()
    from public.round1_images ri
    where ri.id = ar.image_id and ar.attempt_id = v_attempt_a;

    perform public.complete_attempt(v_attempt_a, u_a);
    select round1_score, r1_correct_count into v_score, v_correct from public.attempts where id = v_attempt_a;
    if v_score <> round(500.0 * 3 / v_n) or v_correct <> 3 then
      raise exception '0015 CHECK FAILED: 3 of % scored % (% correct)', v_n, v_score, v_correct;
    end if;
    raise notice 'ok   3 of % correct scores %', v_n, v_score;

    -- Completing again must not rescore, even if the rows changed.
    update public.attempt_round1 set correct = true where attempt_id = v_attempt_a;
    perform public.complete_attempt(v_attempt_a, u_a);
    if (select round1_score from public.attempts where id = v_attempt_a) <> v_score then
      raise exception '0015 CHECK FAILED: a completed attempt was rescored';
    end if;
    raise notice 'ok   a completed attempt is not rescored';

    update public.attempt_round1 ar
    set selected_answer = ri.label, correct = (ar.slot <= 5), answered_at = now()
    from public.round1_images ri
    where ri.id = ar.image_id and ar.attempt_id = v_attempt_b;
    perform public.complete_attempt(v_attempt_b, u_b);
    select round1_score into v_score from public.attempts where id = v_attempt_b;
    if v_score <> round(500.0 * 5 / v_other_n) then
      raise exception '0015 CHECK FAILED: 5 of % scored %', v_other_n, v_score;
    end if;
    raise notice 'ok   5 of % correct scores %', v_other_n, v_score;

    -- A pre-0015 four-image attempt: no snapshot, and the old score.
    insert into public.attempts (user_id, status, round2_class_id, round3_question_id, current_round, is_test)
    values (u_old, 'in_progress', v_class_id, v_question_id, 1, true)
    returning id into v_attempt_old;
    insert into public.attempt_round1 (attempt_id, slot, image_id, selected_answer, correct, answered_at) values
      (v_attempt_old, 1, v_real_ids[1], 'real', true, now()),
      (v_attempt_old, 2, v_ai_ids[1], 'ai_generated', true, now()),
      (v_attempt_old, 3, v_real_ids[2], 'real', true, now()),
      (v_attempt_old, 4, v_ai_ids[2], null, false, now());

    if public.get_attempt_assignment(v_attempt_old)->'timing' <> 'null'::jsonb then
      raise exception '0015 CHECK FAILED: a pre-0015 attempt returned timing';
    end if;
    perform public.complete_attempt(v_attempt_old, u_old);
    if (select round1_score from public.attempts where id = v_attempt_old) <> 375 then
      raise exception '0015 CHECK FAILED: a legacy 3 of 4 did not score 375';
    end if;
    raise notice 'ok   legacy attempt: timing null, 3 of 4 still scores 375';

    -- ========================================================================
    -- 6. Settings unavailable: nothing created, and a retry works
    -- ========================================================================
    begin
      delete from public.event_settings where id = 1;
      begin
        perform public.start_attempt(u_nosettings);
        raise exception '0015 CHECK FAILED: start_attempt ran without settings';
      exception when raise_exception then
        get stacked diagnostics v_err = message_text;
        if v_err <> 'SETTINGS_UNAVAILABLE' then raise; end if;
      end;
      if exists (select 1 from public.attempts where user_id = u_nosettings) then
        raise exception '0015 CHECK FAILED: an attempt exists after SETTINGS_UNAVAILABLE';
      end if;
      raise exception using errcode = 'VR015', message = 'restore settings';
    exception when sqlstate 'VR015' then
      raise notice 'ok   missing settings raise SETTINGS_UNAVAILABLE and create nothing';
    end;

    insert into public.profiles (id, full_name, student_id, is_test)
    values (u_nosettings, 'Verify Retry', 'verify0015n', true);
    v_result := public.start_attempt(u_nosettings);
    if (v_result->>'resumed')::boolean or jsonb_array_length(v_result->'round1') <> v_n then
      raise exception '0015 CHECK FAILED: retry after settings returned %', v_result;
    end if;
    raise notice 'ok   with settings back, the same student starts normally';

    -- ========================================================================
    -- 7. Bank health follows the current preset
    -- ========================================================================
    v_health := public.round1_bank_health();
    if (v_health->>'images_per_game')::integer <> v_n or not (v_health->>'playable')::boolean then
      raise exception '0015 CHECK FAILED: healthy bank reported as %', v_health;
    end if;
    raise notice 'ok   bank health: % per game, playable, by count %', v_n, v_health->'playable_by_image_count';

    begin
      update public.round1_images set active = false where active;
      update public.round1_images set active = true
      where id in (v_real_ids[1], v_real_ids[2], v_ai_ids[1], v_ai_ids[2]);

      v_health := public.round1_bank_health();
      if (v_health->>'playable')::boolean
         or (v_health->'playable_by_image_count'->>'8')::boolean
         or (v_health->'playable_by_image_count'->>'10')::boolean then
        raise exception '0015 CHECK FAILED: four images reported playable: %', v_health;
      end if;

      begin
        perform public.start_attempt(u_smallbank);
        raise exception '0015 CHECK FAILED: a game started with four images in the bank';
      exception when raise_exception then
        get stacked diagnostics v_err = message_text;
        if v_err <> 'ROUND1_BANK_TOO_SMALL' then raise; end if;
      end;
      raise exception using errcode = 'VR015', message = 'restore bank';
    exception when sqlstate 'VR015' then
      raise notice 'ok   four usable images: not playable for 8 or 10, and start_attempt refuses';
    end;

    -- ========================================================================
    -- 8. The format lock: non-test attempts lock it until reset
    --
    -- Present throughout: test attempts (u_a, u_b, u_old, u_nosettings) and the
    -- real attempts marked reset in section 2.
    -- ========================================================================

    -- 8.1 In progress non-test attempt: locked.
    v_result := public.start_attempt(u_real);
    v_attempt_real := (v_result->>'attempt_id')::uuid;
    if (select is_test from public.attempts where id = v_attempt_real) then
      raise exception '0015 CHECK FAILED: a non-test profile produced a test attempt';
    end if;
    begin
      update public.event_settings set round1_image_count = v_other_n, round1_ms_per_image = v_other_ms where id = 1;
      raise exception '0015 CHECK FAILED: the preset changed with an in-progress non-test attempt';
    exception when raise_exception then
      get stacked diagnostics v_err = message_text;
      if v_err <> 'ROUND1_FORMAT_LOCKED' then raise; end if;
    end;
    raise notice 'ok   in-progress non-test attempt: preset change refused';

    -- 8.2 Abandoned non-test attempt: still locked.
    update public.attempts set status = 'abandoned' where id = v_attempt_real;
    begin
      update public.event_settings set round1_image_count = v_other_n, round1_ms_per_image = v_other_ms where id = 1;
      raise exception '0015 CHECK FAILED: the preset changed with an abandoned non-test attempt';
    exception when raise_exception then
      get stacked diagnostics v_err = message_text;
      if v_err <> 'ROUND1_FORMAT_LOCKED' then raise; end if;
    end;
    raise notice 'ok   abandoned non-test attempt: preset change refused';

    -- 8.3 The same attempt reset exactly as /admin does it: unlocked.
    update public.attempts
    set status = 'invalidated', valid_for_prize = false, invalid_reason = 'admin reset'
    where id = v_attempt_real;
    update public.event_settings set round1_image_count = v_other_n, round1_ms_per_image = v_other_ms where id = 1;
    update public.event_settings set round1_image_count = v_n, round1_ms_per_image = v_ms where id = 1;
    raise notice 'ok   reset (invalidated) non-test attempt: preset change allowed';

    -- 8.4 A completed non-test attempt: locked.
    v_result := public.start_attempt(u_real);
    if (v_result->>'resumed')::boolean or (v_result->>'attempt_id')::uuid = v_attempt_real then
      raise exception '0015 CHECK FAILED: a reset student was not given a fresh attempt: %', v_result;
    end if;
    v_attempt_real := (v_result->>'attempt_id')::uuid;
    update public.attempt_round1 ar
    set selected_answer = ri.label, correct = true, answered_at = now()
    from public.round1_images ri
    where ri.id = ar.image_id and ar.attempt_id = v_attempt_real;
    perform public.complete_attempt(v_attempt_real, u_real);
    select * into v_att from public.attempts where id = v_attempt_real;
    if v_att.status <> 'completed' or v_att.is_test or not v_att.valid_for_prize then
      raise exception '0015 CHECK FAILED: expected a completed, valid, non-test attempt, got %', to_jsonb(v_att);
    end if;
    begin
      update public.event_settings set round1_image_count = v_other_n, round1_ms_per_image = v_other_ms where id = 1;
      raise exception '0015 CHECK FAILED: the preset changed with a completed non-test attempt';
    exception when raise_exception then
      get stacked diagnostics v_err = message_text;
      if v_err <> 'ROUND1_FORMAT_LOCKED' then raise; end if;
    end;

    -- Setting the same values, or any other column, is still fine.
    update public.event_settings set round1_image_count = v_n, round1_ms_per_image = v_ms where id = 1;
    update public.event_settings set new_games_paused = true where id = 1;
    raise notice 'ok   completed non-test attempt: preset change refused, other settings still editable';

    -- ========================================================================
    -- 9. Nothing new is callable by clients
    -- ========================================================================
    foreach v_fn in array array[
      'public.round1_real_bounds(integer, integer, integer)',
      'public.start_attempt(uuid)',
      'public.get_attempt_assignment(uuid)',
      'public.complete_attempt(uuid, uuid)',
      'public.round1_bank_health()',
      'public.guard_round1_format_change()'
    ] loop
      foreach v_role in array array['anon', 'authenticated'] loop
        if has_function_privilege(v_role, v_fn, 'EXECUTE') then
          raise exception '0015 CHECK FAILED: % can execute %', v_role, v_fn;
        end if;
      end loop;
    end loop;
    raise notice 'ok   anon and authenticated cannot execute any 0015 function';

    raise exception using errcode = 'VR015', message = 'undo temporary check data';
  exception when sqlstate 'VR015' then
    raise notice 'ok   temporary users, images, attempts and settings changes undone';
  end;

  perform set_config('verify_0015.summary', v_summary, true);
end;
$$;

-- Reached only if every check above passed: any failure is an error that
-- stops the script here. current_setting() without a default also errors if
-- the checks never set their summary.
select '0015 VERIFIED: all checks passed' as result,
       current_setting('verify_0015.summary') as details;

rollback;
