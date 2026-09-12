/**
 * Client-safe AU email helpers.
 *
 * Kept separate from src/lib/validation so the browser bundle does not pull in
 * Zod or any server-side code. The authoritative checks still run server-side
 * and in the Before User Created hook (§3); this is only for instant feedback
 * as the student types.
 */
export const AU_DOMAIN = 'ajmanuni.ac.ae';
export const AU_DOMAIN_HINT = `202312345@${AU_DOMAIN}`;

const PATTERN = /^[^@\s]+@ajmanuni\.ac\.ae$/;

export function isAuEmail(raw: string): boolean {
  return PATTERN.test(raw.trim().toLowerCase());
}
