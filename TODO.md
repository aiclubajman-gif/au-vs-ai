# AU vs AI — Build Status

Event: **22–23 September 2026** · Feature freeze: **14 September**

---

## PHASE 0 — Foundation · 8 Sep · ✅ COMPLETE

- [x] Next.js 16 + TypeScript + Tailwind 4 scaffold
- [x] Dependencies: Supabase, Zod, Recharts, Vitest
- [x] Project structure
- [x] Migration 0001 — core schema, one-attempt unique index
- [x] Migration 0002 — settings, admin, registration, raffle, dataset
- [x] Migration 0003 — atomic `start_attempt`, AU domain hook
- [x] Migration 0004 — RLS (deny-all-writes) + public views
- [x] Migration 0005 — colleges, drawing classes, R3 placeholder
- [x] Scoring library + 48 unit tests
- [x] Validation library + 25 unit tests
- [x] Migration 0006 — function EXECUTE lockdown (security audit)
- [x] Static security test suite (34 tests) — fails the build if a function
      is added without a revoke, or if score/answer read access reappears
- [x] Supabase browser/server/admin clients
- [x] Design tokens
- [x] Route stubs: / /play /leaderboard /dashboard /admin /dataset
- [x] `.env.example`
- [x] Build + typecheck + 107 tests green

### Phase 0 security fixes applied
- [x] Revoked default PUBLIC EXECUTE on all 7 functions; granted service_role only
- [x] `ALTER DEFAULT PRIVILEGES` so future functions aren't public
- [x] Removed `attempts_read_own` RLS policy (leaked all three round scores)
- [x] Added `get_attempt_result_public()` returning total/rank/win/percentile only
- [x] Round 3 tolerance decoupled from slider range; bad guesses now reach 0
- [x] `attempt_round3.guess` nullable; NULL = unanswered

## PHASE 1 — Auth & attempt · 9 Sep · ⬜ NEXT

- [ ] Email entry screen, AU domain validation
- [ ] OTP screen: 6 boxes, paste, auto-advance, 60s resend cooldown
- [ ] Wrong-code lockout (5 fails / 15 min)
- [ ] Profile setup: name + college
- [ ] Device check — model loads BEFORE attempt creation (§8)
- [ ] `POST /api/attempt/start` → `start_attempt()`
- [ ] Resume logic
- [ ] Already-completed branch

## PHASE 2 — Full game loop · 10 Sep · ⬜

- [ ] Round 1: image, REAL / AI GENERATED, "Answer locked" (§11)
- [ ] Round 3: slider, "Answer locked" (§21)
- [ ] Round 2 MOCK classifier
- [ ] Server scoring for all rounds
- [ ] Attempt completion (atomic, idempotent)
- [ ] Result screen: total + rank only (§22)
- [ ] Screen 2: leaderboard confirmation + AIDA CTA

## PHASE 3 — Real drawing model · 11 Sep · ✅ COMPLETE

- [x] Train CNN on QuickDraw bitmaps, 15 classes (Colab, Keras 2 via tf_keras)
- [x] Export to TensorFlow.js — notebook writes the format directly,
      no `tensorflowjs` package (no py3.13 wheel on Colab)
- [x] Canvas: pointer events, undo, clear
- [x] Preprocessing: crop → pad → 28×28 → normalize
- [x] Debug page at /debug/draw showing model input + load errors
- [x] Inference AFTER submit, then reveal (§14)
- [x] Auto-detect real model, fall back to mock if absent
- [ ] Mobile canvas testing on a real phone
- [ ] Old Android testing

## PHASE 4 — Live event systems · 12–13 Sep · 🟡 IN PROGRESS

- [x] Leaderboard page (/leaderboard, top 50, masked IDs)
- [x] Admin panel (/admin) — server-gated, PAUSE NEW GAMES, stats,
      settings, attempt reset/disqualify, audit log
- [x] make-admin script
- [ ] TV dashboard
- [ ] TV dashboard + rotating panels
- [ ] Realtime + 8s polling fallback
- [ ] Recharts visualisations
- [ ] Admin panel + PAUSE NEW GAMES
- [x] Staff override codes
- [ ] Club registration
- [ ] Raffle + audit
- [ ] `/dataset` + anonymous tokens
- [ ] CSV exports
- [ ] Dev seed script (`is_test = true`)

## 14 SEP — FEATURE FREEZE

## Hardening · 14–21 Sep · ⬜

- [ ] Load real Round 1 image bank
- [ ] iPhone Safari / Android Chrome / old Android / tablet
- [ ] **FREEZE URL, SEND QR TO PRINT — 16 Sep**
- [ ] 50 real AU inbox burst test
- [ ] 50-user load simulation
- [ ] TV rehearsal in the hall
- [ ] Freeze human-win threshold + R3 tolerance from test data
- [ ] Set real R3 answer, activate question
- [ ] Purge test data
- [ ] Print booth runbook

---

## EMAIL DELIVERABILITY — CONFIRMED ISSUE

Tested 11 Sep against a real AU inbox:
- DNS fully verified, Supabase -> Resend -> AU all working
- Resend reports **Delivered**, 2-4s once the sender is trusted
- BUT the first message landed in **Microsoft 365 quarantine**, not Junk
- Marking the sender trusted is PER-MAILBOX and does not help other students

Risk: every student hits quarantine on their first code and cannot find it.

Mitigations, in priority order:
- [ ] **AU IT tenant allowlist for auth.auvsai.com** — the real fix, send today
- [ ] Test with 2-3 CLEAN board AU inboxes to confirm scope
- [ ] Daily domain warming until the fair, each recipient marks "not junk"
- [x] On-screen quarantine instructions on the OTP screen
- [x] **Staff override codes BUILT** — /admin issues a real Supabase OTP with
      no email sent. Prize eligibility gated on a physical ID check, enforced
      in the database. This is the fair-day fallback if the allowlist misses.

## BLOCKED ON GHAITH

| | Needed by |
|---|---|
| Domain purchased | Today |
| Supabase project + keys | Today |
| Resend account + DNS records | Today |
| Vercel account + GitHub repo | Today |
| Test OTP to real AU inbox | DONE — delivers, quarantined |
| Email AU IT for allowlist | TODAY — critical path |
| Clean-inbox test, 2-3 board members | Today |
| Confirm college list | 9 Sep |
| Round 1 image bank | 10 Sep |
| Real Round 3 answer | 16 Sep |

## OPEN DECISIONS

- Round 3 tolerance — default 20, exponent 1.5. Guesses >=20 away score 0.
  Tune BOTH from test data, then freeze before the fair.
- Human-win threshold — default 600. Freeze from ~30 test scores.
- Round 1 bank size — need enough that neighbours rarely share images.
