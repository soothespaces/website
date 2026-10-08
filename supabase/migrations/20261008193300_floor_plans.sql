-- WP5: floor-plan images and pixel-space room hit targets.

create table public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  building_slug text not null
    references public.buildings (slug)
    on update cascade,
  floor_number smallint not null,
  floor_label text,
  mprint_tag text not null check (length(trim(mprint_tag)) > 0),
  image_path text not null check (length(trim(image_path)) > 0),
  mask_path text not null check (length(trim(mask_path)) > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  -- MapLibre image-source order: top-left, top-right, bottom-right,
  -- bottom-left. Each coordinate is [longitude, latitude].
  corners jsonb check (
    corners is null
    or (
      jsonb_typeof(corners) = 'array'
      and jsonb_array_length(corners) = 4
    )
  ),
  is_listed boolean not null default true,
  unique (building_slug, floor_number)
);

create table public.room_zones (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null
    references public.floor_plans (id)
    on delete cascade,
  room_number text not null check (length(trim(room_number)) > 0),
  mask_index smallint not null check (mask_index between 1 and 255),
  name text,
  centroid_x integer not null check (centroid_x >= 0),
  centroid_y integer not null check (centroid_y >= 0),
  -- [min_x, min_y, max_x, max_y] in the floor-plan image.
  bbox integer[] not null check (
    cardinality(bbox) = 4
    and bbox[1] >= 0
    and bbox[2] >= 0
    and bbox[3] >= bbox[1]
    and bbox[4] >= bbox[2]
  ),
  space_id uuid
    references public.spaces (id)
    on delete set null,
  unique (floor_plan_id, room_number),
  unique (floor_plan_id, mask_index)
    deferrable initially deferred
);

create index floor_plans_building_slug_idx
  on public.floor_plans (building_slug, floor_number);
create index room_zones_space_id_idx
  on public.room_zones (space_id)
  where space_id is not null;

alter table public.floor_plans enable row level security;
alter table public.room_zones enable row level security;

create policy "listed floor plans are publicly readable"
on public.floor_plans
for select
to anon, authenticated
using (is_listed);

create policy "room zones on listed plans are publicly readable"
on public.room_zones
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.floor_plans
    where floor_plans.id = room_zones.floor_plan_id
      and floor_plans.is_listed
  )
);

revoke all on public.floor_plans from anon, authenticated;
revoke all on public.room_zones from anon, authenticated;
grant select on public.floor_plans to anon, authenticated;
grant select on public.room_zones to anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'floor-plans',
  'floor-plans',
  true,
  10485760,
  array['image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

