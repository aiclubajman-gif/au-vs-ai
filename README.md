# AU vs AI — 60 Second Challenge

Interactive booth game for the **Ajman University Club Fair, 22–23 September 2026**,
built by the AI & Data Science Club (AIDA).

Students scan a QR code, verify their AU email, and play three rounds against an AI.
One official attempt per student. Live leaderboard and booth TV dashboard.

**Stack:** Next.js 16 · TypeScript · Tailwind 4 · Supabase · Resend · Vercel · TensorFlow.js

---

# BOOTH RUNBOOK — read this first on 22 September

> Print this section and keep it at the booth.

| Problem | Fix |
|---|---|
| **Student's code never arrives** | 1. Junk folder. 2. Their AU webmail → **Quarantine** (separate from Junk, invisible on phones). 3. `/admin` → **Override code** → check their AU ID card → tick the box → read them the 6-digit code. Without the ID check they can play but cannot win a prize. |
| **Student stuck mid-game** | `/admin` → Attempts → find them → Reset. Logs who did it. |
| **Something is badly wrong** | `/admin` → big red **PAUSE NEW GAMES**. Running games finish; no new ones start. |
| **TV frozen or blank** | Reload the browser tab. The page also self-reloads every 30 min. |
| **Student says "I already played" but didn't** | Check `/admin` → Attempts. If genuinely broken, Reset. Otherwise they played. |
| **Error screen with a code (e.g. ERR-7K2M)** | Note the code. `/admin` → Logs → search it. |

**Do not change the human-win threshold or Round 3 answer during the event.**

### If email is failing across the board

Override codes work for one student at a time and need an ID check each time.
If codes are failing for *everyone*, that is a filtering problem on the
university side, not something the app can fix mid-event. Escalate to AU IT,
and use override codes to keep the queue moving in the meantime.

---


## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm test           # unit tests (107, incl. static security audit)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

---

## How fairness is enforced

| Rule | Mechanism |
|---|---|
| One attempt per student | Partial unique index on `attempts(user_id)`. Not application code — the database physically rejects a second row. |
| Refresh can't reroll questions | `start_attempt()` freezes all three rounds atomically at creation. |
| Double-tap can't create two attempts | Unique violation is caught and the existing attempt returned. |
| Answers can't leak to the browser | `round1_images.label` and `round3_question.correct_answer` have no RLS read policy and appear in no public view. |
| Scores can't be forged | Browsers cannot write any gameplay table. The server recomputes the total from stored round records. |
| No round-score leakage | There is no client read policy on `attempts` at all. Results come from `get_attempt_result_public()`, which returns total, rank, human/AI and percentile — the round score columns are never selected. |
| Functions can't be called directly | `0006` revokes the default PUBLIC EXECUTE grant on every function and grants only `service_role`. `ALTER DEFAULT PRIVILEGES` covers functions added later. |
| Round 3 answer stays secret | No public view exposes Round 3 data until `entries_closed`. Scoring tolerance lives in `event_settings`, which no client can read. |
| Round 3 difficulty can't drift | Tolerance is decoupled from the slider range, so widening the slider for usability cannot change anyone's score. |

## Anonymity of the `/dataset` activity

1. `dataset_tokens` has **no user_id column** — the link cannot exist.
2. `dataset_responses` stores answers plus a **date**, not a timestamp, so
   responses cannot be correlated against attempt completion times.
3. CSV export is shuffled, so row order carries no signal.

## Project structure

```
src/app/            routes: / /play /leaderboard /dashboard /admin /dataset
src/lib/scoring/    pure scoring functions (42 tests)
src/lib/validation/ Zod schemas, AU email rules (25 tests)
src/lib/supabase/   browser / server / service-role clients
src/lib/ml/         drawing classifier interface (Phase 3)
src/types/          shared domain types
supabase/migrations/ schema, functions, RLS, seed data
tests/              Vitest unit tests
```
