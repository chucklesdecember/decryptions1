-- Apply after 2026-09-05-accounts.sql. Import private puzzle data before reopening play.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.puzzles (
  id uuid primary key,
  publish_date date not null unique,
  category text not null,
  headline text not null,
  article_url text,
  words jsonb not null check (jsonb_typeof(words) = 'array' and jsonb_array_length(words) between 1 and 30),
  hints jsonb not null check (jsonb_typeof(hints) = 'array'),
  check (jsonb_array_length(words) = jsonb_array_length(hints))
);
create table if not exists private.puzzle_legacy_ids (
  legacy_id text primary key,
  puzzle_id uuid not null unique references private.puzzles(id)
);
create table if not exists private.attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references private.puzzles(id),
  started_at timestamptz not null default clock_timestamp(),
  accepted integer[] not null default '{}',
  revealed integer[] not null default '{}',
  primary key (user_id, puzzle_id)
);
create table if not exists private.word_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  checks integer not null
);

alter table public.solves add column if not exists verified boolean not null default false;
alter table public.progress add column if not exists verified boolean not null default false;
alter table public.solves add column if not exists hints_used smallint not null default 0;

-- Grants are removed as well as policies: unknown permissive legacy policies cannot
-- reopen writes or expose answer-bearing IDs. Read through the allowlisted RPCs only.
revoke all on public.solves, public.progress from public, anon, authenticated;
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('solves', 'progress') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
drop function if exists public.claim_solves(uuid[]);
create unique index if not exists solves_one_per_user_per_puzzle
  on public.solves(puzzle_id, user_id) where user_id is not null;
create index if not exists solves_ranking on public.solves(puzzle_id, time_seconds, hints_used, created_at, id);

-- Private response builder. No SQL caller can supply an owner to a public RPC.
create or replace function private.game_state(p_user uuid, p_puzzle uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p private.puzzles;
  a private.attempts;
  s public.progress;
  v_words jsonb;
  v_solved boolean;
begin
  select * into strict p from private.puzzles where id = p_puzzle;
  select * into a from private.attempts where user_id = p_user and puzzle_id = p_puzzle;
  select * into s from public.progress where user_id = p_user and puzzle_id = p_puzzle::text;
  v_solved := s.user_id is not null;
  select jsonb_agg(jsonb_build_object(
    'clues', w.value->'clues',
    'answerLength', char_length(w.value->>'answer'),
    'acceptedAnswer', case when v_solved or (w.ordinality::int - 1) = any(a.accepted)
                           then upper(w.value->>'answer') else null end,
    'hint', case when (w.ordinality::int - 1) = any(a.revealed)
                 then p.hints->>(w.ordinality::int - 1) else null end
  ) order by w.ordinality) into v_words
  from jsonb_array_elements(p.words) with ordinality w;
  return jsonb_build_object(
    'id', p.id, 'date', p.publish_date, 'category', p.category,
    'startedAt', a.started_at, 'serverNow', clock_timestamp(),
    'words', v_words, 'completed', v_solved,
    'hintsUsed', case when v_solved then s.hints_used else coalesce(cardinality(a.revealed), 0) end,
    'result', case when v_solved then jsonb_build_object(
      'timeSeconds', s.time_seconds, 'solvedAt', s.solved_at,
      'rowId', s.leaderboard_row_id, 'verified', s.verified,
      'headline', p.headline, 'articleUrl', p.article_url
    ) else null end
  );
end $$;

create or replace function public.list_puzzles()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'date', publish_date, 'category', category
  ) order by publish_date desc), '[]'::jsonb)
  from private.puzzles
  where publish_date <= (statement_timestamp() at time zone 'America/New_York')::date;
$$;

create or replace function public.start_puzzle(p_puzzle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); begin
  if v_user is null then raise exception 'Sign in to play' using errcode = '42501'; end if;
  if not exists (select 1 from private.puzzles where id = p_puzzle_id
      and publish_date <= (clock_timestamp() at time zone 'America/New_York')::date) then
    raise exception 'Puzzle unavailable' using errcode = 'P0002';
  end if;
  -- Imported legacy completions never receive a second ranked attempt.
  if not exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text) then
    insert into private.attempts(user_id, puzzle_id) values (v_user, p_puzzle_id)
      on conflict do nothing;
  end if;
  -- Wait for another tab's in-flight submission before producing the snapshot.
  perform 1 from private.attempts where user_id = v_user and puzzle_id = p_puzzle_id for update;
  return private.game_state(v_user, p_puzzle_id);
end $$;

create or replace function public.submit_word(p_puzzle_id uuid, p_word_index integer, p_guess text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  a private.attempts;
  p private.puzzles;
  lim private.word_limits;
  v_now timestamptz;
  v_correct boolean;
  v_row uuid;
  v_seconds integer;
begin
  if v_user is null then raise exception 'Sign in to play' using errcode = '42501'; end if;
  if p_guess is null or char_length(p_guess) > 128 or p_word_index is null then
    raise exception 'Invalid word submission' using errcode = '22023';
  end if;
  -- All submissions lock the account limiter before the attempt, in that order.
  insert into private.word_limits values (v_user, clock_timestamp(), 0) on conflict do nothing;
  select * into lim from private.word_limits where user_id = v_user for update;
  select * into a from private.attempts where user_id = v_user and puzzle_id = p_puzzle_id for update;
  if not found then raise exception 'Start the puzzle first' using errcode = 'P0002'; end if;
  select * into strict p from private.puzzles where id = p_puzzle_id;
  if p_word_index < 0 or p_word_index >= jsonb_array_length(p.words) then
    raise exception 'Invalid word index' using errcode = '22023';
  end if;
  if exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text) then
    return jsonb_build_object('state', private.game_state(v_user, p_puzzle_id), 'correct', true);
  end if;
  v_now := clock_timestamp();
  if v_now >= lim.window_start + interval '1 minute' then
    lim.window_start := v_now; lim.checks := 0;
  end if;
  if lim.checks >= 60 then
    return jsonb_build_object('retryAfterSeconds', greatest(1, ceil(extract(epoch from
      (lim.window_start + interval '1 minute' - v_now)))::int));
  end if;
  update private.word_limits set window_start = lim.window_start, checks = lim.checks + 1 where user_id = v_user;
  v_correct := upper(p_guess) = upper(p.words->p_word_index->>'answer');
  if v_correct and not (p_word_index = any(a.accepted)) then
    a.accepted := array_append(a.accepted, p_word_index);
    update private.attempts set accepted = a.accepted where user_id = v_user and puzzle_id = p_puzzle_id;
  end if;
  if cardinality(a.accepted) = jsonb_array_length(p.words) then
    -- Sample completion after acquiring locks and checking the answer, never from the client.
    v_now := clock_timestamp();
    v_seconds := greatest(0, floor(extract(epoch from (v_now - a.started_at))))::integer;
    insert into public.solves(puzzle_id, user_id, display_name, time_seconds, hints_used, created_at, verified)
      values (p_puzzle_id::text, v_user,
        (select username from public.profiles where id = v_user),
        v_seconds, cardinality(a.revealed), v_now, true) returning id into v_row;
    insert into public.progress(user_id, puzzle_id, time_seconds, hints_used, solved_at, leaderboard_row_id, verified)
      values (v_user, p_puzzle_id::text, v_seconds, cardinality(a.revealed), v_now, v_row, true);
  end if;
  return jsonb_build_object('state', private.game_state(v_user, p_puzzle_id), 'correct', v_correct);
end $$;

create or replace function public.reveal_hint(p_puzzle_id uuid, p_word_index integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); a private.attempts; v_count integer; begin
  if v_user is null then raise exception 'Sign in to play' using errcode = '42501'; end if;
  select * into a from private.attempts where user_id = v_user and puzzle_id = p_puzzle_id for update;
  if not found then raise exception 'Start the puzzle first' using errcode = 'P0002'; end if;
  select jsonb_array_length(words) into v_count from private.puzzles where id = p_puzzle_id;
  if p_word_index is null or p_word_index < 0 or p_word_index >= v_count then
    raise exception 'Invalid word index' using errcode = '22023';
  end if;
  if not exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text)
     and not (p_word_index = any(a.revealed)) then
    update private.attempts set revealed = array_append(revealed, p_word_index)
      where user_id = v_user and puzzle_id = p_puzzle_id;
  end if;
  return private.game_state(v_user, p_puzzle_id);
end $$;

create or replace function public.get_my_progress()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view progress' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'puzzleId', p.id, 'timeSeconds', s.time_seconds, 'hintsUsed', s.hints_used,
    'solvedAt', s.solved_at, 'rowId', s.leaderboard_row_id, 'verified', s.verified
  )), '[]'::jsonb) from public.progress s join private.puzzles p on s.puzzle_id = p.id::text
  where s.user_id = auth.uid() and p.publish_date <= (clock_timestamp() at time zone 'America/New_York')::date);
end $$;

create or replace function public.get_leaderboard(p_puzzle_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.time_seconds, coalesce(r.hints_used, 0), r.created_at, r.id), '[]'::jsonb)
  from (select s.id, s.display_name, s.time_seconds, s.hints_used, s.created_at, s.verified
    from public.solves s join private.puzzles p on s.puzzle_id = p.id::text
    where p.id = p_puzzle_id and p.publish_date <= (statement_timestamp() at time zone 'America/New_York')::date
    order by s.time_seconds, coalesce(s.hints_used, 0), s.created_at, s.id limit 100) r;
$$;

revoke all on all tables in schema private from public, anon, authenticated;
alter table private.puzzles enable row level security;
alter table private.puzzle_legacy_ids enable row level security;
alter table private.attempts enable row level security;
alter table private.word_limits enable row level security;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.list_puzzles(), public.start_puzzle(uuid),
  public.submit_word(uuid, integer, text), public.reveal_hint(uuid, integer),
  public.get_my_progress(), public.get_leaderboard(uuid) from public, anon, authenticated;
grant execute on function public.list_puzzles(), public.get_leaderboard(uuid) to anon, authenticated;
grant execute on function public.start_puzzle(uuid), public.submit_word(uuid, integer, text),
  public.reveal_hint(uuid, integer), public.get_my_progress() to authenticated;

notify pgrst, 'reload schema';
commit;
