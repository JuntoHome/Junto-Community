-- Admin access through the API ends when the admin logs out (CMS-26).
-- An access token stays valid for up to an hour after logout, and private.is_admin()
-- only checked whose token it was, so a copied token could still change profiles and
-- logos through the Supabase API until it expired. The app's own pages already refused
-- it (getUser() in src/lib/auth.ts). Now the token's session must still exist too:
-- logging out deletes it, and so does deleting the user.
-- Run after 20261028000000_create_admins.sql. Grants on the function are unchanged.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    join auth.sessions s on s.user_id = a.user_id
    where a.user_id = (select auth.uid())
      and s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
  );
$$;
