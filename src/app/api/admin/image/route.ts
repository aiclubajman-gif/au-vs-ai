/**
 * POST /api/admin/image — curate the Round 1 bank (§41 content management).
 *
 * Deactivate rather than delete: start_attempt only selects active images, so
 * deactivating removes an image from play immediately while keeping the record
 * of what past students were shown. Deleting would break the foreign key from
 * attempt_round1 anyway.
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { requireAdmin, logAdminAction } from '@/lib/api/admin-guard';
import { ok, fail, messageFor } from '@/lib/api/respond';
import { z } from 'zod';

const schema = z.object({
  imageId: z.uuid(),
  action: z.enum(['toggle_active', 'set_explanation']),
  explanation: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);

  const { imageId, action, explanation } = parsed.data;
  const admin = createAdminSupabase();

  if (action === 'toggle_active') {
    const { data: current } = await admin
      .from('round1_images')
      .select('active')
      .eq('id', imageId)
      .maybeSingle();

    if (!current) return fail('SERVER_ERROR', 'Image not found.', 404);

    const next = !current.active;

    // Refuse to make the bank unplayable. Deactivating down to three images
    // would break every subsequent game with a confusing error.
    if (!next) {
      const { data: health } = await admin.rpc('round1_bank_health');
      if (health && health.active <= 4) {
        return fail(
          'SERVER_ERROR',
          `Only ${health.active} active images left. A game needs 4. Add more before deactivating.`,
          409,
        );
      }
    }

    await admin.from('round1_images').update({ active: next }).eq('id', imageId);
    await logAdminAction(auth.userId, auth.email, 'image_toggle', 'image', imageId, {
      active: next,
    });
    return ok({ active: next });
  }

  await admin
    .from('round1_images')
    .update({ explanation: explanation ?? null })
    .eq('id', imageId);
  await logAdminAction(auth.userId, auth.email, 'image_explanation', 'image', imageId);

  return ok({ saved: true });
}
