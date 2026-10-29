-- Storage for profile logos (CMS-10). Anyone can view a logo by its link, so the public
-- pages can show it; only admins can upload, replace or remove one. Images only
-- (PNG, JPEG, WebP), up to 2 MB. SVG is left out because it can carry scripts.
-- Run after 20261028000000_create_admins.sql (uses private.is_admin()).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-logos', 'profile-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A public bucket serves files by link without any policy. These policies cover
-- everything else (listing, uploading, replacing, removing) and allow it for admins only.
drop policy if exists "Admins can list profile logos" on storage.objects;
create policy "Admins can list profile logos" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-logos' and (select private.is_admin()));

drop policy if exists "Admins can upload profile logos" on storage.objects;
create policy "Admins can upload profile logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-logos' and (select private.is_admin()));

drop policy if exists "Admins can replace profile logos" on storage.objects;
create policy "Admins can replace profile logos" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-logos' and (select private.is_admin()))
  with check (bucket_id = 'profile-logos' and (select private.is_admin()));

drop policy if exists "Admins can remove profile logos" on storage.objects;
create policy "Admins can remove profile logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-logos' and (select private.is_admin()));
