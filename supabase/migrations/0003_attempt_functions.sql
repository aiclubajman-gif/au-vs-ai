-- ============================================================================
-- AU vs AI — 0003 Attempt lifecycle functions
--
-- start_attempt() is the fairness guarantee of the whole application:
--   * ONE official attempt per user, enforced by unique index, not by code
--   * Round 1 images, Round 2 class and Round 3 question frozen at creation
--   * Refresh resumes; it can never reroll an assignment
--   * Concurrent double-tap resolves to a single attempt
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Before User Created hook (§3)
-- Blocks any signup whose email is not @ajmanuni.ac.ae, at the auth layer,
-- independently of anything the frontend does.
-- Wire up in Dashboard -> Authentication -> Hooks -> Before User Created.
-- ---------------------------------------------------------------------------
create or replace function public.hook_restrict_au_domain(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_email text;
begin
  v_email := lower(trim(event->'user'->>'email'));

  if v_email is null or v_email !~ '^[^@\s]+@ajmanuni\.ac\.ae$' then
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
-- start_attempt(p_user_id)
--
-- Returns the frozen assignment WITHOUT any answers:
--   { attempt_id, resumed, current_round, round1: [{slot, image_id, path}],
--     round2: {class_key, display_name}, round3: {prompt, min, max, step, unit} }
-- ---------------------------------------------------------------------------
create or replace function public.start_attempt(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings      public.event_settings%rowtype;
  v_attempt       public.attempts%rowtype;
  v_class_id      smallint;
  v_question_id   uuid;
  v_image_ids     uuid[];
  v_is_test       boolean;
  v_bank_count    integer;
begin
  select * into v_settings from public.event_settings where id = 1;

  -- ---- Resume path: an attempt already exists ----------------------------
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

    -- Reactivate an abandoned-but-returning student.
    if v_attempt.status = 'abandoned' then
      update public.attempts set status = 'in_progress' where id = v_attempt.id;
      v_attempt.status := 'in_progress';
    end if;

    return public.get_attempt_assignment(v_attempt.id) || jsonb_build_object('resumed', true);
  end if;

  -- ---- Gate new attempts --------------------------------------------------
  if not v_settings.challenge_open then
    raise exception 'CHALLENGE_CLOSED' using errcode = 'P0001';
  end if;

  if v_settings.new_games_paused then
    raise exception 'NEW_GAMES_PAUSED' using errcode = 'P0001';
  end if;

  select is_test into v_is_test from public.profiles where id = p_user_id;
  if v_is_test is null then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  -- ---- Freeze Round 2 class ----------------------------------------------
  select id into v_class_id
  from public.round2_classes
  where active
  order by random()
  limit 1;

  if v_class_id is null then
    raise exception 'NO_DRAWING_CLASSES' using errcode = 'P0001';
  end if;

  -- ---- Freeze Round 3 question (shared, single active — §18) -------------
  select id into v_question_id
  from public.round3_question
  where active
  limit 1;

  if v_question_id is null then
    raise exception 'NO_ROUND3_QUESTION' using errcode = 'P0001';
  end if;

  -- ---- Freeze Round 1 images ---------------------------------------------
  -- §10: guarantee at least one real and one AI image, then fill the third
  -- from anywhere in the bank, then shuffle so slot order is unpredictable.
  select count(*) into v_bank_count from public.round1_images where active;
  if v_bank_count < 3 then
    raise exception 'ROUND1_BANK_TOO_SMALL' using errcode = 'P0001';
  end if;

  with one_real as (
    select id from public.round1_images
    where active and label = 'real'
    order by random() limit 1
  ),
  one_ai as (
    select id from public.round1_images
    where active and label = 'ai_generated'
    order by random() limit 1
  ),
  seeded as (
    select id from one_real union all select id from one_ai
  ),
  filler as (
    select id from public.round1_images
    where active and id not in (select id from seeded)
    order by random()
    limit 1
  ),
  combined as (
    select id from seeded union all select id from filler
  )
  select array_agg(id order by random()) into v_image_ids from combined;

  if v_image_ids is null or array_length(v_image_ids, 1) < 3 then
    raise exception 'ROUND1_BANK_UNBALANCED' using errcode = 'P0001';
  end if;

  -- ---- Atomic creation ----------------------------------------------------
  begin
    insert into public.attempts (
      user_id, status, round2_class_id, round3_question_id, current_round, is_test
    ) values (
      p_user_id, 'in_progress', v_class_id, v_question_id, 1, coalesce(v_is_test, false)
    )
    returning * into v_attempt;
  exception
    when unique_violation then
      -- A concurrent request won the race. Return that attempt, not a new one.
      select * into v_attempt
      from public.attempts
      where user_id = p_user_id and status <> 'invalidated'
      limit 1;
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
  values ('attempt_started', p_user_id, jsonb_build_object('attempt_id', v_attempt.id));

  return public.get_attempt_assignment(v_attempt.id) || jsonb_build_object('resumed', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_attempt_assignment(attempt_id)
-- Returns everything the browser needs to render the game and NOTHING it
-- could use to cheat: no image labels, no Round 3 answer, no scores.
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
-- get_attempt_result_public(attempt_id, user_id)
--
-- The ONLY path by which a student learns their result. Replaces the removed
-- attempts_read_own RLS policy.
--
-- Returns exactly what §24 permits on the result screen:
--   total score · rank · human/AI result · percentile beaten
--
-- It CANNOT return round1_score, round2_score, round3_score, r1_correct_count,
-- the Round 3 guess, the Round 3 error, or the Round 3 answer. Those columns
-- are not selected. Ownership is verified so one student cannot read another's.
-- ---------------------------------------------------------------------------
create or replace function public.get_attempt_result_public(
  p_attempt_id uuid,
  p_user_id    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt       public.attempts%rowtype;
  v_rank          integer;
  v_total_players integer;
  v_beaten        integer;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id and user_id = p_user_id;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_attempt.status <> 'completed' then
    raise exception 'ATTEMPT_NOT_COMPLETED' using errcode = 'P0001';
  end if;

  select count(*) into v_total_players
  from public.attempts
  where status = 'completed' and not is_test;

  -- Rank by the frozen tiebreak: score, then Round 1 correct, then earliest.
  select count(*) + 1 into v_rank
  from public.attempts a
  where a.status = 'completed'
    and not a.is_test
    and (
      a.total_score > v_attempt.total_score
      or (a.total_score = v_attempt.total_score
          and a.r1_correct_count > v_attempt.r1_correct_count)
      or (a.total_score = v_attempt.total_score
          and a.r1_correct_count = v_attempt.r1_correct_count
          and a.completed_at < v_attempt.completed_at)
    );

  select count(*) into v_beaten
  from public.attempts a
  where a.status = 'completed'
    and not a.is_test
    and a.total_score < v_attempt.total_score;

  return jsonb_build_object(
    'attempt_id',       v_attempt.id,
    'total_score',      v_attempt.total_score,
    'human_win',        v_attempt.human_win,
    'rank',             v_rank,
    'total_players',    v_total_players,
    'percentile_beaten',
      case when v_total_players <= 1 then 0
           else round(100.0 * v_beaten / (v_total_players - 1))
      end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- abandon_stale_attempts()
-- Keeps "PLAYING NOW" honest and surfaces students who need an admin reset.
-- Call from a scheduled job or an admin action.
-- ---------------------------------------------------------------------------
create or replace function public.abandon_stale_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes integer;
  v_count   integer;
begin
  select abandon_after_minutes into v_minutes from public.event_settings where id = 1;

  update public.attempts
  set status = 'abandoned'
  where status = 'in_progress'
    and started_at < now() - (v_minutes || ' minutes')::interval;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
