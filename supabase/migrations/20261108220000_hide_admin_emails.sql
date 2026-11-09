-- QA-001, QA-002, QA-003, QA-005, QA-006: the publishable key could read
-- admin emails and classroom contacts through the Data API.
--
-- Column grants replace the table-wide select grants, so `select *` no longer
-- works on these tables for anon or authenticated: name the columns. Admin
-- pages read who saved or uploaded something through the security-definer
-- functions below, which return nothing unless public.is_admin().

-- floor_alignments: aligned_by (admin email) is no longer readable.
revoke select on public.floor_alignments from anon, authenticated;
grant select (sheet, sha256, width, height, corners, aligned_at)
  on public.floor_alignments to anon, authenticated;

create function public.floor_alignment_authors()
returns table (sheet text, aligned_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.sheet, a.aligned_by
  from public.floor_alignments a
  where (select public.is_admin());
$$;

revoke execute on function public.floor_alignment_authors() from public, anon, authenticated;
grant execute on function public.floor_alignment_authors() to authenticated;

-- photos: uploaded_by is for admins only. `uploaded` lets /admin/photos keep
-- its "uploaded here" filter without reading the email.
alter table public.photos
  add column uploaded boolean generated always as (uploaded_by is not null) stored;

revoke select on public.photos from anon, authenticated;
grant select (
  id,
  building_slug,
  space_id,
  path_prefix,
  widths,
  width,
  height,
  alt,
  credit,
  license,
  source_url,
  sort_order,
  is_listed,
  kind,
  floor,
  lat,
  lng,
  heading,
  room_number,
  uploaded,
  created_at,
  updated_at
) on public.photos to anon, authenticated;

create function public.photo_uploaders(photo_ids uuid[])
returns table (id uuid, uploaded_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.uploaded_by
  from public.photos p
  where (select public.is_admin()) and p.id = any(photo_ids);
$$;

revoke execute on function public.photo_uploaders(uuid[]) from public, anon, authenticated;
grant execute on function public.photo_uploaders(uuid[]) to authenticated;

-- space_locations: created_by is no longer readable, and only locations of
-- listed spaces are public. Admins read every row (the space editor).
revoke select on public.space_locations from anon, authenticated;
grant select (id, space_id, floor, room_number, area, created_at)
  on public.space_locations to anon, authenticated;

drop policy "space locations are publicly readable" on public.space_locations;

create policy "locations of listed spaces are publicly readable"
on public.space_locations
for select
to anon
using (
  exists (
    select 1 from public.spaces s
    where s.id = space_locations.space_id and s.is_listed
  )
);

create policy "locations of listed spaces are readable, and admins read every location"
on public.space_locations
for select
to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.spaces s
    where s.id = space_locations.space_id and s.is_listed
  )
);

-- classrooms: the scheduling and support contacts from the logged-in
-- MClassrooms snapshot stay in the database but aren't served.
revoke select on public.classrooms from anon, authenticated;
grant select (
  mclassrooms_id,
  room_code,
  building_slug,
  building_match,
  building_official_id,
  building_name,
  building_code,
  room_number,
  floor_label,
  address,
  school_or_college,
  seats,
  characteristics,
  features,
  notes,
  notes_updated_on,
  page_url,
  schedule_url,
  floor_map_url,
  layout_pdf_url,
  panorama_url,
  photos,
  fetched_on,
  updated_at
) on public.classrooms to anon, authenticated;

-- QA-006: the photos bucket is public, so a file stays fetchable by URL after
-- its row is unlisted. Unlisted photos' files now live in this private bucket;
-- /admin/photos moves them across when "Show it on the site" changes, and
-- previews them with signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-hidden', 'photos-hidden', false, 5242880, array['image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "admins can read hidden photo files"
on storage.objects
for select
to authenticated
using (bucket_id = 'photos-hidden' and (select public.is_admin()));

create policy "admins can add hidden photo files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'photos-hidden' and (select public.is_admin()));

create policy "admins can replace hidden photo files"
on storage.objects
for update
to authenticated
using (bucket_id = 'photos-hidden' and (select public.is_admin()))
with check (bucket_id = 'photos-hidden' and (select public.is_admin()));

create policy "admins can remove hidden photo files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'photos-hidden' and (select public.is_admin()));
