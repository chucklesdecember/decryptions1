-- Account-only aggregate statistics. No answers or other players' identities
-- are exposed.

begin;

create or replace function public.get_my_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
  with mine as (
    select p.publish_date, g.time_seconds, g.hints_used, g.solved_at, g.leaderboard_row_id
      from public.progress g
      join private.puzzles p on p.id::text = g.puzzle_id
     where g.user_id = auth.uid()
  ), streak as (
    select coalesce(min(n), 0)::integer as days
      from generate_series(0, 365) as n
     where not exists (
       select 1 from mine
        where publish_date = (timezone('America/New_York', now())::date - n)
     )
  ), latest as (
    select * from mine order by publish_date desc limit 1
  ), placement as (
    select count(*)::integer as rank
      from public.solves s
      join latest l on s.puzzle_id = (select p.id::text from private.puzzles p where p.publish_date = l.publish_date limit 1)
     where s.verified and s.time_seconds < (select time_seconds from latest)
  )
  select jsonb_build_object(
    'completed', (select count(*)::integer from mine),
    'bestSeconds', (select min(time_seconds) from mine),
    'averageSeconds', (select round(avg(time_seconds))::integer from mine),
    'totalHints', (select coalesce(sum(hints_used), 0)::integer from mine),
    'currentStreak', (select days from streak),
    'latestRank', case when exists(select 1 from latest) then (select rank + 1 from placement) else null end,
    'recent', coalesce((select jsonb_agg(jsonb_build_object('date', publish_date, 'timeSeconds', time_seconds, 'hintsUsed', hints_used) order by solved_at desc) from (select * from mine order by solved_at desc limit 7) recent_rows), '[]'::jsonb)
  );
$$;

revoke all on function public.get_my_stats() from public;
grant execute on function public.get_my_stats() to authenticated;

commit;
