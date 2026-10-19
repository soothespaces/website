-- Hand edits to study spaces from /admin/spaces: amenities, brightness, noise,
-- where a space is on the floor plans, and new spaces the sources don't list
-- (an area of Shapiro's 3rd floor, the CAEN labs).
--
-- scripts/seed/build.mjs re-upserts spaces from the Library and MGuide
-- snapshots, so each space remembers which columns a person changed
-- (edited_fields) and the seed leaves those alone.

alter table public.spaces
  add column light_level public.light_level,
  -- Columns a signed-in admin changed by hand. Filled by the trigger below;
  -- the seed skips these columns. Remove a name to let the seed update it.
  add column edited_fields text[] not null default '{}';

-- Writes with a signed-in user (the editor) add every column they change to
-- edited_fields; writes without one (seed.sql, the secret key) don't. An
-- update that sets edited_fields itself (to unlock a column) keeps that
-- value, plus whatever else it changes.
create function private.track_space_edits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed text[];
begin
  if auth.uid() is null then
    return new;
  end if;
  select coalesce(array_agg(n.key order by n.key), '{}')
  into changed
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value
    and n.key not in ('id', 'updated_at', 'edited_fields');
  new.edited_fields = array(
    select distinct f from unnest(new.edited_fields || changed) f order by f
  );
  return new;
end;
$$;

revoke execute on function private.track_space_edits() from public, anon, authenticated;

create trigger spaces_track_edits
before update on public.spaces
for each row
execute function private.track_space_edits();

-- Admins see unlisted spaces, edit any space, and add or remove their own
-- (source 'manual'; the editor gives them a manual- slug so they never
-- collide with the sources' slugs). Spaces from the Library and MGuide are
-- hidden with is_listed instead of deleted, or the next seed would bring
-- them back.
-- One SELECT policy per role, so Postgres doesn't run two for every row.
drop policy "listed spaces are publicly readable" on public.spaces;

create policy "listed spaces are publicly readable"
on public.spaces
for select
to anon
using (is_listed);

create policy "listed spaces are readable, and admins read every space"
on public.spaces
for select
to authenticated
using (is_listed or (select public.is_admin()));

create policy "admins can add spaces"
on public.spaces
for insert
to authenticated
with check ((select public.is_admin()) and source = 'manual');

create policy "admins can change spaces"
on public.spaces
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "admins can remove spaces they added"
on public.spaces
for delete
to authenticated
using ((select public.is_admin()) and source = 'manual');

grant insert, update, delete on public.spaces to authenticated;

-- Where a space is: rooms on its building's vector floor plans (the GeoJSON
-- roomNumber, as in photos and bookable_items), or an outline drawn on the
-- plan for open areas. The building is the space's. The editor also sets
-- spaces.lat/lng to the middle of these, which puts the space on the map.
create table public.space_locations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null
    references public.spaces (id)
    on delete cascade,
  floor smallint not null,
  room_number text check (room_number is null or length(trim(room_number)) > 0),
  -- A GeoJSON Polygon in map coordinates (lng, lat).
  area jsonb check (
    area is null
    or (area ->> 'type' = 'Polygon' and jsonb_typeof(area -> 'coordinates') = 'array')
  ),
  created_by text,
  created_at timestamptz not null default now(),
  constraint location_room_or_area check ((room_number is null) <> (area is null))
);

create unique index space_locations_room_idx
  on public.space_locations (space_id, floor, room_number)
  where room_number is not null;
create index space_locations_space_id_idx
  on public.space_locations (space_id);

create function private.stamp_space_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by = coalesce(lower(auth.jwt() ->> 'email'), new.created_by);
  new.created_at = now();
  return new;
end;
$$;

revoke execute on function private.stamp_space_location() from public, anon, authenticated;

create trigger space_locations_stamp
before insert on public.space_locations
for each row
execute function private.stamp_space_location();

alter table public.space_locations enable row level security;

create policy "space locations are publicly readable"
on public.space_locations
for select
to anon, authenticated
using (true);

create policy "admins can add space locations"
on public.space_locations
for insert
to authenticated
with check ((select public.is_admin()));

create policy "admins can remove space locations"
on public.space_locations
for delete
to authenticated
using ((select public.is_admin()));

revoke all on public.space_locations from anon, authenticated;
grant select on public.space_locations to anon, authenticated;
grant insert, delete on public.space_locations to authenticated;

-- The same one-policy-per-role fix for photos (20261013150000 added a second
-- SELECT policy for admins).
drop policy "listed photos are publicly readable" on public.photos;
drop policy "admins can read every photo" on public.photos;

create policy "listed photos are publicly readable"
on public.photos
for select
to anon
using (is_listed);

create policy "listed photos are readable, and admins read every photo"
on public.photos
for select
to authenticated
using (is_listed or (select public.is_admin()));
