import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { ok, fail, messageFor } from '@/lib/api/respond';
import { AVATAR_OPTIONS, computeDisplayName, type Gender } from '@/lib/avatars';
import { z } from 'zod';

const avatarSchema = z.object({
  avatarId: z.string().min(1).max(64),
  gender: z.enum(['Male', 'Female']),
});

const VALID_AVATAR_IDS = new Set([
  ...AVATAR_OPTIONS.Male.map((a) => a.id),
  ...AVATAR_OPTIONS.Female.map((a) => a.id),
]);

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = avatarSchema.safeParse(body);
  if (!parsed.success || !VALID_AVATAR_IDS.has(parsed.data.avatarId)) {
    return fail('VALIDATION', 'Invalid avatar selection', 400);
  }

  const admin = createAdminSupabase();

  // Fetch current user details to enrich the event
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, student_id')
    .eq('id', auth.user.id)
    .maybeSingle();

  const displayName = computeDisplayName(profile?.full_name);
  const maskedIdSuffix = profile?.student_id ? profile.student_id.slice(-4) : null;

  // 1. Record avatar selection in app_events
  await admin.from('app_events').insert({
    event: 'avatar_selected',
    user_id: auth.user.id,
    details: {
      avatarId: parsed.data.avatarId,
      gender: parsed.data.gender,
      displayName,
      maskedIdSuffix,
      timestamp: new Date().toISOString(),
    },
  });

  // 2. Best-effort update to profiles table in case avatar column exists
  try {
    await admin
      .from('profiles')
      .update({ avatar: parsed.data.avatarId } as Record<string, unknown>)
      .eq('id', auth.user.id);
  } catch {
    // Column might not exist in database; safely ignored
  }

  return ok({ saved: true, avatarId: parsed.data.avatarId });
}

export async function GET() {
  const admin = createAdminSupabase();

  // Retrieve recent avatar selections
  const { data: events } = await admin
    .from('app_events')
    .select('user_id, details, created_at')
    .eq('event', 'avatar_selected')
    .order('created_at', { ascending: false })
    .limit(200);

  const avatarMap: Record<string, string> = {};

  if (events) {
    for (const ev of events) {
      const d = ev.details as {
        avatarId?: string;
        displayName?: string;
        maskedIdSuffix?: string;
      } | null;

      if (!d?.avatarId) continue;

      if (d.maskedIdSuffix && d.displayName) {
        const fullKey = d.maskedIdSuffix + d.displayName;
        if (!avatarMap[fullKey]) {
          avatarMap[fullKey] = d.avatarId;
        }
      }

      if (d.displayName && !avatarMap[d.displayName]) {
        avatarMap[d.displayName] = d.avatarId;
      }
    }
  }

  return ok({ avatarMap });
}
