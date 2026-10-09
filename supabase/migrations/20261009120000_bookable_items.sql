-- WP6: LibCal bookable rooms and seats (ADR 0008). Item metadata only, seeded
-- from scripts/seed/raw/libcal-items.json. Live availability is read
-- server-side and cached, never stored, and neither is who booked what.

create table public.bookable_items (
  instance text not null check (
    instance in ('umich.libcal.com', 'umich-nc.libcal.com', 'umich-cc.libcal.com')
  ),
  libcal_item_id integer not null check (libcal_item_id > 0),
  lid integer not null,
  kind text not null check (kind in ('space', 'seat')),
  title text not null check (length(trim(title)) > 0),
  location_name text,
  grouping text,
  building_slug text
    references public.buildings (slug)
    on update cascade,
  floor smallint,
  room_number text,
  capacity integer check (capacity > 0),
  booking_url text not null,
  thumbnail_url text,
  space_id uuid references public.spaces (id) on delete set null,
  room_zone_id uuid references public.room_zones (id) on delete set null,
  is_listed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (instance, libcal_item_id)
);

create index bookable_items_building_slug_idx
  on public.bookable_items (building_slug);
create index bookable_items_space_id_idx
  on public.bookable_items (space_id)
  where space_id is not null;
create index bookable_items_room_zone_id_idx
  on public.bookable_items (room_zone_id)
  where room_zone_id is not null;

create trigger bookable_items_set_updated_at
before update on public.bookable_items
for each row execute function private.set_updated_at();

alter table public.bookable_items enable row level security;

create policy "listed bookable items are publicly readable"
on public.bookable_items
for select
to anon, authenticated
using (is_listed);

revoke all on public.bookable_items from anon, authenticated;
grant select on public.bookable_items to anon, authenticated;
