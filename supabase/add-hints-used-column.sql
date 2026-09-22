-- Run once in Supabase SQL editor so leaderboard can store and show hint usage.
alter table public.solves
  add column if not exists hints_used smallint not null default 0;

comment on column public.solves.hints_used is 'Number of hint reveals used for this solve.';
