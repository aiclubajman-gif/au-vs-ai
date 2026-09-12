import { describe, it, expect } from 'vitest';
import { toAssignment, toResult, resumeStep } from '@/lib/api/serialize';

/**
 * Payloads copied from what Postgres actually returns. If a migration ever
 * renames a field, these fail loudly instead of the app silently restarting
 * students at Round 1.
 */
const RAW_ASSIGNMENT = {
  attempt_id: '3f9c1b2a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
  status: 'in_progress',
  current_round: 3,
  started_at: '2026-09-22T09:14:00.000Z',
  resumed: true,
  round1: [
    { slot: 1, image_id: 'a1', storage_path: '/img/01.webp', answered: true },
    { slot: 2, image_id: 'a2', storage_path: '/img/02.webp', answered: true },
    { slot: 3, image_id: 'a3', storage_path: '/img/03.webp', answered: true },
  ],
  round2: { class_key: 'bicycle', display_name: 'BICYCLE', submitted: true },
  round3: {
    prompt: 'The AIDA board has 12 members. How many subscriptions?',
    min_value: 0,
    max_value: 40,
    step: 1,
    unit: 'subscriptions',
    answered: false,
  },
};

describe('Assignment mapping', () => {
  const a = toAssignment(RAW_ASSIGNMENT);

  it('reads current_round into currentRound', () => {
    expect(a.currentRound).toBe(3);
  });

  it('reads storage_path into storagePath so images actually render', () => {
    expect(a.round1[0].storagePath).toBe('/img/01.webp');
    expect(a.round1.every((s) => s.storagePath.length > 0)).toBe(true);
  });

  it('maps the Round 2 class key the model needs', () => {
    expect(a.round2.classKey).toBe('bicycle');
    expect(a.round2.displayName).toBe('BICYCLE');
  });

  it('maps Round 3 slider bounds as numbers', () => {
    expect(a.round3.minValue).toBe(0);
    expect(a.round3.maxValue).toBe(40);
    expect(typeof a.round3.maxValue).toBe('number');
  });

  it('coerces numeric strings, which Postgres sends for numeric columns', () => {
    const a2 = toAssignment({
      ...RAW_ASSIGNMENT,
      round3: { ...RAW_ASSIGNMENT.round3, min_value: '0', max_value: '40', step: '1' },
    });
    expect(a2.round3.maxValue).toBe(40);
    expect(typeof a2.round3.maxValue).toBe('number');
  });

  it('never produces NaN or undefined from a malformed payload', () => {
    const empty = toAssignment({});
    expect(empty.currentRound).toBe(1);
    expect(Number.isNaN(empty.round3.maxValue)).toBe(false);
    expect(empty.round1).toEqual([]);
  });

  it('survives null without throwing', () => {
    expect(() => toAssignment(null)).not.toThrow();
  });
});

describe('Result mapping', () => {
  it('maps every result field', () => {
    const r = toResult({
      attempt_id: 'x',
      total_score: 842,
      human_win: true,
      rank: 12,
      percentile_beaten: 81,
      total_players: 344,
    });
    expect(r.totalScore).toBe(842);
    expect(r.humanWin).toBe(true);
    expect(r.rank).toBe(12);
    expect(r.percentileBeaten).toBe(81);
  });

  it('defaults rank to 1 rather than 0 for the very first player', () => {
    expect(toResult({}).rank).toBe(1);
  });
});

describe('Resume placement', () => {
  it('sends a fresh attempt to Round 1', () => {
    const a = toAssignment({
      ...RAW_ASSIGNMENT,
      current_round: 1,
      round1: RAW_ASSIGNMENT.round1.map((s) => ({ ...s, answered: false })),
      round2: { ...RAW_ASSIGNMENT.round2, submitted: false },
    });
    expect(resumeStep(a)).toBe('round1');
  });

  it('does NOT replay Round 1 after a refresh', () => {
    const a = toAssignment({
      ...RAW_ASSIGNMENT,
      round2: { ...RAW_ASSIGNMENT.round2, submitted: false },
    });
    expect(resumeStep(a)).toBe('round2');
  });

  it('sends a student who finished Rounds 1 and 2 to Round 3', () => {
    expect(resumeStep(toAssignment(RAW_ASSIGNMENT))).toBe('round3');
  });

  it('sends a fully answered attempt straight to submission', () => {
    const a = toAssignment({
      ...RAW_ASSIGNMENT,
      round3: { ...RAW_ASSIGNMENT.round3, answered: true },
    });
    expect(resumeStep(a)).toBe('submitting');
  });

  it('trusts per-round flags over a stale current_round pointer', () => {
    // Connection dropped after the last Round 1 answer but before the pointer
    // advanced. The student must move on, not answer them again.
    const a = toAssignment({ ...RAW_ASSIGNMENT, current_round: 1 });
    expect(resumeStep(a)).toBe('round3');
  });

  it('never returns a completed student to a round', () => {
    const a = toAssignment({ ...RAW_ASSIGNMENT, status: 'completed' });
    expect(resumeStep(a)).toBe('submitting');
  });
});
