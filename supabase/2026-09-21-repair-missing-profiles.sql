-- Repair accounts created while earlier profile triggers were unavailable or
-- incomplete. Every authenticated player must have a private profile before
-- the game backend can start a puzzle.

begin;

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users%rowtype;
  v_username text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create a player profile' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    return;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if not found then
    raise exception 'Account not found' using errcode = '42501';
  end if;

  v_username := left(coalesce(
    nullif(trim(v_user.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(coalesce(v_user.email, ''), '@', 1), ''),
    'player-' || replace(v_user.id::text, '-', '')
  ), 64);
  if char_length(v_username) < 2
     or exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := 'player-' || replace(v_user.id::text, '-', '');
  end if;

  insert into public.profiles (id, username, email, created_at)
  values (v_user.id, v_username, coalesce(v_user.email, ''), v_user.created_at)
  on conflict (id) do nothing;
end;
$$;

-- Backfill every current Auth account that lacks a profile. A per-row function
-- call deliberately handles duplicate historic names without aborting the run.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select u.id
      from auth.users u
      left join public.profiles p on p.id = u.id
     where p.id is null
  loop
    perform set_config('request.jwt.claim.sub', v_id::text, true);
    perform public.ensure_my_profile();
  end loop;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

commit;
