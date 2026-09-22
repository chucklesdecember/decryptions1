-- Baseline for an empty Supabase project; existing deployments already have solves.
begin;
create table if not exists public.solves (
  id uuid primary key default gen_random_uuid(),
  puzzle_id text not null,
  display_name text not null,
  time_seconds integer not null check (time_seconds >= 0),
  hints_used smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(puzzle_id, display_name)
);
alter table public.solves enable row level security;
commit;
