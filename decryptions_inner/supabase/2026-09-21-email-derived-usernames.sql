-- New account names are the local part of the account email. Existing account
-- names remain unchanged; only anonymous guest upgrades receive this update.

begin;

alter table public.profiles drop constraint if exists profiles_username_length;
alter table public.profiles add constraint profiles_username_length
  check (char_length(username) between 1 and 64);

create or replace function public.sync_guest_profile_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  -- A blank-to-present email transition is an anonymous guest becoming an account.
  if coalesce(old.email, '') = '' and coalesce(new.email, '') <> '' then
    v_username := split_part(new.email, '@', 1);
    update public.profiles
       set username = v_username,
           email = new.email
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_guest_upgraded on auth.users;
create trigger on_auth_guest_upgraded
  after update of email on auth.users
  for each row
  when (coalesce(old.email, '') = '' and coalesce(new.email, '') <> '')
  execute function public.sync_guest_profile_username();

commit;
