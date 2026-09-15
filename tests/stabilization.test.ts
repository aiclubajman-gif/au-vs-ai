/**
 * Regression tests for the pre-redesign stabilization fixes.
 *
 * Where the behaviour lives in pure functions it is tested directly. Where it
 * lives in React components, and this project has no DOM test environment,
 * the source is checked instead — the same approach security.test.ts takes —
 * so a later refactor or redesign cannot quietly reintroduce the bug.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRound1Correct, scoreRound1 } from '@/lib/scoring';
import { round1SubmitSchema } from '@/lib/validation';
import { toAssignment, markAnsweredSlots, resumeStep } from '@/lib/api/serialize';
import { answerTimeRemaining } from '@/lib/client/answer-window';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

/** Drops comments so explanatory prose cannot satisfy or trip an assertion. */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ===========================================================================
// 1. Round 1 timeout is not an answer
// ===========================================================================
describe('Round 1 timeout', () => {
  it('is never correct, whatever the image is', () => {
    expect(isRound1Correct(null, 'real')).toBe(false);
    expect(isRound1Correct(null, 'ai_generated')).toBe(false);
  });

  it('adds nothing to the score, whatever the game length', () => {
    for (const assigned of [4, 8, 10]) {
      // Every image timed out: nothing is correct, so Round 1 scores zero.
      const correct = Array.from({ length: assigned }, (_, i) =>
        isRound1Correct(null, i % 2 ? 'real' : 'ai_generated'),
      ).filter(Boolean).length;
      expect(scoreRound1(correct, assigned)).toBe(0);
    }
  });

  it('leaves normal answers unchanged', () => {
    expect(isRound1Correct('real', 'real')).toBe(true);
    expect(isRound1Correct('ai_generated', 'ai_generated')).toBe(true);
    expect(isRound1Correct('real', 'ai_generated')).toBe(false);
    expect(isRound1Correct('ai_generated', 'real')).toBe(false);
  });

  const valid = {
    attemptId: '3f9c1b2a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
    slot: 1,
    responseTimeMs: 8000,
    idempotencyKey: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  };

  it('is accepted by the API as an explicit null selection', () => {
    expect(round1SubmitSchema.safeParse({ ...valid, selectedAnswer: null }).success).toBe(true);
  });

  it('must be explicit: a missing or invented selection is still rejected', () => {
    expect(round1SubmitSchema.safeParse(valid).success).toBe(false);
    expect(round1SubmitSchema.safeParse({ ...valid, selectedAnswer: 'timeout' }).success).toBe(false);
  });

  it('is sent by the client as null, never defaulted to a label', () => {
    const src = code('src/components/game/Round1.tsx');
    expect(src).toMatch(/answer\(null\)/);
    expect(src).not.toMatch(/\?\?\s*'real'/);
    expect(src).not.toMatch(/\?\?\s*'ai_generated'/);
    expect(src).toMatch(/selectedAnswer:\s*choice/);
  });

  it('is recorded by the server without reading the label, and only once', () => {
    const src = code('src/app/api/round1/answer/route.ts');
    expect(src).toMatch(/isRound1Correct\(selectedAnswer/);
    expect(src).toMatch(/if \(selectedAnswer !== null\)/);
    // answered_at, not selected_answer, marks a submitted slot.
    expect(src).toMatch(/slotRow\.answered_at !== null/);
    expect(src).toMatch(/\.is\('answered_at', null\)/);
    expect(src).not.toMatch(/\.not\('selected_answer'/);
  });

  it('does not send a student who timed out back into Round 1 on resume', () => {
    const assignment = toAssignment({
      attempt_id: '3f9c1b2a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
      status: 'in_progress',
      current_round: 2,
      round1: [1, 2, 3, 4].map((slot) => ({
        slot,
        image_id: `img-${slot}`,
        storage_path: `/img/${slot}.webp`,
        // get_attempt_assignment() reports a timed-out slot as unanswered.
        answered: slot !== 4,
      })),
      round2: { class_key: 'cat', display_name: 'CAT', submitted: false },
      round3: { prompt: 'Q', min_value: 0, max_value: 40, step: 1, unit: null, answered: false },
    });

    expect(resumeStep(assignment)).toBe('round1');
    expect(resumeStep(markAnsweredSlots(assignment, [1, 2, 3, 4]))).toBe('round2');
  });

  it('only ever marks slots answered, never unmarks them', () => {
    const assignment = toAssignment({
      round1: [
        { slot: 1, image_id: 'a', storage_path: '/a', answered: true },
        { slot: 2, image_id: 'b', storage_path: '/b', answered: false },
      ],
    });
    const marked = markAnsweredSlots(assignment, []);
    expect(marked.round1.map((s) => s.answered)).toEqual([true, false]);
  });
});

// ===========================================================================
// 2. Interstitials get a fresh timer
// ===========================================================================
describe('Interstitial lifecycle', () => {
  it('gives every interstitial in the play flow its own distinct key', () => {
    const src = code('src/components/game/PlayFlow.tsx');
    // How It Works and Fun Fact are the Round 1 intro and outro.
    const elements = src.match(/<(?:Interstitial|HowItWorks|FunFact)\b[\s\S]*?\/>/g) ?? [];

    expect(elements.length).toBe(5);

    const keys = elements.map((el) => el.match(/\bkey="([^"]+)"/)?.[1]);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(elements.length);
  });
});

// ===========================================================================
// 3. No mock classifier behind an official game
// ===========================================================================
describe('Round 2 classifier use', () => {
  it('Round 2 resolves the real classifier rather than a synchronous fallback', () => {
    const src = code('src/components/game/Round2.tsx');
    expect(src).toMatch(/resolveClassifier\(\)/);
    expect(src).not.toMatch(/getClassifier/);
    expect(src).not.toMatch(/MockClassifier/);
  });

  it('a failed analysis is shown, not submitted as empty predictions', () => {
    const src = code('src/components/game/Round2.tsx');
    expect(src).toMatch(/preds\.length === 0[\s\S]{0,80}analysisFailed/);
  });

  it('the device check still fails a device whose model cannot load', () => {
    const src = code('src/components/game/PlayFlow.tsx');
    const start = src.indexOf('await resolveClassifier()');
    const effect = src.slice(start, src.indexOf("post('/api/attempt/start'"));
    // The attempt is only requested after the classifier resolved and passed.
    expect(effect).toMatch(/selfTest\(\)/);
    expect(effect).toMatch(/if \(passed\)/);
    expect(src).toMatch(/catch \{\s*if \(!cancelled\) setDeviceState\('failed'\)/);
  });
});

// ===========================================================================
// 4. Round submissions are acknowledged, not fire-and-forget
// ===========================================================================
describe('Round submissions', () => {
  const rounds = [
    'src/components/game/Round1.tsx',
    'src/components/game/Round2.tsx',
    'src/components/game/Round3.tsx',
  ];

  it.each(rounds)('%s checks the result instead of swallowing failures', (file) => {
    const src = code(file);
    expect(src).toMatch(/submitWithRetry\(/);
    expect(src).toMatch(/if \(!result\.ok\)/);
    expect(src).not.toMatch(/\.catch\(\(\) => \{\}\)/);
    expect(src).not.toMatch(/fetch\(/);
  });

  it.each(rounds)('%s creates the idempotency key once per submission', (file) => {
    const src = code(file);
    expect(src.match(/crypto\.randomUUID\(\)/g) ?? []).toHaveLength(1);
    // Manual "Try again" resends the stored submission, same key included.
    expect(src).toMatch(/save\(submission\.current\)/);
  });

  /** The part of `src` from `start` up to (not including) `end`. Both must exist. */
  const between = (src: string, start: string, end: string) => {
    const from = src.indexOf(start);
    const to = src.indexOf(end, from);
    expect(from, `marker not found: ${start}`).toBeGreaterThan(-1);
    expect(to, `marker not found: ${end}`).toBeGreaterThan(from);
    return src.slice(from, to);
  };
  const count = (src: string, needle: string) => src.split(needle).length - 1;

  it.each(rounds)('%s builds its submission once and never discards or rebuilds it', (file) => {
    const src = code(file);
    // One assignment of the scored body, and it is never cleared mid-screen
    // (Round 1 clears it only when moving to the next image).
    expect(count(src, 'submission.current = body')).toBe(1);
    // The only two ways to send: the first send, and a resend of the stored body.
    const saves = src.match(/\bsave\([^)]*\)/g) ?? [];
    expect(new Set(saves)).toEqual(new Set(['save(body)', 'save(submission.current)']));
  });

  it('Round 1: the chosen answer stays locked while a save is retried', () => {
    const src = code('src/components/game/Round1.tsx');
    const advance = between(src, 'const advance = useCallback', 'const save = useCallback');
    // Unlocking and clearing the submission happen ONLY when moving on.
    for (const reset of ['answered.current = false', 'setLocked(false)', 'submission.current = null']) {
      expect(count(src, reset)).toBe(1);
      expect(count(advance, reset)).toBe(1);
    }
    // A failed save only records the failure; it does not unlock anything.
    const save = between(src, 'const save = useCallback', 'const answer = useCallback');
    expect(save).toMatch(/if \(!result\.ok\) \{\s*setFailure\(result\);\s*return;\s*\}/);
    // The body records the choice made at lock time.
    expect(between(src, 'const answer = useCallback', 'function handleImageLoad')).toMatch(
      /answered\.current = true;[\s\S]*selectedAnswer: choice/,
    );
  });

  it('Round 2: a retry resends the same drawing, predictions and key', () => {
    const src = code('src/components/game/Round2.tsx');
    expect(src).not.toMatch(/submitted\.current = false/);
    expect(src).not.toMatch(/submission\.current = null/);
    // The drawing is frozen once, at submit.
    expect(count(src, 'finished.current = {')).toBe(1);
    expect(between(src, 'const submit = useCallback', 'function pointFrom')).toContain(
      'finished.current = {',
    );
    // A failed analysis returns BEFORE any submission exists, so the analysis
    // retry can never replace a submission that was already sent.
    const analyse = between(src, 'const analyse = useCallback', 'const submit = useCallback');
    expect(analyse.indexOf("setPhase('analysisFailed')")).toBeGreaterThan(-1);
    expect(analyse.indexOf("setPhase('analysisFailed')")).toBeLessThan(
      analyse.indexOf('submission.current = body'),
    );
  });

  it('Round 3: the locked number and key are what every retry sends', () => {
    const src = code('src/components/game/Round3.tsx');
    expect(src).not.toMatch(/submitted\.current = false/);
    expect(src).not.toMatch(/setLocked\(false\)/);
    // The slider cannot move once locked, including during a failed save.
    expect(src).toMatch(/type="range"[\s\S]*?disabled=\{locked\}/);
    expect(between(src, 'const submit = useCallback', 'const seconds')).toMatch(
      /submitted\.current = true;[\s\S]*setLocked\(true\);[\s\S]*\{ attemptId, guess, idempotencyKey: crypto\.randomUUID\(\) \}/,
    );
  });

  it.each([
    ['src/app/api/round1/answer/route.ts', 'answered_at'],
    ['src/app/api/round2/submit/route.ts', 'submitted_at'],
    ['src/app/api/round3/answer/route.ts', 'answered_at'],
  ])('%s writes only an unsubmitted row and reports a failed write', (file, column) => {
    const src = code(file);
    expect(src).toContain(`.is('${column}', null)`);
    expect(src).toMatch(/if \(writeError\)[\s\S]{0,400}fail\('SERVER_ERROR'/);
  });
});

// ===========================================================================
// 5. Email send cannot hang or double-fire
// ===========================================================================
describe('Email send', () => {
  const src = code('src/components/game/PlayFlow.tsx');

  it('post() never throws on a network failure', () => {
    expect(src).toMatch(/await postJson/);
    expect(src).not.toMatch(/return res\.json\(\)/);
  });

  it('clears busy in finally and guards repeated sends synchronously', () => {
    const body = src.slice(src.indexOf('async function sendCode'), src.indexOf('const verifyCode'));
    expect(body).toMatch(/if \(sending\.current/);
    expect(body).toMatch(/finally \{[\s\S]*setBusy\(false\)/);
  });

  // The email screen is a real <form> since the Page 1 redesign: Enter, the
  // phone keyboard's Send key and the button all arrive as one submit event.
  it('routes the Enter key through the same guarded send', () => {
    expect(src).toMatch(/<EmailStep[\s\S]*?onSubmit=\{sendCode\}[\s\S]*?\/>/);
    expect(src).not.toMatch(/emailValid && sendCode\(\)/);

    const step = code('src/components/auth/EmailStep.tsx');
    expect(step).toMatch(/<form[^>]*onSubmit=\{handleSubmit\}/);
    expect(step).toMatch(/<button\s+type="submit"/);
    // Exactly one path out of the form to the guarded send, and no key or
    // click handler that could fire a second one alongside the submit.
    expect(step.match(/onSubmit\(\)/g)).toHaveLength(1);
    expect(step).not.toMatch(/onKeyDown|onKeyUp|onKeyPress/);
    expect(step).not.toMatch(/onClick=/);
  });
});

// ===========================================================================
// 6. Round 1 image loading does not use answering time
// ===========================================================================
describe('Round 1 answer window', () => {
  it('keeps the full window until the image is visible', () => {
    expect(answerTimeRemaining(null, 0, 8000)).toBe(8000);
    expect(answerTimeRemaining(null, 1_000_000, 8000)).toBe(8000);
  });

  it('counts down from when the image became visible', () => {
    expect(answerTimeRemaining(10_000, 13_000, 8000)).toBe(5000);
    expect(answerTimeRemaining(10_000, 99_000, 8000)).toBe(0);
  });

  it('starts the clock only from the image load handler', () => {
    const src = code('src/components/game/Round1.tsx');
    const starts = src.match(/readyAt\.current = Date\.now\(\)/g) ?? [];
    expect(starts).toHaveLength(1);
    const handler = src.slice(src.indexOf('function handleImageLoad'), src.indexOf('function handleImageError'));
    expect(handler).toMatch(/readyAt\.current = Date\.now\(\)/);
    expect(src).toMatch(/onLoad=\{\(e\) => handleImageLoad\(e\.currentTarget\)\}/);
    expect(src).toMatch(/onError=\{\(e\) => handleImageError\(e\.currentTarget\)\}/);
  });

  it('cannot be answered before the image is ready', () => {
    const src = code('src/components/game/Round1.tsx');
    expect(src).toMatch(/if \(!current \|\| answered\.current \|\| readyAt\.current === null\) return/);
    expect(src.match(/disabled=\{locked \|\| imageState !== 'ready'\}/g) ?? []).toHaveLength(2);
  });
});

// ===========================================================================
// 7. /debug/draw is development only
// ===========================================================================
describe('/debug/draw', () => {
  it('is not found in a production build', () => {
    const src = code('src/app/debug/draw/page.tsx');
    expect(src).toMatch(/if \(process\.env\.NODE_ENV === 'production'\) notFound\(\)/);
    expect(src.indexOf('notFound()')).toBeLessThan(src.indexOf('<DebugDraw'));
  });
});

// ===========================================================================
// 8. The 60-second format: one timing source, frozen on the attempt
// ===========================================================================
describe('Game timing source', () => {
  it('/play no longer reads timing or falls back to defaults', () => {
    const src = code('src/app/play/page.tsx');
    expect(src).not.toMatch(/FALLBACK_TIMINGS/);
    expect(src).not.toMatch(/event_settings/);
    expect(src).not.toMatch(/round1_ms_per_image|round2_draw_ms|round3_ms/);
    expect(src).not.toMatch(/timings=/);
  });

  it('PlayFlow takes no timing prop and plays only from assignment.timing', () => {
    const src = code('src/components/game/PlayFlow.tsx');
    expect(src).not.toMatch(/\btimings\b/);
    expect(src).toMatch(/const timing = assignment\?\.timing \?\? null/);
    for (const prop of [
      'round1MsPerImage={timing.round1MsPerImage}',
      'round2DrawMs={timing.round2DrawMs}',
      'round3Ms={timing.round3Ms}',
      'msPerImage={timing.round1MsPerImage}',
      'drawMs={timing.round2DrawMs}',
      'durationMs={timing.round3Ms}',
    ]) {
      expect(src).toContain(prop);
    }
  });

  it('PlayFlow refuses to enter any round unless the frozen timing makes 60 seconds', () => {
    const src = code('src/components/game/PlayFlow.tsx');
    const start = src.indexOf("post('/api/attempt/start'");
    const guard = src.indexOf('isSixtySecondGame(data.round1.length, data.timing)');
    const landing = src.indexOf('setStep(landing');
    expect(guard).toBeGreaterThan(start);
    expect(guard).toBeLessThan(landing);
    // Refused games go to the blocked screen, and the assignment is only kept
    // for play after the check passes.
    const refusal = src.slice(guard, landing);
    expect(refusal).toMatch(/setStep\('blocked'\);\s*return;\s*\}\s*setAssignment\(data\)/);
    // Every step that runs a timer requires the timing to be present.
    for (const step of ['intro1', 'round1', 'intro2', 'round2', 'intro3', 'round3']) {
      expect(src).toMatch(new RegExp(`step === '${step}'[^)]*&& timing\\)`));
    }
  });

  it.each([
    'src/components/game/Round1.tsx',
    'src/components/game/Round2.tsx',
    'src/components/game/Round3.tsx',
    'src/components/game/HowItWorks.tsx',
    'src/components/game/Interstitial.tsx',
  ])('%s hardcodes no game timer value', (file) => {
    expect(code(file)).not.toMatch(/\b(?:4_?000|5_?000|8_?000|12_?000|20_?000|40_?000|60_?000)\b/);
  });

  it('How It Works derives every figure from the assignment and its timing', () => {
    const src = code('src/components/game/HowItWorks.tsx');
    expect(src).toMatch(/const round1 = round1Images \* perImage/);
    expect(src).toMatch(/round2DrawMs \/ 1000/);
    expect(src).toMatch(/round3Ms \/ 1000/);
    expect(src).toMatch(/\{round1 \+ round2 \+ round3\}/);
  });

  it('the Round 1 answer route derives completion from the assigned rows, not a constant', () => {
    const src = code('src/app/api/round1/answer/route.ts');
    expect(src).not.toMatch(/ROUND1_SLOTS|scoreRound1Slot|points/);
    expect(src).toMatch(/const roundComplete = assigned > 0 && answered >= assigned/);
  });

  it('the Round 2 route scores the speed bonus on the attempt’s frozen draw time', () => {
    const src = code('src/app/api/round2/submit/route.ts');
    expect(src).toMatch(/guard\.attempt\.round2_draw_ms/);
    expect(src).toMatch(/drawTimeMs: drawTimeLimitMs/);
    expect(src).not.toMatch(/settings\.round2DrawMs/);
  });
});

// ===========================================================================
// 10. Fairness guarantees the stabilization must not weaken
// ===========================================================================
describe('Fairness after stabilization', () => {
  it('Round 1 still shows only a neutral lock', () => {
    const src = code('src/components/game/Round1.tsx');
    expect(src).toContain('Answer locked');
    expect(src).not.toMatch(/\bcorrect\b/i);
    expect(src).not.toMatch(/roundComplete|result\.data/);
  });

  it('Round 3 still shows no answer, error or points', () => {
    const src = code('src/components/game/Round3.tsx');
    expect(src).not.toMatch(/correct|abs_error|absError|points|result\.data/i);
  });

  it('Round 2 only predicts after the drawing is submitted', () => {
    const src = code('src/components/game/Round2.tsx');
    const predictAt = src.indexOf('.predict(');
    expect(src.match(/\.predict\(/g) ?? []).toHaveLength(1);
    // The only prediction call is inside analyse(), which only submit() and
    // the analysis retry button reach.
    expect(predictAt).toBeGreaterThan(src.indexOf('const analyse = useCallback'));
    expect(predictAt).toBeLessThan(src.indexOf('const submit = useCallback'));
  });
});
