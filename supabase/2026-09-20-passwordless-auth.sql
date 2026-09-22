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

-- The accounts migration may be applied after Auth already contains users.
-- Backfill those users before syncing emails. If an old anonymous account and
-- its upgraded account share a username, keep the confirmed account's name and
-- give the orphaned anonymous account a stable suffix.
with named as (
  select u.id,
         u.email,
         u.created_at,
         coalesce(u.is_anonymous, true) as is_anonymous,
         coalesce(
           nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
           'player-' || substr(u.id::text, 1, 8)
         ) as base_username
    from auth.users u
), ranked as (
  select named.*,
         row_number() over (
           partition by lower(base_username)
           order by is_anonymous, created_at, id
         ) as username_rank
    from named
)
insert into public.profiles (id, username, email, created_at)
select id,
       case
         when username_rank = 1 then left(base_username, 24)
         else left(base_username, 14) || '-' || substr(id::text, 1, 8)
       end,
       coalesce(email, ''),
       created_at
  from ranked
on conflict (id) do update
  set email = excluded.email;

-- Bring existing profiles in sync before the trigger handles future confirmations.
update public.profiles p
   set email = coalesce(u.email, '')
  from auth.users u
 where p.id = u.id
   and p.email is distinct from coalesce(u.email, '');

commit;
