/**
 * Time left to answer a timed question.
 *
 * `readyAt` is when the question actually became visible, or null while it is
 * still loading. Until then the full window remains: download time on venue
 * wifi must never be taken out of a student's answering time.
 */
export function answerTimeRemaining(readyAt: number | null, now: number, windowMs: number): number {
  if (readyAt === null) return windowMs;
  return Math.max(0, windowMs - (now - readyAt));
}
