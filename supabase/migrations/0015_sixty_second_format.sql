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
