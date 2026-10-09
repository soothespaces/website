-- WP3: where a photo was taken, so the app can show the photos nearest a room,
-- and 360° panoramas alongside flat photos. Positions are map coordinates, not
-- floor-plan pixels: MPrint crops differ per floor, while each plan's corners
-- already tie it to the map.

alter table public.photos
  add column kind text not null default 'photo'
    check (kind in ('photo', 'panorama')),
  add column floor smallint,
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  -- Compass direction the camera faced (0 = north, clockwise). For a panorama,
  -- the direction of the image's center column.
  add column heading smallint check (heading between 0 and 359),
  add constraint photo_coordinates_together check ((lat is null) = (lng is null)),
  add constraint photo_heading_needs_position check (heading is null or lat is not null),
  -- The team's own photos have no web page to link to.
  alter column source_url drop not null;

create index photos_building_floor_idx
  on public.photos (building_slug, floor)
  where building_slug is not null and is_listed;
