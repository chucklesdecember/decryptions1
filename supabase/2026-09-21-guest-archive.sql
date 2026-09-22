-- Guests can play the daily puzzle and receive an automatic leaderboard entry.
-- A confirmed, non-anonymous account is required for past puzzles.
begin;

create or replace function private.require_puzzle_access(p_user uuid, p_puzzle uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_date date; v_is_anonymous boolean; v_daily uuid;
begin
  select publish_date into v_date from private.puzzles where id = p_puzzle;
  if v_date is null then
    raise exception 'Puzzle unavailable' using errcode = 'P0002';
  end if;
  select id into v_daily from private.puzzles
    where publish_date <= (clock_timestamp() at time zone 'America/New_York')::date
    order by publish_date desc limit 1;
  v_is_anonymous := coalesce((auth.jwt()->>'is_anonymous')::boolean, true);
  if p_puzzle is distinct from v_daily and v_is_anonymous then
    raise exception 'Account required for archive' using errcode = 'P0003';
  end if;
end $$;

create or replace function private.guard_guest_archive_attempt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_puzzle_access(auth.uid(), new.puzzle_id);
  return new;
end $$;

drop trigger if exists guard_guest_archive_attempt on private.attempts;
create trigger guard_guest_archive_attempt
  before insert or update on private.attempts
  for each row execute function private.guard_guest_archive_attempt();

create or replace function public.start_puzzle(p_puzzle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); begin
  if v_user is null then raise exception 'Sign in to play' using errcode = '42501'; end if;
  if not exists (select 1 from private.puzzles where id = p_puzzle_id
      and publish_date <= (clock_timestamp() at time zone 'America/New_York')::date) then
    raise exception 'Puzzle unavailable' using errcode = 'P0002';
  end if;
  perform private.require_puzzle_access(v_user, p_puzzle_id);
  if not exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text) then
    insert into private.attempts(user_id, puzzle_id) values (v_user, p_puzzle_id)
      on conflict do nothing;
  end if;
  perform 1 from private.attempts where user_id = v_user and puzzle_id = p_puzzle_id for update;
  return private.game_state(v_user, p_puzzle_id);
end $$;

revoke all on function private.require_puzzle_access(uuid, uuid),
  private.guard_guest_archive_attempt() from public, anon, authenticated;
revoke all on function public.start_puzzle(uuid) from public, anon, authenticated;
grant execute on function public.start_puzzle(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
