-- ============================================================================
-- AU vs AI — 0004 Row Level Security + public views
--
-- STRATEGY (§39): browsers cannot write ANY gameplay table. Every write goes
-- through a server route holding the service role key, which bypasses RLS.
-- Clients get narrow read access only. "Deny everything, allow narrowly" is
-- far easier to verify than a dozen fine-grained write policies.
-- ============================================================================

alter table public.profiles             enable row level security;
alter table public.attempts             enable row level security;
alter table public.attempt_round1       enable row level security;
alter table public.attempt_round2       enable row level security;
alter table public.attempt_round3       enable row level security;
alter table public.round1_images        enable row level security;
alter table public.round2_classes       enable row level security;
alter table public.round3_question      enable row level security;
alter table public.colleges             enable row level security;
alter table public.event_settings       enable row level security;
alter table public.admins               enable row level security;
alter table public.admin_actions        enable row level security;
alter table public.staff_override_codes enable row level security;
alter table public.club_registrations   enable row level security;
alter table public.raffle_runs          enable row level security;
alter table public.dataset_tokens       enable row level security;
alter table public.dataset_responses    enable row level security;
alter table public.app_events           enable row level security;

-- ---------------------------------------------------------------------------
-- No policies at all = deny everything for anon/authenticated.
-- The following are the deliberate, narrow exceptions.
-- ---------------------------------------------------------------------------

-- A student may read their own profile.
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- ===========================================================================
-- DELIBERATELY ABSENT: any SELECT policy on public.attempts.
--
-- An earlier draft allowed a student to read their own attempts row. That row
-- contains round1_score, round2_score, round3_score and r1_correct_count.
-- Exposing it let a determined student diff their Round 3 score against a
-- friend's and narrow down the shared answer, defeating §21.
--
-- Resume state and results now come from two SECURITY DEFINER functions that
-- return only what the screen needs:
--   get_attempt_assignment()     — no scores at all
--   get_attempt_result_public()  — total, rank, human_win, percentile
-- Both are server-only (see 0006_function_permissions.sql).
-- ===========================================================================

-- Colleges are a public dropdown.
create policy colleges_read_all on public.colleges
  for select to anon, authenticated
  using (active);

-- Drawing class names are not secret.
create policy round2_classes_read_all on public.round2_classes
  for select to anon, authenticated
  using (active);

-- NOTE the tables deliberately absent from the list above:
--   attempts        — contains all three round scores (§22)
--   round1_images   — contains the correct label (§11)
--   round3_question — contains the correct answer (§21)
--   attempt_round1/2/3 — contain per-round scores and the student's guess
--   event_settings  — contains the win threshold and scoring tolerance
--   admins, admin_actions, staff_override_codes, raffle_runs
--   dataset_tokens, dataset_responses, app_events
-- These are reachable ONLY through the service role on the server.

-- ---------------------------------------------------------------------------
-- PUBLIC LEADERBOARD VIEW (§29)
--
-- security_invoker = off (the default for views) means this view runs with the
-- privileges of its owner, so it can read attempts/profiles even though the
-- caller cannot. It exposes rank, display name, masked id and total score.
-- It CANNOT expose email, user id, college, or round scores — those columns
-- are not selected at all.
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard_public as
select
  row_number() over (
    order by a.total_score desc, a.r1_correct_count desc, a.completed_at asc
  ) as rank,
  -- "Ahmed K." — first name plus last initial.
  split_part(trim(p.full_name), ' ', 1) ||
    case
      when array_length(string_to_array(trim(p.full_name), ' '), 1) > 1
      then ' ' || upper(left(split_part(trim(p.full_name), ' ',
             array_length(string_to_array(trim(p.full_name), ' '), 1)), 1)) || '.'
      else ''
    end as display_name,
  right(p.student_id, 4) as masked_id_suffix,
  a.total_score,
  a.human_win,
  a.completed_at
from public.attempts a
join public.profiles p on p.id = a.user_id
where a.status = 'completed'
  and not a.is_test
  and not p.is_test;

grant select on public.leaderboard_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PUBLIC EVENT STATS VIEW (§30)
-- Aggregates only. Nothing here can be used to infer the Round 3 answer.
-- ---------------------------------------------------------------------------
create or replace view public.event_stats_public as
select
  count(*) filter (where a.status = 'completed')                      as total_players,
  count(*) filter (where a.status = 'completed' and a.human_win)      as human_wins,
  count(*) filter (where a.status = 'completed' and not a.human_win)  as ai_wins,
  coalesce(max(a.total_score) filter (where a.status = 'completed'), 0) as top_score,
  coalesce(round(avg(a.total_score) filter (where a.status = 'completed')), 0) as average_score,
  count(*) filter (
    where a.status = 'in_progress' and a.started_at > now() - interval '5 minutes'
  ) as playing_now
from public.attempts a
where not a.is_test;

grant select on public.event_stats_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ROUND 1 AGGREGATE ACCURACY (§30 — safe to show live)
-- ---------------------------------------------------------------------------
create or replace view public.round1_accuracy_public as
select
  count(*)                                              as answered_total,
  count(*) filter (where ar.correct)                    as correct_total,
  case when count(*) = 0 then 0
       else round(100.0 * count(*) filter (where ar.correct) / count(*), 1)
  end                                                   as accuracy_pct
from public.attempt_round1 ar
join public.attempts a on a.id = ar.attempt_id
where ar.selected_answer is not null and not a.is_test;

grant select on public.round1_accuracy_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ROUND 2 RECOGNITION RATE (§30 — safe to show live)
-- ---------------------------------------------------------------------------
create or replace view public.round2_recognition_public as
select
  count(*)                                       as submissions,
  count(*) filter (where ar.recognized)          as recognized_total,
  case when count(*) = 0 then 0
       else round(100.0 * count(*) filter (where ar.recognized) / count(*), 1)
  end                                            as recognition_pct
from public.attempt_round2 ar
join public.attempts a on a.id = ar.attempt_id
where ar.submitted_at is not null and not a.is_test;

grant select on public.round2_recognition_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- SCORE DISTRIBUTION (§30) — buckets of 100
-- ---------------------------------------------------------------------------
create or replace view public.score_distribution_public as
select
  (a.total_score / 100) * 100 as bucket_start,
  count(*)                    as players
from public.attempts a
where a.status = 'completed' and not a.is_test
group by 1
order by 1;

grant select on public.score_distribution_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- COLLEGE PARTICIPATION (§6 — aggregate only, never beside a name)
-- ---------------------------------------------------------------------------
create or replace view public.college_participation_public as
select
  c.name          as college,
  count(*)        as players
from public.attempts a
join public.profiles p on p.id = a.user_id
join public.colleges c on c.id = p.college_id
where a.status = 'completed' and not a.is_test and not p.is_test
group by c.name
order by count(*) desc;

grant select on public.college_participation_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- NOTE: there is deliberately NO public view of Round 3 data (§21).
-- Guess distribution, average error and score histograms for Round 3 exist
-- only in admin queries, and only after event_settings.entries_closed.
-- ---------------------------------------------------------------------------
