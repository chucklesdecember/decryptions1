-- Decryptions: accounts, private profiles, progress sync, account-linked leaderboard rows.
-- Run once in the Supabase SQL editor. Repeatable until the backend migration is applied.
--
-- After running this, also follow supabase/README.md (dashboard settings that SQL cannot change).

begin;

-- Never let an older deployment reopen client writes after backend lockdown.
do $$ begin
  if to_regclass('private.attempts') is not null then
    raise exception 'Authoritative backend is installed; do not reapply the older accounts migration';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. profiles: one row per account. email is PRIVATE (owner-only RLS).
--    username is the public leaderboard name.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  email       text not null,
  created_at  timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 2 and 24)
);

comment on table public.profiles is
  'One row per account. email is private (RLS: owner only). username is shown on leaderboards.';

-- Case-insensitive uniqueness: "Alex" and "alex" are the same name.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = auth.uid());
-- No insert/update/delete policies: rows are created by the trigger below.

-- ---------------------------------------------------------------------------
-- 2. Create the profile automatically when an account is created.
--    The app passes the username as sign-up metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'username', '')),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. solves: link leaderboard rows to accounts.
-- ---------------------------------------------------------------------------
alter table public.solves
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- One leaderboard row per account per puzzle (legacy anonymous rows have user_id null).
create unique index if not exists solves_one_per_user_per_puzzle
  on public.solves (puzzle_id, user_id)
  where user_id is not null;

create index if not exists solves_user_id_idx on public.solves (user_id);

-- Server stamps the owner and copies the display name from the profile,
-- so a client can never post under someone else's name.
create or replace function public.solves_set_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to post a time' using errcode = '42501';
  end if;

  select username into v_username
    from public.profiles
   where id = auth.uid();

  if v_username is null then
    raise exception 'No profile found for this account' using errcode = '42501';
  end if;

  new.user_id := auth.uid();
  new.display_name := v_username;
  return new;
end;
$$;

drop trigger if exists solves_set_owner_trg on public.solves;
create trigger solves_set_owner_trg
  before insert on public.solves
  for each row execute function public.solves_set_owner();

alter table public.solves enable row level security;

-- Anyone can read leaderboards.
drop policy if exists "solves: public read" on public.solves;
create policy "solves: public read" on public.solves
  for select to anon, authenticated
  using (true);

-- Only signed-in players can post, and only as themselves.
drop policy if exists "solves: insert own" on public.solves;
create policy "solves: insert own" on public.solves
  for insert to authenticated
  with check (user_id = auth.uid());

-- NOTE: any pre-existing INSERT policy that allowed anon/public inserts must be
-- deleted by hand in Dashboard -> Database -> Policies -> solves (its name is
-- not known to this script). See supabase/README.md.

-- ---------------------------------------------------------------------------
-- 4. Username availability check, callable before an account exists.
--    'taken_account'   -> an account already uses this name
--    'taken_anonymous' -> a legacy anonymous leaderboard row uses this name
--    'available'       -> free
-- ---------------------------------------------------------------------------
create or replace function public.username_status(p_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.profiles
       where lower(username) = lower(trim(p_name))
    ) then 'taken_account'
    when exists (
      select 1 from public.solves
       where user_id is null
         and lower(display_name) = lower(trim(p_name))
    ) then 'taken_anonymous'
    else 'available'
  end;
$$;

revoke all on function public.username_status(text) from public;
grant execute on function public.username_status(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. progress: per-account solved puzzles (source of truth for cross-device sync).
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  user_id             uuid not null references auth.users (id) on delete cascade,
  puzzle_id           text not null,
  time_seconds        integer not null check (time_seconds >= 0),
  hints_used          smallint not null default 0 check (hints_used >= 0),
  solved_at           timestamptz not null default now(),
  leaderboard_row_id  uuid,
  primary key (user_id, puzzle_id)
);

comment on table public.progress is
  'Solved puzzles per account. The app mirrors these rows into localStorage on sign-in.';

alter table public.progress enable row level security;

drop policy if exists "progress: own rows" on public.progress;
create policy "progress: own rows" on public.progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Claim legacy anonymous leaderboard rows. Row ids are only known to the
--    device that inserted them, which is the ownership proof. Rows that would
--    collide with an existing row for the same account/puzzle are skipped.
-- ---------------------------------------------------------------------------
create or replace function public.claim_solves(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_id       uuid;
  v_count    integer := 0;
begin
  if auth.uid() is null or p_ids is null then
    return 0;
  end if;

  select username into v_username
    from public.profiles
   where id = auth.uid();

  if v_username is null then
    return 0;
  end if;

  foreach v_id in array p_ids loop
    begin
      update public.solves s
         set user_id = auth.uid(),
             display_name = v_username
       where s.id = v_id
         and s.user_id is null
         and not exists (
           select 1 from public.solves o
            where o.puzzle_id = s.puzzle_id
              and o.user_id = auth.uid()
         );
      if found then
        v_count := v_count + 1;
      end if;
    exception when unique_violation then
      -- A legacy (puzzle_id, display_name) constraint collided; leave this row anonymous.
      null;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.claim_solves(uuid[]) from public;
grant execute on function public.claim_solves(uuid[]) to authenticated;

commit;
