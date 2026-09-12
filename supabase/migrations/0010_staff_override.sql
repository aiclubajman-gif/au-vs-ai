-- ============================================================================
-- AU vs AI — 0010 Staff override codes (§38)
--
-- WHY THIS EXISTS
--   Testing against a real Ajman inbox showed verification codes landing in
--   Microsoft 365 quarantine, which students cannot see from a mail client.
--   If the tenant allowlist is not in place by 22 September, a student whose
--   code never arrives has no way to play.
--
-- HOW IT STAYS HONEST
--   A staff-issued code is a REAL Supabase OTP, generated through the admin
--   API without sending an email. The student still authenticates normally, so
--   there is no bypass path and no second class of session.
--
--   What it DOES weaken is proof that the person controls that AU mailbox. So:
--   an override attempt is prize-ineligible by default, and only becomes
--   eligible when a board member confirms they physically checked the
--   student's AU ID card. That is enforced here, in the database, not in the
--   admin UI.
-- ============================================================================

-- We never store the code itself (§48: do not log OTP codes). Supabase holds
-- it; this table is purely an audit trail of who issued what to whom.
alter table public.staff_override_codes
  alter column code_hash drop not null;

comment on column public.staff_override_codes.code_hash is
  'Always NULL. The OTP lives in Supabase auth; storing it here would be a '
  'logged credential. This table records only that an override was issued.';

-- ---------------------------------------------------------------------------
-- start_attempt — now sets prize eligibility from the verification method.
--
-- Everything else is unchanged from 0009.
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
  v_bank_count   integer;
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

  -- Prize eligibility (§38). An email-verified student is eligible. A
  -- staff-override student is eligible ONLY if a board member confirmed they
  -- checked the physical AU ID card.
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
  from public.round3_question where active limit 1;
  if v_question_id is null then
    raise exception 'NO_ROUND3_QUESTION' using errcode = 'P0001';
  end if;

  select count(*) into v_bank_count from public.round1_images where active;
  if v_bank_count < 4 then
    raise exception 'ROUND1_BANK_TOO_SMALL' using errcode = 'P0001';
  end if;

  with one_real as (
    select id from public.round1_images
    where active and label = 'real' order by random() limit 1
  ),
  one_ai as (
    select id from public.round1_images
    where active and label = 'ai_generated' order by random() limit 1
  ),
  seeded as (
    select id from one_real union all select id from one_ai
  ),
  filler as (
    select id from public.round1_images
    where active and id not in (select id from seeded)
    order by random() limit 2
  ),
  combined as (
    select id from seeded union all select id from filler
  )
  select array_agg(id order by random()) into v_image_ids from combined;

  if v_image_ids is null or array_length(v_image_ids, 1) < 4 then
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
  values ('attempt_started', p_user_id,
          jsonb_build_object('attempt_id', v_attempt.id, 'prize_eligible', v_prize_ok));

  return public.get_attempt_assignment(v_attempt.id) || jsonb_build_object('resumed', false);
end;
$$;

revoke all on function public.start_attempt(uuid) from public, anon, authenticated;
grant execute on function public.start_attempt(uuid) to service_role;

notify pgrst, 'reload schema';
