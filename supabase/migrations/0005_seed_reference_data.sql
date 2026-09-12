-- ============================================================================
-- AU vs AI — 0005 Reference data (production-safe, not test data)
--
-- This migration seeds real configuration, not fake students. Development
-- seed data lives in scripts/seed-dev.ts and is flagged is_test = true.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Colleges (§6)
-- ACTION REQUIRED: verify this list against the official Ajman University
-- website before the fair and correct any names. Editable from /admin.
-- ---------------------------------------------------------------------------
insert into public.colleges (name, sort_order) values
  ('College of Engineering & Information Technology', 10),
  ('College of Business Administration',              20),
  ('College of Law',                                  30),
  ('College of Mass Communication & Humanities',      40),
  ('College of Dentistry',                            50),
  ('College of Pharmacy & Health Sciences',           60),
  ('College of Architecture, Art & Design',           70),
  ('College of Medicine',                             80),
  ('Deanship of Graduate Studies & Research',         90),
  ('Foundation / Preparatory Programme',              95),
  ('Other',                                          100)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Round 2 drawing classes (§15)
-- 15 classes chosen for being unambiguous when drawn badly, with a finger,
-- in 20 seconds. Adjust during model testing if any class performs poorly.
-- ---------------------------------------------------------------------------
insert into public.round2_classes (class_key, display_name) values
  ('bicycle',  'BICYCLE'),
  ('cat',      'CAT'),
  ('fish',     'FISH'),
  ('car',      'CAR'),
  ('tree',     'TREE'),
  ('cup',      'CUP'),
  ('star',     'STAR'),
  ('umbrella', 'UMBRELLA'),
  ('clock',    'CLOCK'),
  ('airplane', 'AIRPLANE'),
  ('apple',    'APPLE'),
  ('house',    'HOUSE'),
  ('key',      'KEY'),
  ('ladder',   'LADDER'),
  ('sun',      'SUN')
on conflict (class_key) do nothing;

-- ---------------------------------------------------------------------------
-- Round 3 shared question (§18)
--
-- INACTIVE by default so it cannot go live by accident. Set the real answer
-- from /admin and activate it before the fair opens. Exactly one row may be
-- active at a time (enforced by round3_single_active_idx).
--
-- The prompt MUST contain the anchor number the student reasons from.
-- ---------------------------------------------------------------------------
insert into public.round3_question
  (prompt, correct_answer, min_value, max_value, step, unit, reveal_text, active)
values (
  'The AIDA board has 12 members. How many paid AI subscriptions do they have between them?',
  17,
  0,
  40,
  1,
  'subscriptions',
  'PLACEHOLDER — replace with the real answer and a fun fact before the fair.',
  false
)
on conflict do nothing;
