-- Admins: the people who can use /admin and change site content (CMS-02).
-- Sign-up is off in Supabase Auth. To add an admin, invite them under
-- Authentication → Users, then add their user id here (README → Admin access).
-- An account in auth.users that is not in this table has no admin access.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Until Oct 30, 2026 Supabase grants every new table to anon and authenticated
-- by default; after that, to nobody. Set the grants explicitly either way.
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.admins to service_role;

-- private.is_admin(): true when the request comes from a logged-in admin. Every
-- CMS policy uses it. It is "security definer" so it reads admins without going
-- through the admins policy below (a policy that queries its own table recurses
-- forever), and it lives in a schema the API does not expose.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Admins can see who the other admins are. Nobody can add or remove admins
-- through the API; that is done in the SQL editor.
drop policy if exists "Admins can read admins" on public.admins;
create policy "Admins can read admins" on public.admins
  for select to authenticated
  using ((select private.is_admin()));
