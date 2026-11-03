-- Profiles follow Paul's structure (2026-11-03): the introduction, then "Worth exploring",
-- "People to know" and "Getting started", ending with "Official sources / useful links".
-- The text columns keep their names; the admin and the public page show them under the
-- new headings (see the column comments). Getting started is now needed to publish, and
-- the links get their own column.
-- Run after 20261029000000_create_profiles.sql. All or nothing: if it stops, nothing changed.

begin;

comment on column public.profiles.how_they_help is 'Shown as "Worth exploring". Needed to publish.';
comment on column public.profiles.who_should_explore is 'Shown as "People to know". Needed to publish.';
comment on column public.profiles.history is 'Shown as "Getting started". Needed to publish.';

-- Each link is a web address, or [text](address) to show text instead of the address.
alter table public.profiles add column if not exists links text[] not null default '{}';
comment on column public.profiles.links is 'Shown as "Official sources / useful links": each a web address, or [text](address).';
alter table public.profiles drop constraint if exists profiles_links_limits;
alter table public.profiles add constraint profiles_links_limits
  check (cardinality(links) <= 10 and char_length(array_to_string(links, '')) <= 20000);

-- A published profile now needs Getting started too.
do $$
begin
  if exists (select 1 from public.profiles where status = 'published' and coalesce(btrim(history), '') = '') then
    raise exception 'Some published profiles have no Getting started text. Add it in the admin (or hide them), then run this again.';
  end if;
end;
$$;

alter table public.profiles drop constraint if exists profiles_published_complete;
alter table public.profiles add constraint profiles_published_complete check (
  status = 'draft' or (
    coalesce(btrim(tagline), '') <> ''
    and coalesce(btrim(intro), '') <> ''
    and coalesce(btrim(how_they_help), '') <> ''
    and coalesce(btrim(who_should_explore), '') <> ''
    and coalesce(btrim(history), '') <> ''
    and website_url is not null
  )
);

commit;
