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

## Setup — do these in order

You need four accounts. Steps are written for someone who has not used these before.

### 1. Domain (~$12/year)

Buy from Namecheap, Cloudflare or Porkbun. You need it for the QR URL **and**
for sending email. Short and typo-proof, since it goes under the QR code.

### 2. Supabase

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project.**
   - Name: `au-vs-ai`
   - Database password: generate one, **save it in your password manager**
   - Region: **Frankfurt** or **Mumbai** (lowest latency to the UAE)
3. Wait ~2 minutes for provisioning.
4. **Project Settings → Data API.** Copy **Project URL** →
   `NEXT_PUBLIC_SUPABASE_URL`
5. **Project Settings → API Keys.**
   - Copy the **anon / publishable** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click **Reveal** on **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

> **service_role bypasses every security rule.** It goes in `.env.local` and in
> Vercel's environment variables and nowhere else. Never paste it into chat, a
> screenshot, or a file that gets committed.

### 3. Run the migrations

**SQL Editor → New query.** Paste and run each file in order:

```
supabase/migrations/0001_core_schema.sql
supabase/migrations/0002_event_admin_dataset.sql
supabase/migrations/0003_attempt_functions.sql
supabase/migrations/0004_rls_and_views.sql
supabase/migrations/0005_seed_reference_data.sql
supabase/migrations/0006_function_permissions.sql
```

Run them one at a time and confirm "Success" before the next.
**0006 must run last** — it locks down function execution and depends on every
function existing first. After it completes, run the verification query at the
bottom of that file. It must return **zero rows**.

### 4. Email — the highest-risk step, do it today

Supabase's built-in sender delivers **only to your own organization's members**
and is capped at **2 messages per hour**. Without custom SMTP, students receive
nothing at all.

1. Sign up at <https://resend.com>.
2. **Domains → Add Domain.** Enter `auth.yourdomain.com` (a subdomain keeps
   auth-email reputation separate from your website).
3. Resend shows DNS records (SPF, DKIM, DMARC). Add them at your registrar.
   **Do this today** — propagation takes hours.
4. Once verified, **API Keys → Create** and note the SMTP credentials.
5. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**
   - Host: `smtp.resend.com`, Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender: `no-reply@auth.yourdomain.com`

### 5. Make Supabase send a CODE, not a link

**Authentication → Emails → Templates → Magic Link.** The default template sends
a clickable link. Replace the body so it contains:

```
{{ .Token }}
```

Without this, students get a magic link instead of a 6-digit code.

### 6. Raise the rate limits

**Authentication → Rate Limits.** Custom SMTP starts at **30 emails/hour**,
which will fail you by mid-morning. Raise well above expected peak (300–500/hour).
Note that failed attempts consume quota even when no email is sent.

### 7. Lock signups to AU emails

**Authentication → Hooks → Before User Created →** select the Postgres function
`hook_restrict_au_domain` (created by migration 0003, widened to both AU
domains by 0017). This blocks non-AU signups at the auth layer,
independently of the frontend.

Both `@ajmanuni.ac.ae` and `@ajman.ac.ae` are accepted. The app reads the
list from `AU_EMAIL_DOMAINS` in `src/types/index.ts`; the database reads it
from migration `0017_second_au_email_domain.sql`. The two must agree, or
students on the missing domain pass validation and then never get a code.

### 8. Local development

```bash
cp .env.example .env.local   # fill in the values from steps 2 and 4
npm install
npm run dev                  # http://localhost:3000
```

### 9. Vercel

1. Push to GitHub.
2. <https://vercel.com> → **Add New → Project** → import the repo.
3. **Environment Variables**: add every line from `.env.local`.
4. Deploy, then add your custom domain under **Settings → Domains**.
5. Back in Supabase: **Authentication → URL Configuration → Site URL** must
   match your production URL exactly.

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
