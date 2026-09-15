# Page 1 — Email: implementation note

Branch: `ui/mobile-redesign-v2`. Scope: the `email` step of `PlayFlow` only.

## Sources

| Role | File | Notes |
|---|---|---|
| Behaviour | `src/components/game/PlayFlow.tsx`, `src/lib/client/email.ts`, `/api/auth/send-otp` | Unchanged API contract: `POST { email }` with the full address |
| Visual reference | `design-source/page-01-email/01-email-approved.png` | 941 × 1672, 2.0 MB. Git-ignored, local only; not loaded by the app |
| Artwork master | `design-source/page-01-email/email-clean-plate.png` | 941 × 1670, 1.9 MB. Git-ignored, local only. Byte-identical to the file first delivered as `email-clean-plate.webp` (it was always PNG data) |
| Plate build | `design-source/page-01-email/build-plate.py`, `encode-plate.mjs` | Composite → `email-plate-master-v2.png` (lossless) → production WebP |
| Production plate | `public/design/auth/email-plate-941w.webp` | 941 × 1670, 204 KB. Real WebP, q86 / effort 6 / smart subsample. The only design asset that ships |

`design-source/` is git-ignored: masters, the mockup and QA captures never
reach `public/` or the deploy.

### Plate build

The clean master lost the campus signage when its UI was removed. The build
copies back, from the mockup (registered: it is the same render stretched 2 px
taller), only fixed signage below the card: the "AJMAN UNIVERSITY" sign and
logo on the central building, both banner faces (logo, Arabic and English
text) and the small lettering on the left building. Feathered rectangles, all
at y ≥ 1310; the script asserts nothing above the card's bottom edge changes.

It also erases the field's painted divider (x 592–593): the suffix border is
the division, and a painted one would leave ticks in the frame border.

The mascot's hoodie emblem (x ≈ 12–105) is not restored: it falls in the phone
side-crop, where only a clipped sliver would show.

## What the plate provides vs. what is HTML

**Plate (static, `aria-hidden`, `alt=""`):** mascot, AI character, AU vs AI
wordmark, sky, campus, palms, reflections, the glass card, and the *empty*
frames for the stepper rings, email field (with divider), button and info box.

**Real HTML:** tagline, `AuthStepper`, headline, supporting copy, the email
`<form>` (label, input, domain suffix, submit button), info rows, hint/error
slot, privacy line, plus a visually hidden "AU vs AI" for screen readers.

## Registration system

Everything is positioned in artwork pixels. `--u` = one plate pixel in CSS
pixels; each overlay uses `calc(var(--u) * N)` with N measured from the plate:

| Frame | Plate px |
|---|---|
| Card | x 125–816, y 509–1274 |
| Stepper rings | centres x 303 / 415 / 528 / 640, y 403, ⌀ 41 |
| Email field | x 160–781, y 709–783 (divider drawn by HTML, ≈ x 571 at 390px) |
| Send Code | x 160–782, y 811–899 |
| Info box | x 159–782, y 924–1174, divider y 1049 |

Stage width on phones is `min(max(1.218 × 100vw, 100svh × 941/1670), max(100svh × 941/1670, 480px))`:

- 360 × 800, 390 × 844, 430 × 932: stage height equals the viewport exactly;
  ~9–10% of the plate is cropped off each side (outer edge of the headphones,
  back of the AI helmet). Both faces, the wordmark and the campus stay whole.
- Short viewports (browser toolbars showing, e.g. 390 × 664): the card stays
  above the fold and the campus scrolls.
- ≥ 768px wide: the whole plate fitted to the window height.
- `svh`, not `dvh`, so collapsing toolbars never rescale the page mid-scroll.

## Behaviour preserved

- Same `sendCode()` in `PlayFlow`: synchronous `sending` ref guard, `busy`,
  `finally` reset, `postJson` (never throws), OTP cooldown, `ErrorBanner`
  semantics (message + reference code, `role="alert"`).
- Enter / keyboard Send / button all arrive as one `<form>` submit → the same
  guarded send. Verified: 11 × Enter + 5 × click while busy → 1 request.
- Transition to `otp` unchanged; OTP screen, resend and verify receive the full
  composed address.
- No change to Supabase, auth routes, OTP generation, attempt rules, scoring or
  schema.

## Email normalization (`src/lib/client/email.ts`)

- `toEmailLocalPart(raw)` runs on every change: trims, and strips any trailing
  `@ajmanuni.ac.ae` (case-insensitive, repeated), so a paste or autofill of
  `student@ajmanuni.ac.ae` shows `student`.
- Other domains are **never** rewritten (`student@gmail.com` stays as typed and
  is flagged) — rewriting would send a code to somebody else's inbox.
- `composeAuEmail(local)` returns `local@ajmanuni.ac.ae` only if it passes the
  existing `isAuEmail` pattern and the server's 120-character limit, else
  `null`. It is idempotent and cannot produce a doubled domain.
- Tests: `tests/email-local-part.test.ts` (15), including a check that every
  composed address also passes the server-side `auEmailSchema`.

## Intentional differences from the mockup

1. **Domain.** Mockup shows `@ajman.ac.ae`; production uses `@ajmanuni.ac.ae`.
   The suffix is sized to its text plus `max(11px, 24u)` padding each side, so
   it never truncates on any platform font; the divider sits ~22u left of the
   mockup's and the input keeps 158 / 170 / 188px at 360 / 390 / 430.
2. **Placeholder.** Mockup `your.name@ajman.ac.ae` (a full address inside the
   local-part box); production `202312345`, the existing student-ID hint.
3. **Text sizes.** Literal scaling gives ~8–10px text. Floors: body 12px,
   labels 10px, privacy 11px, input 16px (below 16px iOS zooms on focus).
4. **Typography.** Installed system faces only (§35: no webfont download):
   condensed headline via Avenir Next Condensed / Roboto Condensed / Bahnschrift.
   Glyph shapes differ from the mockup's display face per platform.
5. **Privacy line.** Mockup: "Your information is secure and will only be used
   for this event." Production keeps the app's existing, test-backed promise:
   "Your email stays private and never appears on the leaderboard."
6. **Send Code is always tappable.** The old screen disabled it until the email
   was valid; the mockup shows it lit. An invalid or empty submit makes no
   request, focuses the field and explains what's wrong.
7. **Hint / error placement.** The painted frames leave no room between
   controls, so messages sit over the info box. A typing problem (amber) is a
   compact callout over the first row only, which it restates; "One official
   attempt" stays visible. A send failure (red, with reference code) is the
   heavier treatment and covers the whole box.
8. **Junk-folder tip** removed from this screen; the OTP screen still carries
   the full "Code hasn't arrived?" instructions.

## Accessibility

- `<label for>` plus `aria-labelledby` → "Ajman University email, the part
  before @ajmanuni.ac.ae"; `aria-invalid` and `aria-describedby` on problems.
- Persistent `aria-live="polite"` slot for hints; failures use `role="alert"`.
- Focus: whole field frame glows on `:focus-within`; button has a 2px outline.
- Touch: painted field and button are 35–49px tall; invisible hit areas extend
  both to 56px (§36) without overlapping.
- `AuthStepper` is an `<ol>` with `aria-current="step"`.
- Global `prefers-reduced-motion` rule collapses the entrance animation.

## Performance

Static plate only: no video, WebGL, particles or animated blur. One 420ms
opacity/transform entrance on the HTML. `/play` SSR emits
`<link rel="preload" as="image" fetchpriority="high">` for the plate while the
session check runs.
