import { requireAdmin } from '@/lib/api/admin-guard';
import { createAdminSupabase } from '@/lib/supabase/server';
import { ImageReview, type ReviewImage } from '@/components/admin/ImageReview';

export const dynamic = 'force-dynamic';

export default async function AdminImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const params = await searchParams;
  const includeInactive = params.all === '1';

  const auth = await requireAdmin();

  if (!auth.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-sm text-[var(--color-muted)]">Not authorised.</p>
      </main>
    );
  }

  const supabase = createAdminSupabase();

  /**
   * Randomised in SQL, not after the fetch.
   *
   * A plain .limit(60) returns rows in insertion order, and the loader inserts
   * every real image before any AI one — so the sample came back 100% real and
   * looked like a labelling disaster. Shuffling client-side cannot fix a sample
   * that is already biased.
   */
  const { data } = await supabase.rpc('random_round1_images', {
    p_limit: 60,
    // Active-only by default, so the review reflects what students are served.
    p_active_only: !includeInactive,
  });

  const images: ReviewImage[] = (data ?? []).map(
    (r: {
      id: string;
      storage_path: string;
      label: 'real' | 'ai_generated';
      active: boolean;
      explanation: string | null;
      times_shown: number;
      times_correct: number;
    }) => ({
      id: r.id,
      storagePath: r.storage_path,
      label: r.label,
      active: r.active,
      explanation: r.explanation,
      timesShown: r.times_shown,
      timesCorrect: r.times_correct,
    }),
  );

  return <ImageReview images={images} includeInactive={includeInactive} />;
}
