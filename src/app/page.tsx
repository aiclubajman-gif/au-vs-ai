import { PlayFlow } from '@/components/game/PlayFlow';
import { createAdminSupabase } from '@/lib/supabase/server';
import { ROUND1_PRESETS } from '@/lib/timing';
import type { College, ExplainerTiming } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * The QR code's destination, and the whole game.
 *
 * `/` is the player flow itself rather than a landing page: a student scans the
 * code at the booth and is already in it. PlayFlow decides what they see —
 * email, the explainer, their half-finished game, or their result — so there is
 * one state machine, not a landing page guessing at the same thing.
 *
 * GAME TIMING IS NOT READ HERE. start_attempt() snapshots it onto the attempt
 * and PlayFlow plays from that snapshot, so a resumed game keeps the timing it
 * began with. The settings below are only the numbers How It Works prints
 * before an attempt exists.
 */
const FALLBACK_EXPLAINER: ExplainerTiming = {
  round1Images: ROUND1_PRESETS['8x5'].imageCount,
  round1MsPerImage: ROUND1_PRESETS['8x5'].msPerImage,
  round2DrawMs: 12_000,
  round3Ms: 8_000,
};

export default async function PlayPage() {
  let colleges: College[] = [];
  let explainer = FALLBACK_EXPLAINER;

  try {
    const supabase = createAdminSupabase();
    const [{ data: collegeRows }, { data: settings }] = await Promise.all([
      supabase.from('colleges').select('id, name').eq('active', true).order('sort_order'),
      supabase
        .from('event_settings')
        .select('round1_image_count, round1_ms_per_image, round2_draw_ms, round3_ms')
        .eq('id', 1)
        .single(),
    ]);

    colleges = collegeRows ?? [];

    if (settings) {
      explainer = {
        round1Images: settings.round1_image_count ?? FALLBACK_EXPLAINER.round1Images,
        round1MsPerImage: settings.round1_ms_per_image ?? FALLBACK_EXPLAINER.round1MsPerImage,
        round2DrawMs: settings.round2_draw_ms ?? FALLBACK_EXPLAINER.round2DrawMs,
        round3Ms: settings.round3_ms ?? FALLBACK_EXPLAINER.round3Ms,
      };
    }
  } catch {
    // Sign-in must still work if either read fails; college is optional and the
    // explainer falls back to the only format the database will accept.
  }

  return <PlayFlow colleges={colleges} explainer={explainer} />;
}
