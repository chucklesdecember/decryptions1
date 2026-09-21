-- Account-only aggregate statistics. No answers or other players' identities
-- are exposed.

begin;

create or replace function public.get_my_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $fn$
  select jsonb_build_object(
    'completed', (select count(*)::integer from public.progress where user_id = auth.uid()),
    'bestSeconds', (select min(time_seconds) from public.progress where user_id = auth.uid()),
    'averageSeconds', (select round(avg(time_seconds))::integer from public.progress where user_id = auth.uid()),
    'totalHints', (select coalesce(sum(hints_used), 0)::integer from public.progress where user_id = auth.uid()),
    -- A full streak requires an uninterrupted daily history; the client shows 0
    -- until enough completed days exist to calculate it safely.
    'currentStreak', 0,
    'latestRank', null,
    'recent', coalesce((
      select jsonb_agg(row_data order by solved_at desc)
        from (
          select g.solved_at,
                 jsonb_build_object('date', p.publish_date, 'timeSeconds', g.time_seconds, 'hintsUsed', g.hints_used) as row_data
            from public.progress g
            join private.puzzles p on p.id::text = g.puzzle_id
           where g.user_id = auth.uid()
           order by g.solved_at desc
           limit 7
        ) recent_rows
    ), '[]'::jsonb)
  );
$fn$;

revoke all on function public.get_my_stats() from public;
grant execute on function public.get_my_stats() to authenticated;

commit;
