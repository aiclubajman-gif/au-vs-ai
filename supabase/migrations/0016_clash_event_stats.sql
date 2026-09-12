-- ============================================================================
-- AU vs AI — 0016 Clash Event Stats View Update
-- Adds aggregated human vs AI totals for the live booth ClashBar
-- ============================================================================

create or replace view public.event_stats_public as
select
  count(*) filter (where a.status = 'completed')                      as total_players,
  count(*) filter (where a.status = 'completed' and a.human_win)      as human_wins,
  count(*) filter (where a.status = 'completed' and not a.human_win)  as ai_wins,
  coalesce(sum(a.total_score) filter (where a.status = 'completed'), 0) as human_total_score,
  coalesce(max(a.total_score) filter (where a.status = 'completed'), 0) as top_score,
  coalesce(round(avg(a.total_score) filter (where a.status = 'completed')), 0) as average_score,
  count(*) filter (
    where a.status = 'in_progress' and a.started_at > now() - interval '5 minutes'
  ) as playing_now
from public.attempts a
where not a.is_test;

grant select on public.event_stats_public to anon, authenticated;
