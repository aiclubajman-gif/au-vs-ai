import { PlayFlow } from '@/components/game/PlayFlow';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { College } from '@/types';

export const dynamic = 'force-dynamic';

const FALLBACK_TIMINGS = {
  round1MsPerImage: 5000,
  round2DrawMs: 12000,
  round3Ms: 8000,
};

export default async function PlayPage() {
  let colleges: College[] = [];
  let timings = FALLBACK_TIMINGS;

  try {
    const supabase = createAdminSupabase();

    const [collegeRes, settingsRes] = await Promise.all([
      supabase.from('colleges').select('id, name').eq('active', true).order('sort_order'),
      supabase
        .from('event_settings')
        .select('round1_ms_per_image, round2_draw_ms, round3_ms')
        .eq('id', 1)
        .single(),
    ]);

    colleges = collegeRes.data ?? [];
    if (settingsRes.data) {
      timings = {
        round1MsPerImage: settingsRes.data.round1_ms_per_image,
        round2DrawMs: settingsRes.data.round2_draw_ms,
        round3Ms: settingsRes.data.round3_ms,
      };
    }
  } catch {
    // Sign-in must still work if config fetch fails; defaults cover it.
  }

  return <PlayFlow colleges={colleges} timings={timings} />;
}
