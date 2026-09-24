-- Optional alternate spellings remain inside private puzzle JSON. Clients receive only the
-- canonical answer after solving, never the alias list.
begin;

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
  v_correct := upper(p_guess) = upper(p.words->p_word_index->>'answer')
    or exists (
      select 1
      from jsonb_array_elements_text(coalesce(p.words->p_word_index->'acceptedAnswers', '[]'::jsonb)) alias(value)
      where upper(p_guess) = upper(alias.value)
    );
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

revoke all on function public.submit_word(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.submit_word(uuid, integer, text) to authenticated;

commit;
