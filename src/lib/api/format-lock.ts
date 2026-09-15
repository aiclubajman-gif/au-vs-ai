import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether the Round 1 preset is locked, for display in /admin.
 *
 * The database decides (guard_round1_format_change() in 0015); this asks the
 * same question so /admin does not offer a change it will refuse. Locked while
 * any attempt is not a test attempt and has not been reset ('invalidated').
 * In progress, abandoned and completed attempts all count.
 *
 * If the count cannot be read, report locked rather than invite a change the
 * database may refuse.
 */
export async function isRound1FormatLocked(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('is_test', false)
    .neq('status', 'invalidated');

  return Boolean(error) || (count ?? 0) > 0;
}
