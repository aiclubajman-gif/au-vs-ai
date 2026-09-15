import { PlayFlow } from '@/components/game/PlayFlow';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { College } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Game timing is deliberately NOT read here. start_attempt() snapshots it onto
 * the attempt, and PlayFlow plays from that snapshot, so a resumed game keeps
 * the timing it began with and there is no second source to fall back on.
 */
export default async function PlayPage() {
  let colleges: College[] = [];

  try {
    const supabase = createAdminSupabase();
    const { data } = await supabase
      .from('colleges')
      .select('id, name')
      .eq('active', true)
      .order('sort_order');
    colleges = data ?? [];
  } catch {
    // Sign-in must still work if the list fails; college is optional.
  }

  return <PlayFlow colleges={colleges} />;
}
