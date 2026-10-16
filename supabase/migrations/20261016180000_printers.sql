-- Public printers from MPrint (mprint.umich.edu), seeded from
-- scripts/seed/mprint-printers.json. Each printer carries MPrint's building
-- record number, which matches buildings.official_id (or
-- extra->>'buildingRecordNumber') for buildings we have, plus its floor, room
-- and spot on MPrint's floor-plan sheet. Live status (offline, out of paper)
-- isn't stored: it needs MPrint's API, which is behind U-M login.

create table public.printers (
  id bigint generated always as identity primary key,
  -- MPrint's queue name, e.g. 'm-ulib-1000-bw-2'.
  mprint_name text not null unique check (length(trim(mprint_name)) > 0),
  display_name text not null,
  building_record_number text,
  building_name text,
  building_slug text
    references public.buildings (slug)
    on update cascade
    on delete set null,
  floor_label text,
  floor smallint,
  room_number text,
  color boolean not null default false,
  tabloid boolean not null default false,
  copier boolean not null default false,
  poster boolean not null default false,
  staple boolean not null default false,
  card_reader boolean not null default false,
  price numeric(6, 2) check (price >= 0),
  price_unit text check (price_unit in ('page', 'foot')),
  notes text,
  -- Where the printer sits on MPrint's floor-plan sheet, in sheet pixels. The
  -- sheets are the ones scripts/mprint/ aligns to building footprints.
  floor_map text,
  floor_map_x integer,
  floor_map_y integer,
  source text not null default 'mprint'
    check (source in ('mprint', 'manual')),
  updated_at timestamptz not null default now(),
  constraint printers_price_unit check ((price is null) = (price_unit is null))
);

comment on column public.printers.floor is
  'Floor number parsed from floor_label (0 = basement); null for Ground, Lower Level and the like.';
comment on column public.printers.copier is
  'Also copies and scans (MPrint''s "copy").';

create index printers_building_slug_idx
  on public.printers (building_slug)
  where building_slug is not null;

create trigger printers_set_updated_at
before update on public.printers
for each row execute function private.set_updated_at();

alter table public.printers enable row level security;

create policy "printers are publicly readable"
on public.printers
for select
to anon, authenticated
using (true);

revoke all on public.printers from anon, authenticated;
grant select on public.printers to anon, authenticated;
