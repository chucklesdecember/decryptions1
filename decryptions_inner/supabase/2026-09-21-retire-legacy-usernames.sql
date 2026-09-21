-- Guest-first usernames. Pre-September 2026 profile names are retired so they
-- cannot block a new player who chooses the same name today.
-- Apply after 2026-09-21-email-derived-usernames.sql.

begin;

-- Keep the legacy records and their scores, but move their display names out
-- of the current username namespace. The UUID makes every replacement unique.
update public.profiles
   set username = 'legacy-' || replace(id::text, '-', '')
 where created_at < timestamptz '2026-09-01 00:00:00+00';

-- Account upgrades now preserve the guest name chosen in the game. The older
-- migration changed it to the email prefix; remove that behavior entirely.
drop trigger if exists on_auth_guest_upgraded on auth.users;

-- Username checks deliberately ignore legacy profile and anonymous-score names.
-- Names created from September 1 onward are still reserved case-insensitively.
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
       where created_at >= timestamptz '2026-09-01 00:00:00+00'
         and lower(username) = lower(trim(p_name))
    ) then 'taken_account'
    when exists (
      select 1 from public.solves
       where created_at >= timestamptz '2026-09-01 00:00:00+00'
         and user_id is null
         and lower(display_name) = lower(trim(p_name))
    ) then 'taken_anonymous'
    else 'available'
  end;
$$;

revoke all on function public.username_status(text) from public;
grant execute on function public.username_status(text) to anon, authenticated;

commit;
