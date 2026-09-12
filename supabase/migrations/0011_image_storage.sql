-- ============================================================================
-- AU vs AI — 0011 Round 1 image storage
--
-- Images live in Supabase Storage rather than the repo: a 40-image bank would
-- bloat git, and swapping an image should not require a redeploy.
--
-- The bucket is PUBLIC READ on purpose. The images themselves are not secret —
-- students are shown them. What must stay secret is the LABEL, which lives in
-- round1_images and has no client read policy at all (§11).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'round1',
  'round1',
  true,
  2097152,  -- 2MB ceiling; anything larger is too slow on venue mobile data
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Anyone may read an image. Only the server (service role) may write one.
drop policy if exists "round1 public read" on storage.objects;
create policy "round1 public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'round1');

-- ---------------------------------------------------------------------------
-- Bank health, for the admin panel and the production checklist.
--
-- start_attempt() needs at least one real and one AI image, so a lopsided bank
-- fails at the worst possible moment — when the first student taps Start.
-- ---------------------------------------------------------------------------
create or replace function public.round1_bank_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total',        count(*),
    'active',       count(*) filter (where active),
    'real',         count(*) filter (where active and label = 'real'),
    'ai',           count(*) filter (where active and label = 'ai_generated'),
    'placeholders', count(*) filter (where active and is_test),
    'missing_explanation',
                    count(*) filter (where active and (explanation is null or explanation = '')),
    'playable',     count(*) filter (where active) >= 4
                    and count(*) filter (where active and label = 'real') >= 1
                    and count(*) filter (where active and label = 'ai_generated') >= 1
  )
  from public.round1_images;
$$;

revoke all on function public.round1_bank_health() from public, anon, authenticated;
grant execute on function public.round1_bank_health() to service_role;

notify pgrst, 'reload schema';
