-- Exterior doors from the U-M Facilities & Operations campus map
-- (map.fo.umich.edu), seeded from scripts/campus-map/raw/accessibility.json.
-- Each door is rated accessible or not and automatic or not; doors carry FO's
-- building record number, which matches buildings.official_id (or
-- extra->>'buildingRecordNumber') for buildings we have. Doors on buildings we
-- don't have keep the record number and FO's building name, with no slug.

create table public.building_entrances (
  id uuid primary key,
  fo_object_id integer unique,
  building_record_number text,
  building_name text,
  building_slug text
    references public.buildings (slug)
    on update cascade
    on delete set null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  floor_label text,
  accessible boolean not null,
  automatic boolean not null,
  keypad boolean not null default false,
  location_description text,
  notes text,
  source text not null default 'fo_campus_map'
    check (source in ('fo_campus_map', 'manual')),
  updated_at timestamptz not null default now()
);

comment on column public.building_entrances.id is
  'FO GlobalID for doors from the campus map; any uuid for manual rows.';
comment on column public.building_entrances.location_description is
  'Plain-language description of where the door is (FO''s AltText).';
comment on column public.building_entrances.notes is
  'Survey notes, e.g. door force or missing level landings (FO''s Comments).';

create index building_entrances_building_slug_idx
  on public.building_entrances (building_slug)
  where building_slug is not null;
create index building_entrances_building_record_number_idx
  on public.building_entrances (building_record_number);

create trigger building_entrances_set_updated_at
before update on public.building_entrances
for each row execute function private.set_updated_at();

alter table public.building_entrances enable row level security;

create policy "building entrances are publicly readable"
on public.building_entrances
for select
to anon, authenticated
using (true);

revoke all on public.building_entrances from anon, authenticated;
grant select on public.building_entrances to anon, authenticated;
