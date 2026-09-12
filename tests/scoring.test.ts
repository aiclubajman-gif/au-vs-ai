import { describe, it, expect } from 'vitest';
import {
  scoreRound1,
  scoreRound1Slot,
  countRound1Correct,
  scoreRound2,
  scoreRound3,
  clampGuessToRange,
  calculateTotal,
  isHumanWin,
  ROUND1_SLOT_POINTS,
  ROUND1_SLOTS,
  ROUND2_BASE_POINTS,
  ROUND2_NEAR_MISS_CAP,
  MAX_ROUND1,
  MAX_ROUND2,
  MAX_ROUND3,
  MAX_TOTAL,
  type Round2Config,
  type Round3Config,
} from '@/lib/scoring';

// ===========================================================================
// ROUND 1
// ===========================================================================
describe('Round 1 scoring', () => {
  it('four slots sum to exactly 500', () => {
    expect(ROUND1_SLOT_POINTS.reduce((a, b) => a + b, 0)).toBe(MAX_ROUND1);
    expect(ROUND1_SLOT_POINTS).toHaveLength(ROUND1_SLOTS);
  });

  it('every slot is worth the same, so slot order cannot disadvantage anyone', () => {
    expect(new Set(ROUND1_SLOT_POINTS).size).toBe(1);
  });

  it('all four correct scores exactly 500', () => {
    const all = [1, 2, 3, 4].map((slot) => ({ slot, correct: true }));
    expect(scoreRound1(all)).toBe(500);
  });

  it('all four wrong scores 0', () => {
    const none = [1, 2, 3, 4].map((slot) => ({ slot, correct: false }));
    expect(scoreRound1(none)).toBe(0);
  });

  it('scores scale evenly with correct answers', () => {
    const build = (n: number) =>
      [1, 2, 3, 4].map((slot) => ({ slot, correct: slot <= n }));
    expect(scoreRound1(build(0))).toBe(0);
    expect(scoreRound1(build(1))).toBe(125);
    expect(scoreRound1(build(2))).toBe(250);
    expect(scoreRound1(build(3))).toBe(375);
    expect(scoreRound1(build(4))).toBe(500);
  });

  it('scores partial answers when an attempt is incomplete', () => {
    expect(scoreRound1([{ slot: 1, correct: true }])).toBe(125);
    expect(scoreRound1([])).toBe(0);
  });

  it('rejects an out-of-range slot', () => {
    expect(() => scoreRound1Slot(0, true)).toThrow(RangeError);
    expect(() => scoreRound1Slot(5, true)).toThrow(RangeError);
    expect(() => scoreRound1Slot(1.5, true)).toThrow(RangeError);
  });

  it('accepts slot 4', () => {
    expect(scoreRound1Slot(4, true)).toBe(125);
  });

  it('rejects duplicate slots so a replayed request cannot double-score', () => {
    expect(() =>
      scoreRound1([
        { slot: 1, correct: true },
        { slot: 1, correct: true },
      ]),
    ).toThrow(/Duplicate/);
  });

  it('counts correct answers for the leaderboard tiebreak', () => {
    expect(countRound1Correct([
      { slot: 1, correct: true },
      { slot: 2, correct: false },
      { slot: 3, correct: true },
      { slot: 4, correct: true },
    ])).toBe(3);
  });
});

// ===========================================================================
// ROUND 2
// ===========================================================================
const r2Config: Round2Config = {
  recognitionThreshold: 0.55,
  speedBonusMax: 40,
  drawTimeMs: 20000,
};

describe('Round 2 scoring', () => {
  it('recognition at the buzzer scores the base points', () => {
    const r = scoreRound2({ targetConfidence: 0.9, drawTimeMs: 20000 }, r2Config);
    expect(r.recognized).toBe(true);
    expect(r.points).toBe(ROUND2_BASE_POINTS);
  });

  it('instant recognition scores the maximum 250', () => {
    const r = scoreRound2({ targetConfidence: 0.99, drawTimeMs: 0 }, r2Config);
    expect(r.points).toBe(MAX_ROUND2);
  });

  it('never exceeds 250 even with absurd inputs', () => {
    const r = scoreRound2({ targetConfidence: 5, drawTimeMs: -1000 }, r2Config);
    expect(r.points).toBeLessThanOrEqual(MAX_ROUND2);
  });

  it('confidence exactly at the threshold counts as recognised', () => {
    const r = scoreRound2({ targetConfidence: 0.55, drawTimeMs: 10000 }, r2Config);
    expect(r.recognized).toBe(true);
  });

  it('a near miss scores partial credit, not zero', () => {
    const r = scoreRound2({ targetConfidence: 0.5, drawTimeMs: 20000 }, r2Config);
    expect(r.recognized).toBe(false);
    expect(r.points).toBeGreaterThan(0);
  });

  it('a near miss can NEVER beat a successful recognition', () => {
    const nearMiss = scoreRound2({ targetConfidence: 0.549, drawTimeMs: 0 }, r2Config);
    const slowestWin = scoreRound2({ targetConfidence: 0.55, drawTimeMs: 20000 }, r2Config);
    expect(nearMiss.points).toBeLessThan(slowestWin.points);
    expect(nearMiss.points).toBeLessThanOrEqual(ROUND2_NEAR_MISS_CAP);
  });

  it('a blank canvas scores zero', () => {
    const r = scoreRound2({ targetConfidence: 0, drawTimeMs: 20000 }, r2Config);
    expect(r.points).toBe(0);
    expect(r.recognized).toBe(false);
  });

  it('scribbling scores less than a genuine near miss', () => {
    const scribble = scoreRound2({ targetConfidence: 0.05, drawTimeMs: 20000 }, r2Config);
    const nearMiss = scoreRound2({ targetConfidence: 0.5, drawTimeMs: 20000 }, r2Config);
    expect(scribble.points).toBeLessThan(nearMiss.points);
  });

  it('speed advantage is bounded by speedBonusMax', () => {
    const fastest = scoreRound2({ targetConfidence: 0.8, drawTimeMs: 0 }, r2Config);
    const slowest = scoreRound2({ targetConfidence: 0.8, drawTimeMs: 20000 }, r2Config);
    expect(fastest.points - slowest.points).toBeLessThanOrEqual(r2Config.speedBonusMax);
  });

  it('handles NaN confidence without crashing', () => {
    const r = scoreRound2({ targetConfidence: NaN, drawTimeMs: 5000 }, r2Config);
    expect(r.points).toBe(0);
  });

  it('rejects a zero threshold rather than dividing by zero', () => {
    expect(() =>
      scoreRound2({ targetConfidence: 0.5, drawTimeMs: 1000 }, { ...r2Config, recognitionThreshold: 0 }),
    ).toThrow(RangeError);
  });
});

// ===========================================================================
// ROUND 3
// ===========================================================================
const r3Config: Round3Config = {
  correctAnswer: 17,
  tolerance: 20,
  toleranceExponent: 1.5,
};

describe('Round 3 scoring', () => {
  it('an exact guess scores the full 250', () => {
    expect(scoreRound3(17, r3Config)).toBe(MAX_ROUND3);
  });

  it('closer guesses always score higher (monotonic)', () => {
    const scores = [17, 15, 12, 8, 3, 0].map((g) => scoreRound3(g, r3Config));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it('is symmetric around the correct answer', () => {
    expect(scoreRound3(15, r3Config)).toBe(scoreRound3(19, r3Config));
    expect(scoreRound3(12, r3Config)).toBe(scoreRound3(22, r3Config));
  });

  it('a near guess still scores well', () => {
    expect(scoreRound3(15, r3Config)).toBeGreaterThan(200);
  });

  // The point of decoupling tolerance from the slider range: a bad guess must
  // be able to reach zero. Under the old range-normalised formula the worst
  // in-range guess still scored 69.
  it('a guess exactly `tolerance` away scores ZERO', () => {
    expect(scoreRound3(17 + 20, r3Config)).toBe(0);
    expect(scoreRound3(17 - 20, r3Config)).toBe(0);
  });

  it('a guess beyond tolerance scores ZERO, never negative', () => {
    expect(scoreRound3(200, r3Config)).toBe(0);
    expect(scoreRound3(-200, r3Config)).toBe(0);
  });

  it('the far end of a wide slider can score zero', () => {
    // Slider 0-40, answer 17, tolerance 20. Guessing 40 is 23 away -> zero.
    expect(scoreRound3(40, r3Config)).toBe(0);
  });

  // Widening the slider must NOT change any score. This is the regression the
  // whole refactor exists to prevent.
  it('scoring is independent of the slider range', () => {
    const narrow = clampGuessToRange(25, 0, 40);
    const wide = clampGuessToRange(25, 0, 200);
    expect(scoreRound3(narrow, r3Config)).toBe(scoreRound3(wide, r3Config));
  });

  it('behaves correctly when the answer is ZERO', () => {
    const zeroConfig: Round3Config = { correctAnswer: 0, tolerance: 10, toleranceExponent: 1.5 };
    expect(scoreRound3(0, zeroConfig)).toBe(MAX_ROUND3);
    expect(scoreRound3(1, zeroConfig)).toBeLessThan(MAX_ROUND3);
    expect(scoreRound3(1, zeroConfig)).toBeGreaterThan(0);
    expect(scoreRound3(10, zeroConfig)).toBe(0);
    expect(scoreRound3(50, zeroConfig)).toBe(0);
  });

  it('never exceeds 250 or drops below 0 across a wide sweep', () => {
    for (let g = -100; g <= 200; g++) {
      const s = scoreRound3(g, r3Config);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(MAX_ROUND3);
    }
  });

  it('rejects a non-positive tolerance rather than dividing by zero', () => {
    expect(() => scoreRound3(5, { ...r3Config, tolerance: 0 })).toThrow(RangeError);
    expect(() => scoreRound3(5, { ...r3Config, tolerance: -5 })).toThrow(RangeError);
    expect(() => scoreRound3(5, { ...r3Config, tolerance: Infinity })).toThrow(RangeError);
  });

  it('rejects a non-finite guess', () => {
    expect(() => scoreRound3(NaN, r3Config)).toThrow(RangeError);
    expect(() => scoreRound3(Infinity, r3Config)).toThrow(RangeError);
  });

  it('a higher exponent punishes distance more steeply', () => {
    const gentle = scoreRound3(25, { ...r3Config, toleranceExponent: 1 });
    const steep = scoreRound3(25, { ...r3Config, toleranceExponent: 2.5 });
    expect(steep).toBeLessThan(gentle);
  });

  it('a wider tolerance is more forgiving at the same distance', () => {
    const tight = scoreRound3(25, { ...r3Config, tolerance: 10 });
    const loose = scoreRound3(25, { ...r3Config, tolerance: 40 });
    expect(loose).toBeGreaterThan(tight);
  });

  it('is deterministic across repeated calls', () => {
    expect(scoreRound3(13, r3Config)).toBe(scoreRound3(13, r3Config));
  });
});

describe('Round 3 guess clamping (input validation, not scoring)', () => {
  it('clamps a guess below the slider minimum', () => {
    expect(clampGuessToRange(-500, 0, 40)).toBe(0);
  });

  it('clamps a guess above the slider maximum', () => {
    expect(clampGuessToRange(9999, 0, 40)).toBe(40);
  });

  it('leaves an in-range guess untouched', () => {
    expect(clampGuessToRange(17, 0, 40)).toBe(17);
  });

  it('rejects an invalid range', () => {
    expect(() => clampGuessToRange(5, 40, 0)).toThrow(RangeError);
    expect(() => clampGuessToRange(5, 10, 10)).toThrow(RangeError);
  });

  it('rejects a non-finite guess', () => {
    expect(() => clampGuessToRange(NaN, 0, 40)).toThrow(RangeError);
  });
});

// ===========================================================================
// TOTAL + HUMAN WIN
// ===========================================================================
describe('Total score', () => {
  it('a perfect game is exactly 1000', () => {
    expect(calculateTotal({ round1Score: 500, round2Score: 250, round3Score: 250 })).toBe(MAX_TOTAL);
  });

  it('a zero game is 0', () => {
    expect(calculateTotal({ round1Score: 0, round2Score: 0, round3Score: 0 })).toBe(0);
  });

  it('clamps a tampered round score to its ceiling', () => {
    expect(calculateTotal({ round1Score: 99999, round2Score: 99999, round3Score: 99999 })).toBe(MAX_TOTAL);
  });

  it('clamps negative round scores to zero', () => {
    expect(calculateTotal({ round1Score: -500, round2Score: 250, round3Score: 250 })).toBe(500);
  });

  it('a realistic game totals correctly', () => {
    expect(calculateTotal({ round1Score: 334, round2Score: 232, round3Score: 205 })).toBe(771);
  });
});

describe('Humans vs AI threshold', () => {
  it('a score at the threshold is a human win', () => {
    expect(isHumanWin(600, 600)).toBe(true);
  });

  it('one point below the threshold is an AI win', () => {
    expect(isHumanWin(599, 600)).toBe(false);
  });

  it('a perfect score always wins', () => {
    expect(isHumanWin(1000, 600)).toBe(true);
  });

  it('a zero score never wins', () => {
    expect(isHumanWin(0, 600)).toBe(false);
  });
});
