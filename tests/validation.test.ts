import { describe, it, expect } from 'vitest';
import {
  isAuEmail,
  normalizeEmail,
  extractStudentId,
  maskStudentId,
  auEmailSchema,
  nameSchema,
  otpSchema,
  registrationSchema,
  round1SubmitSchema,
} from '@/lib/validation';

describe('AU email restriction (§3)', () => {
  it('accepts a valid AU student email on either AU domain', () => {
    expect(isAuEmail('202310421@ajmanuni.ac.ae')).toBe(true);
    expect(isAuEmail('202310421@ajman.ac.ae')).toBe(true);
  });

  it('accepts staff-style AU addresses', () => {
    expect(isAuEmail('a.hassan@ajmanuni.ac.ae')).toBe(true);
    expect(isAuEmail('a.hassan@ajman.ac.ae')).toBe(true);
  });

  it('normalizes case and whitespace before checking', () => {
    expect(isAuEmail('  202310421@AJMANUNI.AC.AE  ')).toBe(true);
    expect(isAuEmail('  202310421@AJMAN.AC.AE  ')).toBe(true);
    expect(normalizeEmail('  A.B@Ajmanuni.AC.ae ')).toBe('a.b@ajmanuni.ac.ae');
  });

  it('rejects external domains', () => {
    expect(isAuEmail('student@gmail.com')).toBe(false);
    expect(isAuEmail('student@outlook.com')).toBe(false);
    expect(isAuEmail('student@ajmanuni.com')).toBe(false);
    expect(isAuEmail('student@ajman.ae')).toBe(false);
  });

  it('rejects lookalike domains that merely contain an AU domain', () => {
    expect(isAuEmail('a@ajmanuni.ac.ae.evil.com')).toBe(false);
    expect(isAuEmail('a@notajmanuni.ac.ae')).toBe(false);
    expect(isAuEmail('a@sub.ajmanuni.ac.ae')).toBe(false);
    expect(isAuEmail('a@ajman.ac.ae.evil.com')).toBe(false);
    expect(isAuEmail('a@notajman.ac.ae')).toBe(false);
    expect(isAuEmail('a@sub.ajman.ac.ae')).toBe(false);
  });

  it('rejects malformed addresses', () => {
    expect(isAuEmail('')).toBe(false);
    expect(isAuEmail('@ajmanuni.ac.ae')).toBe(false);
    expect(isAuEmail('no-at-sign')).toBe(false);
    expect(isAuEmail('two@@ajmanuni.ac.ae')).toBe(false);
    expect(isAuEmail('a b@ajmanuni.ac.ae')).toBe(false);
  });

  it('the zod schema agrees with the helper', () => {
    expect(auEmailSchema.safeParse('202310421@ajmanuni.ac.ae').success).toBe(true);
    expect(auEmailSchema.safeParse('202310421@ajman.ac.ae').success).toBe(true);
    expect(auEmailSchema.safeParse('x@gmail.com').success).toBe(false);
  });
});

describe('Student ID handling (§5)', () => {
  it('extracts the ID from the email local part', () => {
    expect(extractStudentId('202310421@ajmanuni.ac.ae')).toBe('202310421');
  });

  it('masks to the last four characters only', () => {
    expect(maskStudentId('202310421')).toBe('0421');
  });

  it('never returns the full ID when masking a long one', () => {
    const full = '202310421';
    expect(maskStudentId(full).length).toBe(4);
    expect(maskStudentId(full)).not.toBe(full);
  });
});

describe('Name validation (§4)', () => {
  it('accepts ordinary names', () => {
    expect(nameSchema.safeParse('Ahmed Khalid').success).toBe(true);
    expect(nameSchema.safeParse("Sara O'Brien").success).toBe(true);
    expect(nameSchema.safeParse('Ali Al-Mansoori').success).toBe(true);
  });

  it('accepts Arabic script', () => {
    expect(nameSchema.safeParse('أحمد خالد').success).toBe(true);
  });

  it('rejects an email pasted as a name', () => {
    expect(nameSchema.safeParse('202310421@ajmanuni.ac.ae').success).toBe(false);
  });

  it('rejects impersonation of staff', () => {
    expect(nameSchema.safeParse('Admin').success).toBe(false);
    expect(nameSchema.safeParse('AIDA').success).toBe(false);
    expect(nameSchema.safeParse('admin user').success).toBe(false);
  });

  it('rejects too short, too long and numeric names', () => {
    expect(nameSchema.safeParse('A').success).toBe(false);
    expect(nameSchema.safeParse('x'.repeat(61)).success).toBe(false);
    expect(nameSchema.safeParse('12345').success).toBe(false);
  });
});

describe('OTP validation', () => {
  it('accepts exactly six digits', () => {
    expect(otpSchema.safeParse('123456').success).toBe(true);
  });

  it('rejects anything else', () => {
    expect(otpSchema.safeParse('12345').success).toBe(false);
    expect(otpSchema.safeParse('1234567').success).toBe(false);
    expect(otpSchema.safeParse('12345a').success).toBe(false);
  });
});

describe('Round 1 submission schema', () => {
  const valid = {
    attemptId: '3f9c1b2a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
    slot: 2,
    selectedAnswer: 'real' as const,
    responseTimeMs: 4200,
    idempotencyKey: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  };

  it('accepts a well-formed submission', () => {
    expect(round1SubmitSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts all eight slots', () => {
    for (const slot of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(round1SubmitSchema.safeParse({ ...valid, slot }).success).toBe(true);
    }
  });

  it('rejects an out-of-range slot', () => {
    expect(round1SubmitSchema.safeParse({ ...valid, slot: 9 }).success).toBe(false);
    expect(round1SubmitSchema.safeParse({ ...valid, slot: 0 }).success).toBe(false);
    expect(round1SubmitSchema.safeParse({ ...valid, slot: 2.5 }).success).toBe(false);
  });

  it('rejects an invented answer value', () => {
    expect(round1SubmitSchema.safeParse({ ...valid, selectedAnswer: 'maybe' }).success).toBe(false);
  });

  it('rejects a negative response time', () => {
    expect(round1SubmitSchema.safeParse({ ...valid, responseTimeMs: -1 }).success).toBe(false);
  });

  it('requires an idempotency key so retries cannot double-submit', () => {
    const { idempotencyKey: _omit, ...withoutKey } = valid;
    expect(round1SubmitSchema.safeParse(withoutKey).success).toBe(false);
  });
});

describe('Club registration consent (§27)', () => {
  const base = {
    fullName: 'Ahmed Khalid',
    contactEmail: 'ahmed@example.com',
    interests: ['Learn AI' as const],
    consentRaffle: true,
  };

  it('accepts registration when consent is explicitly given', () => {
    expect(registrationSchema.safeParse({ ...base, consentComms: true }).success).toBe(true);
  });

  it('REJECTS registration when consent is false', () => {
    expect(registrationSchema.safeParse({ ...base, consentComms: false }).success).toBe(false);
  });

  it('REJECTS registration when consent is missing entirely', () => {
    expect(registrationSchema.safeParse(base).success).toBe(false);
  });
});
