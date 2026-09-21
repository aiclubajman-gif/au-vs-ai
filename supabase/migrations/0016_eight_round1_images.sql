-- ===========================================================================
-- 0016 — Round 1 grows to eight images.
--
-- Eight slots at 63/62 points (alternating) sum to exactly 500. The slot
-- constraint, the image picker and the code-side scoring table all move
-- together; apply this and deploy the matching app build in the same window.
-- ===========================================================================

alter table public.attempt_round1
  drop constraint if exists attempt_round1_slot_range;

alter table public.attempt_round1
  add constraint attempt_round1_slot_range check (slot between 1 and 8);

-- ---------------------------------------------------------------------------
-- start_attempt — eight Round 1 images, random real/AI ratio between 2:6 and 6:2.
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
  v_real_avail   integer;
  v_ai_avail     integer;
  v_want_real    integer;
  v_want_ai      integer;
  v_prize_ok     boolean;
  v_invalid_note text;
begin
  select * into v_settings from public.event_settings where id = 1;

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

  -- Round 3 for TODAY. A missing question for the current day is a setup
  -- error, not something to silently fall back from.
  select id into v_question_id
  from public.round3_question
  where active and day_slot = v_settings.current_day
  limit 1;

  if v_question_id is null then
    raise exception 'NO_ROUND3_QUESTION' using errcode = 'P0001';
  end if;

  -- ---- Round 1: random ratio, then fill from each label ------------------
  select count(*) filter (where label = 'real'),
         count(*) filter (where label = 'ai_generated')
    into v_real_avail, v_ai_avail
  from public.round1_images where active;

  if v_real_avail + v_ai_avail < 8 then
    raise exception 'ROUND1_BANK_TOO_SMALL' using errcode = 'P0001';
  end if;
  if v_real_avail < 1 or v_ai_avail < 1 then
    raise exception 'ROUND1_BANK_UNBALANCED' using errcode = 'P0001';
  end if;

  -- Pick between 2 and 6 real images at random, then clamp to what the bank can supply.
  v_want_real := 2 + floor(random() * 5)::integer;   -- 2, 3, 4, 5 or 6
  v_want_real := least(v_want_real, v_real_avail, 6);
  v_want_ai   := 8 - v_want_real;

  -- If the bank is short on AI images, shift the balance back to real.
  if v_want_ai > v_ai_avail then
    v_want_ai   := v_ai_avail;
    v_want_real := 8 - v_want_ai;
  end if;

  if v_want_real > v_real_avail then
    raise exception 'ROUND1_BANK_UNBALANCED' using errcode = 'P0001';
  end if;

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

  if v_image_ids is null or array_length(v_image_ids, 1) < 8 then
    raise exception 'ROUND1_BANK_UNBALANCED' using errcode = 'P0001';
  end if;

  begin
    insert into public.attempts (
      user_id, status, round2_class_id, round3_question_id, current_round,
      is_test, valid_for_prize, invalid_reason
    ) values (
      p_user_id, 'in_progress', v_class_id, v_question_id, 1,
      coalesce(v_profile.is_test, false), v_prize_ok, v_invalid_note
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
    'ratio', v_want_real || ':' || v_want_ai,
    'prize_eligible', v_prize_ok
  ));

  return public.get_attempt_assignment(v_attempt.id) || jsonb_build_object('resumed', false);
end;
$$;

revoke all on function public.start_attempt(uuid) from public, anon, authenticated;
grant execute on function public.start_attempt(uuid) to service_role;
