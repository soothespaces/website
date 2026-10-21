-- photos.uploaded_by holds the uploading admin's email. Signed-out visitors
-- don't need it, so anon gets every column but that one. Signed-in users keep
-- the whole row: /admin/photos reads uploaded_by with the admin's session, and
-- sign-up only admits @umich.edu accounts (hook_before_user_created).
--
-- A column grant means anon can't `select *` from photos; name the columns.

revoke select on public.photos from anon;

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
  created_at,
  updated_at
) on public.photos to anon;
