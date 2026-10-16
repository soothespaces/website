-- Photos uploaded from /admin/photos: admins upload to the public `photos`
-- bucket and tag each photo to a building, a room on one of its floor plans,
-- or the spot on the plan where it was taken.
--
-- A photo's subject stays building_slug (or space_id). A room is floor +
-- room_number, the label in the floor plan's GeoJSON (the same convention as
-- bookable_items.room_number). A spot is the existing lat/lng, placed by
-- clicking the vector plan, which is already in map coordinates.

alter table public.photos
  add column room_number text check (room_number is null or length(trim(room_number)) > 0),
  -- The admin who uploaded it. Null for photos from scripts/photos/import.mjs,
  -- which runs with the secret key and has no signed-in user.
  add column uploaded_by text,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint photo_room_needs_building_floor check (
    room_number is null or (building_slug is not null and floor is not null)
  );

create index photos_building_room_idx
  on public.photos (building_slug, floor, room_number)
  where room_number is not null and is_listed;

-- uploaded_by always takes the signed-in user's email on insert and never
-- changes after; writes without a user (dashboard, secret key) keep what
-- they set.
create function private.stamp_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.uploaded_by = coalesce(lower(auth.jwt() ->> 'email'), new.uploaded_by);
    new.created_at = now();
  else
    new.uploaded_by = old.uploaded_by;
    new.created_at = old.created_at;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.stamp_photo() from public, anon, authenticated;

create trigger photos_stamp
before insert or update on public.photos
for each row
execute function private.stamp_photo();

-- Admins see unlisted photos too, and may add, re-tag and remove any photo.
create policy "admins can read every photo"
on public.photos
for select
to authenticated
using ((select public.is_admin()));

create policy "admins can add photos"
on public.photos
for insert
to authenticated
with check ((select public.is_admin()));

create policy "admins can change photos"
on public.photos
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "admins can remove photos"
on public.photos
for delete
to authenticated
using ((select public.is_admin()));

grant insert, update, delete on public.photos to authenticated;

-- The bucket is public, so anyone can fetch a file by URL without a policy.
-- Uploading, replacing and removing files (removing needs select as well)
-- is for admins only.
create policy "admins can read photo files"
on storage.objects
for select
to authenticated
using (bucket_id = 'photos' and (select public.is_admin()));

create policy "admins can upload photo files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'photos' and (select public.is_admin()));

create policy "admins can replace photo files"
on storage.objects
for update
to authenticated
using (bucket_id = 'photos' and (select public.is_admin()))
with check (bucket_id = 'photos' and (select public.is_admin()));

create policy "admins can remove photo files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'photos' and (select public.is_admin()));
