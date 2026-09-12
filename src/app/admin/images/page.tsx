import { requireAdmin } from '@/lib/api/admin-guard';
import { createAdminSupabase } from '@/lib/supabase/server';
import { ImageReview, type ReviewImage } from '@/components/admin/ImageReview';

export const dynamic = 'force-dynamic';

export default async function AdminImagesPage() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-sm text-[var(--color-muted)]">Not authorised.</p>
      </main>
    );
  }

  const supabase = createAdminSupabase();

  // Random order, so reviewing a few gives a fair read on the whole bank
  // rather than whichever images happened to upload first.
  const { data } = await supabase
    .from('round1_images')
    .select('id, storage_path, label, active, explanation, times_shown, times_correct')
    .limit(60);

  const images: ReviewImage[] = (data ?? [])
    .map((r) => ({
      id: r.id,
      storagePath: r.storage_path,
      label: r.label,
      active: r.active,
      explanation: r.explanation,
      timesShown: r.times_shown,
      timesCorrect: r.times_correct,
    }))
    .sort(() => Math.random() - 0.5);

  return <ImageReview images={images} />;
}
