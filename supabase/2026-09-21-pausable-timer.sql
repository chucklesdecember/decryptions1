-- Server-authoritative pause/resume support. Apply after guest/archive access.
begin;

alter table private.puzzles
  add column if not exists available_on date;

-- The Monday, September 21 edition is intentionally playable on Sunday while
-- retaining its September 21 display/news date.
update private.puzzles
   set available_on = date '2026-09-20'
 where id = '2143daef-7d5d-4e52-b371-73c54e19d12e';

alter table private.attempts
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0;

create or replace function private.game_state(p_user uuid, p_puzzle uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p private.puzzles;
  a private.attempts;
  s public.progress;
  v_words jsonb;
  v_solved boolean;
  v_now timestamptz := clock_timestamp();
  v_elapsed integer := 0;
begin
  select * into strict p from private.puzzles where id = p_puzzle;
  select * into a from private.attempts where user_id = p_user and puzzle_id = p_puzzle;
  select * into s from public.progress where user_id = p_user and puzzle_id = p_puzzle::text;
  v_solved := s.user_id is not null;
  if v_solved then
    v_elapsed := s.time_seconds;
  elsif a.user_id is not null then
    v_elapsed := greatest(0,
      floor(extract(epoch from (coalesce(a.paused_at, v_now) - a.started_at)))::integer
      - a.paused_seconds);
  end if;
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
    'startedAt', a.started_at, 'serverNow', v_now,
    'elapsedSeconds', v_elapsed, 'paused', a.paused_at is not null,
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
  where coalesce(available_on, publish_date)
    <= (statement_timestamp() at time zone 'America/New_York')::date;
$$;

create or replace function private.require_puzzle_access(p_user uuid, p_puzzle uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_date date; v_is_anonymous boolean; v_daily uuid;
begin
  select coalesce(available_on, publish_date) into v_date
    from private.puzzles where id = p_puzzle;
  if v_date is null or v_date > (clock_timestamp() at time zone 'America/New_York')::date then
    raise exception 'Puzzle unavailable' using errcode = 'P0002';
  end if;
  select id into v_daily from private.puzzles
    where coalesce(available_on, publish_date)
      <= (clock_timestamp() at time zone 'America/New_York')::date
    order by publish_date desc limit 1;
  v_is_anonymous := coalesce((auth.jwt()->>'is_anonymous')::boolean, true);
  if p_puzzle is distinct from v_daily and v_is_anonymous then
    raise exception 'Account required for archive' using errcode = 'P0003';
  end if;
end $$;

create or replace function public.start_puzzle(p_puzzle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); a private.attempts; v_now timestamptz; begin
  if v_user is null then raise exception 'Sign in to play' using errcode = '42501'; end if;
  if not exists (select 1 from private.puzzles where id = p_puzzle_id
      and coalesce(available_on, publish_date)
        <= (clock_timestamp() at time zone 'America/New_York')::date) then
    raise exception 'Puzzle unavailable' using errcode = 'P0002';
  end if;
  perform private.require_puzzle_access(v_user, p_puzzle_id);
  if not exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text) then
    insert into private.attempts(user_id, puzzle_id) values (v_user, p_puzzle_id)
      on conflict do nothing;
  end if;
  select * into a from private.attempts
    where user_id = v_user and puzzle_id = p_puzzle_id for update;
  if a.paused_at is not null
     and not exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text) then
    v_now := clock_timestamp();
    update private.attempts
       set paused_seconds = paused_seconds + greatest(0,
             floor(extract(epoch from (v_now - paused_at)))::integer),
           paused_at = null
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
  where s.user_id = auth.uid() and coalesce(p.available_on, p.publish_date)
    <= (clock_timestamp() at time zone 'America/New_York')::date);
end $$;

create or replace function public.get_leaderboard(p_puzzle_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.time_seconds, coalesce(r.hints_used, 0), r.created_at, r.id), '[]'::jsonb)
  from (select s.id, s.display_name, s.time_seconds, s.hints_used, s.created_at, s.verified
    from public.solves s join private.puzzles p on s.puzzle_id = p.id::text
    where p.id = p_puzzle_id and coalesce(p.available_on, p.publish_date)
      <= (statement_timestamp() at time zone 'America/New_York')::date
    order by s.time_seconds, coalesce(s.hints_used, 0), s.created_at, s.id limit 100) r;
$$;

create or replace function public.pause_puzzle(p_puzzle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); a private.attempts; begin
  if v_user is null then raise exception 'Sign in to play' using errcode = '42501'; end if;
  perform private.require_puzzle_access(v_user, p_puzzle_id);
  if exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text) then
    return private.game_state(v_user, p_puzzle_id);
  end if;
  select * into a from private.attempts
    where user_id = v_user and puzzle_id = p_puzzle_id for update;
  if not found then raise exception 'Start the puzzle first' using errcode = 'P0002'; end if;
  if a.paused_at is null then
    update private.attempts set paused_at = clock_timestamp()
      where user_id = v_user and puzzle_id = p_puzzle_id;
  end if;
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
  if a.paused_at is not null then
    raise exception 'Resume the puzzle first' using errcode = 'P0004';
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
    v_now := clock_timestamp();
    v_seconds := greatest(0,
      floor(extract(epoch from (v_now - a.started_at)))::integer - a.paused_seconds);
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
  if a.paused_at is not null then
    raise exception 'Resume the puzzle first' using errcode = 'P0004';
  end if;
  if not exists (select 1 from public.progress where user_id = v_user and puzzle_id = p_puzzle_id::text)
     and not (p_word_index = any(a.revealed)) then
    update private.attempts set revealed = array_append(revealed, p_word_index)
      where user_id = v_user and puzzle_id = p_puzzle_id;
  end if;
  return private.game_state(v_user, p_puzzle_id);
end $$;

revoke all on function public.pause_puzzle(uuid) from public, anon, authenticated;
grant execute on function public.pause_puzzle(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
