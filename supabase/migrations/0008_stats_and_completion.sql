-- ============================================================================
-- AU vs AI — 0008 Image stats + atomic attempt completion
-- ============================================================================

-- ---------------------------------------------------------------------------
-- bump_image_stats — tracks which Round 1 images fool students.
-- Feeds the admin "hardest image" report. Never exposed publicly during play.
-- ---------------------------------------------------------------------------
create or replace function public.bump_image_stats(p_image_id uuid, p_correct boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.round1_images
  set times_shown   = times_shown + 1,
      times_correct = times_correct + case when p_correct then 1 else 0 end
  where id = p_image_id;
$$;

-- ---------------------------------------------------------------------------
-- complete_attempt — the authoritative final score (§9, §17).
--
-- Recomputes the total from the STORED round records rather than trusting any
-- number the browser sends. Runs as a single statement per table inside one
-- function call, so a retry after a dropped connection cannot double-apply.
--
-- Idempotent: calling it on an already-completed attempt returns the existing
-- result instead of rescoring, which is what makes the offline retry in §40
-- safe.
-- ---------------------------------------------------------------------------
create or replace function public.complete_attempt(p_attempt_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt   public.attempts%rowtype;
  v_r1        integer;
  v_r1_correct smallint;
  v_r2        integer;
  v_r3        integer;
  v_total     integer;
  v_threshold integer;
  v_elapsed   integer;
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

  select coalesce(sum(points), 0), coalesce(count(*) filter (where correct), 0)
    into v_r1, v_r1_correct
  from public.attempt_round1 where attempt_id = p_attempt_id;

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

-- Lock these down exactly like every other function (0006).
revoke all on function public.bump_image_stats(uuid, boolean) from public, anon, authenticated;
revoke all on function public.complete_attempt(uuid, uuid)    from public, anon, authenticated;

grant execute on function public.bump_image_stats(uuid, boolean) to service_role;
grant execute on function public.complete_attempt(uuid, uuid)    to service_role;

notify pgrst, 'reload schema';
