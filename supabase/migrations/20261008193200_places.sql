-- WP3: campus buildings and study spaces.

create table public.buildings (
  slug text primary key,
  name text not null check (length(trim(name)) > 0),
  short_name text,
  acronym text,
  official_id text unique,
  address text,
  category text,
  campus text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  footprint jsonb check (
    footprint is null
    or (
      jsonb_typeof(footprint) = 'object'
      and footprint ->> 'type' in ('Polygon', 'MultiPolygon')
    )
  ),
  floors smallint check (floors > 0),
  website text,
  ramp_access text,
  elevator_access text,
  extra jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extra) = 'object')
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  building_slug text not null
    references public.buildings (slug)
    on update cascade,
  name text not null check (length(trim(name)) > 0),
  summary text,
  floor smallint,
  floor_label text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  noise_level public.noise_level,
  features public.space_feature[] not null default '{}',
  capacity integer check (capacity > 0),
  image_url text,
  image_alt text,
  source public.space_source not null,
  source_url text,
  waitz_id text,
  is_listed boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint space_coordinates_together check (
    (lat is null) = (lng is null)
  ),
  constraint image_alt_with_image check (
    image_url is not null or image_alt is null
  )
);

create index spaces_building_slug_idx
  on public.spaces (building_slug);
create index spaces_features_idx
  on public.spaces using gin (features);
create index spaces_listed_noise_idx
  on public.spaces (noise_level)
  where is_listed;

create trigger spaces_set_updated_at
before update on public.spaces
for each row execute function private.set_updated_at();

alter table public.buildings enable row level security;
alter table public.spaces enable row level security;

create policy "buildings are publicly readable"
on public.buildings
for select
to anon, authenticated
using (true);

create policy "listed spaces are publicly readable"
on public.spaces
for select
to anon, authenticated
using (is_listed);

revoke all on public.buildings from anon, authenticated;
revoke all on public.spaces from anon, authenticated;
grant select on public.buildings to anon, authenticated;
grant select on public.spaces to anon, authenticated;

