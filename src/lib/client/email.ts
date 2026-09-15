/**
 * Client-safe AU email helpers.
 *
 * Kept separate from src/lib/validation so the browser bundle does not pull in
 * Zod or any server-side code. The authoritative checks still run server-side
 * and in the Before User Created hook (§3); this is only for instant feedback
 * as the student types.
 */
export const AU_DOMAIN = 'ajmanuni.ac.ae';
export const AU_USERNAME_HINT = '202312345';
export const AU_DOMAIN_HINT = `${AU_USERNAME_HINT}@${AU_DOMAIN}`;

const PATTERN = /^[^@\s]+@ajmanuni\.ac\.ae$/;

/** Same ceiling as auEmailSchema, so the client never sends what the server refuses. */
const MAX_EMAIL_LENGTH = 120;

const AU_SUFFIX = `@${AU_DOMAIN}`;

export function isAuEmail(raw: string): boolean {
  return PATTERN.test(raw.trim().toLowerCase());
}

/**
 * What belongs in the sign-in box, which shows @ajmanuni.ac.ae as a fixed
 * suffix. A pasted or autofilled full AU address is cut back to the part before
 * the @, so the student never ends up with the domain twice.
 *
 * Any other domain is left exactly as typed. Rewriting student@gmail.com to
 * student@ajmanuni.ac.ae would send a sign-in code to somebody else's inbox.
 */
export function toEmailLocalPart(raw: string): string {
  let value = raw.trim();
  while (value.toLowerCase().endsWith(AU_SUFFIX)) {
    value = value.slice(0, -AU_SUFFIX.length).trim();
  }
  return value;
}

/**
 * The full address the sign-in API receives, or null when the box does not hold
 * a usable AU username. Accepts either the username or a full AU address.
 */
export function composeAuEmail(localPart: string): string | null {
  const email = `${toEmailLocalPart(localPart)}${AU_SUFFIX}`;
  if (email.length > MAX_EMAIL_LENGTH || !isAuEmail(email)) return null;
  return email;
}
