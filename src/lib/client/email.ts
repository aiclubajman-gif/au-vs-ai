/**
 * Client-safe AU email helpers.
 *
 * Kept separate from src/lib/validation so the browser bundle does not pull in
 * Zod or any server-side code. The authoritative checks still run server-side
 * and in the Before User Created hook (§3); this is only for instant feedback
 * as the student types.
 */
import { AU_EMAIL_DOMAINS } from '@/types';

/** Every AU-issued domain we accept. Defined once, in @/types. */
export const AU_DOMAINS: readonly string[] = AU_EMAIL_DOMAINS;
/** The domain used in placeholders and examples. */
export const AU_DOMAIN = AU_EMAIL_DOMAINS[0];
export const AU_DOMAIN_HINT = `202312345@${AU_DOMAIN}`;
/** '@ajmanuni.ac.ae or @ajman.ac.ae' — for the hint under an email field. */
export const AU_DOMAIN_LIST = AU_DOMAINS.map((d) => `@${d}`).join(' or ');

/** No whitespace and no second '@' in the local part. */
const LOCAL_PART = /^[^@\s]+$/;

/**
 * The domain is compared exactly against the allow-list, never by suffix, so
 * 'sub.ajman.ac.ae' and 'ajman.ac.ae.evil.com' are both rejected.
 */
export function isAuEmail(raw: string): boolean {
  const parts = raw.trim().toLowerCase().split('@');
  return (
    parts.length === 2 && LOCAL_PART.test(parts[0]) && AU_DOMAINS.includes(parts[1])
  );
}
