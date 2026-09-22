-- Password accounts. Apply after the accounts and profile-email migrations.
-- Supabase password auth identifies users by email; this narrow lookup supports
-- the product's username-or-email login field before the password exchange.

begin;

create or replace function public.login_email_for_identifier(p_identifier text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select u.email
        from auth.users u
       where lower(u.email) = lower(trim(p_identifier))
         and not coalesce(u.is_anonymous, false)
       limit 1
    ),
    (
      select p.email
        from public.profiles p
        join auth.users u on u.id = p.id
       where lower(p.username) = lower(trim(p_identifier))
         and not coalesce(u.is_anonymous, false)
         and p.email <> ''
       limit 1
    )
  );
$$;

revoke all on function public.login_email_for_identifier(text) from public;
grant execute on function public.login_email_for_identifier(text) to anon, authenticated;

commit;
