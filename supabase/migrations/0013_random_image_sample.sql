-- ============================================================================
-- AU vs AI — 0013 Random image sampling for admin review
--
-- The review page fetched with a plain LIMIT and no ORDER BY, so Postgres
-- returned rows in physical (insertion) order. The loader inserts every real
-- image before any AI image, so the first 60 rows were all real — the reviewer
-- saw a bank that looked entirely mislabelled when nothing was wrong.
--
-- Shuffling client-side after the fetch does not help: the sample is already
-- biased by the time it arrives. Randomising has to happen in the query.
-- ============================================================================

create or replace function public.random_round1_images(p_limit integer default 60)
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
  order by random()
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

revoke all on function public.random_round1_images(integer) from public, anon, authenticated;
grant execute on function public.random_round1_images(integer) to service_role;

notify pgrst, 'reload schema';
