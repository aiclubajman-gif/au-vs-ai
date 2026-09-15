import { describe, it, expect } from 'vitest';
import { toEmailLocalPart, composeAuEmail, isAuEmail } from '@/lib/client/email';
import { auEmailSchema } from '@/lib/validation';

/**
 * The sign-in box shows @ajmanuni.ac.ae as a fixed suffix and the student types
 * only the part before it. These cover what a student actually pastes or what
 * a phone autofills into that box.
 */
describe('toEmailLocalPart — what the sign-in box displays', () => {
  it('leaves a plain username alone', () => {
    expect(toEmailLocalPart('202310421')).toBe('202310421');
    expect(toEmailLocalPart('a.hassan')).toBe('a.hassan');
  });

  it('cuts a pasted full AU address back to the username', () => {
    expect(toEmailLocalPart('student@ajmanuni.ac.ae')).toBe('student');
  });

  it('ignores case and surrounding whitespace on the pasted domain', () => {
    expect(toEmailLocalPart('  Student@AjmanUni.AC.AE  ')).toBe('Student');
    expect(toEmailLocalPart('\tstudent@ajmanuni.ac.ae\n')).toBe('student');
  });

  it('strips a doubled AU domain instead of keeping one copy of it', () => {
    expect(toEmailLocalPart('student@ajmanuni.ac.ae@ajmanuni.ac.ae')).toBe('student');
  });

  it('never rewrites a different domain into an AU address', () => {
    expect(toEmailLocalPart('student@gmail.com')).toBe('student@gmail.com');
    expect(toEmailLocalPart('student@ajman.ac.ae')).toBe('student@ajman.ac.ae');
  });

  it('does not treat lookalike domains as the AU domain', () => {
    expect(toEmailLocalPart('a@notajmanuni.ac.ae')).toBe('a@notajmanuni.ac.ae');
    expect(toEmailLocalPart('a@sub.ajmanuni.ac.ae')).toBe('a@sub.ajmanuni.ac.ae');
    expect(toEmailLocalPart('a@ajmanuni.ac.ae.evil.com')).toBe('a@ajmanuni.ac.ae.evil.com');
  });

  it('reduces a bare domain to an empty box', () => {
    expect(toEmailLocalPart('@ajmanuni.ac.ae')).toBe('');
    expect(toEmailLocalPart('   ')).toBe('');
  });
});

describe('composeAuEmail — what the send-OTP API receives', () => {
  it('appends the AU domain to a username', () => {
    expect(composeAuEmail('202310421')).toBe('202310421@ajmanuni.ac.ae');
    expect(composeAuEmail(' a.hassan ')).toBe('a.hassan@ajmanuni.ac.ae');
  });

  it('never produces the domain twice', () => {
    expect(composeAuEmail('student@ajmanuni.ac.ae')).toBe('student@ajmanuni.ac.ae');
    expect(composeAuEmail('student@ajmanuni.ac.ae@ajmanuni.ac.ae')).toBe(
      'student@ajmanuni.ac.ae',
    );
  });

  it('is stable when fed its own output', () => {
    const once = composeAuEmail('student');
    expect(once).not.toBeNull();
    expect(composeAuEmail(once!)).toBe(once);
  });

  it('rejects an empty box', () => {
    expect(composeAuEmail('')).toBeNull();
    expect(composeAuEmail('   ')).toBeNull();
    expect(composeAuEmail('@ajmanuni.ac.ae')).toBeNull();
  });

  it('rejects other domains rather than guessing', () => {
    expect(composeAuEmail('student@gmail.com')).toBeNull();
    expect(composeAuEmail('student@ajman.ac.ae')).toBeNull();
    expect(composeAuEmail('a@sub.ajmanuni.ac.ae')).toBeNull();
  });

  it('rejects malformed usernames', () => {
    expect(composeAuEmail('two@')).toBeNull();
    expect(composeAuEmail('a b')).toBeNull();
    expect(composeAuEmail('a@@ajmanuni.ac.ae')).toBeNull();
  });

  it('rejects an address longer than the server accepts', () => {
    const tooLong = 'x'.repeat(106); // 106 + 15 = 121 characters
    expect(composeAuEmail(tooLong)).toBeNull();
    expect(composeAuEmail('x'.repeat(105))).not.toBeNull();
  });

  it('only ever returns addresses the server-side schema also accepts', () => {
    const inputs = [
      '202310421',
      'a.hassan',
      'Student@AJMANUNI.AC.AE',
      '  x  ',
      'student@ajmanuni.ac.ae@ajmanuni.ac.ae',
      'x'.repeat(105),
      'student@gmail.com',
      'a b',
      '',
    ];
    for (const input of inputs) {
      const email = composeAuEmail(input);
      if (email === null) continue;
      expect(isAuEmail(email)).toBe(true);
      expect(auEmailSchema.safeParse(email).success).toBe(true);
      expect(email.match(/@/g)).toHaveLength(1);
    }
  });
});
