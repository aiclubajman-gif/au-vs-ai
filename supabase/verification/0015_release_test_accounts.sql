-- ============================================================================
-- AU vs AI — before release: team test accounts and old attempts (0015)
--
-- NOT A MIGRATION, and not one query: run each numbered step on its own in the
-- Supabase SQL Editor, with the challenge CLOSED. Steps 1 and 4 only read.
--
-- The emails below are placeholders. Replace them in the editor; never commit
-- real emails or user ids.
--
-- Why this order
--   * attempts.is_test is copied from profiles.is_test when an attempt is
--     CREATED. A team member must be flagged BEFORE starting a test game.
--   * Flagging a profile never converts an existing attempt. But the public
--     leaderboard also hides profiles flagged is_test, so flagging someone who
--     still has an official attempt would quietly pull it off the leaderboard
--     while it stays in the event stats. Step 3 therefore skips anyone with an
--     official attempt: reset that attempt first (step 2), then flag.
--   * Once 0015 is applied, every non-test attempt that has not been reset
--     locks the Round 1 format. Attempts from before 0015 (3 or 4 images, no
--     timing snapshot) also cannot be played. Reset all of them before launch.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. REVIEW — every official attempt: not a test attempt, not reset.
--    Works before and after 0015. At launch this list must contain only real
--    students' games (and should normally be empty).
-- ---------------------------------------------------------------------------
select
  a.id                                   as attempt_id,
  a.status,
  a.total_score,
  a.started_at,
  (select count(*) from public.attempt_round1 r where r.attempt_id = a.id) as round1_images,
  (select count(*) from public.attempt_round1 r where r.attempt_id = a.id) < 8 as pre_0015,
  p.full_name,
  u.email,
  p.is_test                              as profile_is_test
from public.attempts a
join auth.users u on u.id = a.user_id
left join public.profiles p on p.id = a.user_id
where not a.is_test
  and a.status <> 'invalidated'
order by a.started_at;


-- ---------------------------------------------------------------------------
-- 2. RESET every row from step 1 that is a team/test game or pre_0015.
--
--    Preferred: /admin → Attempts → Reset (it is logged). /admin lists the 40
--    most recent attempts; for an older one, this is the same update:
--
--      update public.attempts
--      set status = 'invalidated', valid_for_prize = false, invalid_reason = 'admin reset'
--      where id = '<attempt_id from step 1>'
--      returning id, status;
--
--    Never delete attempts, and never set attempts.is_test on an existing row.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 3. FLAG team profiles as test — only those with no official attempt left.
--    A team member needs a profile first: sign in at /play, finish the
--    profile screen, and stop before starting a game. Run this, then play.
-- ---------------------------------------------------------------------------
update public.profiles p
set is_test = true
from auth.users u
where u.id = p.id
  and lower(u.email) in (
    'team.member.one@ajmanuni.ac.ae',
    'team.member.two@ajmanuni.ac.ae'
  )
  and not p.is_test
  and not exists (
    select 1 from public.attempts a
    where a.user_id = p.id and not a.is_test and a.status <> 'invalidated'
  )
returning p.id, u.email, p.is_test;


-- ---------------------------------------------------------------------------
-- 4. CONFIRM — every listed email, with what still blocks it. Use the same
--    emails as step 3. Ready to play test games: is_test = true and
--    has_official_attempt = false.
-- ---------------------------------------------------------------------------
select
  e.email,
  p.id is not null                        as has_profile,
  coalesce(p.is_test, false)              as is_test,
  exists (
    select 1 from public.attempts a
    where a.user_id = u.id and not a.is_test and a.status <> 'invalidated'
  )                                       as has_official_attempt
from unnest(array[
  'team.member.one@ajmanuni.ac.ae',
  'team.member.two@ajmanuni.ac.ae'
]) as e(email)
left join auth.users u on lower(u.email) = e.email
left join public.profiles p on p.id = u.id
order by e.email;
