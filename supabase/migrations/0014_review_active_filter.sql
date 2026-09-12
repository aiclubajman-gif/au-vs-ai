-- ============================================================================
-- AU vs AI — 0014 Review sampling respects active status
--
-- random_round1_images() returned every row regardless of `active`, so a
-- deactivated image could reappear in a later review sample. Worse, the 12
-- deactivated placeholders kept surfacing among real content.
--
-- Default is now active-only: the review page shows what students would
-- actually be served. Deactivated images remain reachable on request, since
-- reactivating one has to be possible.
-- ============================================================================

drop function if exists public.random_round1_images(integer);

create or replace function public.random_round1_images(
  p_limit       integer default 60,
  p_active_only boolean default true
)
returns table (
  id            uuid,
  storage_path  text,
  label         image_label,
  active        boolean,
  explanation   text,
  times_shown   integer,
  times_correct integer
)
language sql
security definer
set search_path = public
as $$
  select id, storage_path, label, active, explanation, times_shown, times_correct
  from public.round1_images
  where (not p_active_only) or active
  order by random()
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

revoke all on function public.random_round1_images(integer, boolean)
  from public, anon, authenticated;
grant execute on function public.random_round1_images(integer, boolean)
  to service_role;

notify pgrst, 'reload schema';
