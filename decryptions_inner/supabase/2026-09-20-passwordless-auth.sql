-- Passwordless accounts: create an anonymous authenticated session first, then
-- attach and verify an email identity without interrupting play.
-- Dashboard setup is also required; see supabase/README.md.

begin;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email = coalesce(new.email, '')
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- Bring existing profiles in sync before the trigger handles future confirmations.
update public.profiles p
   set email = coalesce(u.email, '')
  from auth.users u
 where p.id = u.id
   and p.email is distinct from coalesce(u.email, '');

commit;
