-- MClassrooms (mclassrooms.umich.edu, LSA Technology Services): general-purpose
-- classrooms with seats, room characteristics, contacts, photos and panoramas.
-- Rows come from scripts/seed/raw/mclassrooms.json (snapshot of the logged-in
-- site; photo and PDF blob URLs on it are public). Classrooms are reference
-- data for candidate study spaces, not spaces themselves.

-- The site's filter vocabulary, with our proposed mapping to space_feature.
create table public.classroom_characteristics (
  value text primary key,
  category text not null,
  label text not null,
  page_label text,
  description text,
  glossary_anchor text,
  space_feature public.space_feature,
  feature_match text check (feature_match in ('exact', 'candidate')),
  constraint feature_with_match check ((space_feature is null) = (feature_match is null))
);

create table public.classrooms (
  mclassrooms_id integer primary key,
  room_code text not null unique,
  building_slug text
    references public.buildings (slug)
    on update cascade,
  building_match text check (building_match in ('official_id', 'record_number', 'abbreviation', 'manual')),
  building_official_id text not null,
  building_name text not null,
  building_code text,
  room_number text,
  floor_label text,
  address text,
  school_or_college text,
  seats integer check (seats > 0),
  characteristics text[] not null default '{}',
  -- Only the exact mappings from classroom_characteristics.
  features public.space_feature[] not null default '{}',
  scheduling_contact jsonb,
  support_contact jsonb,
  notes text,
  notes_updated_on date,
  page_url text not null,
  schedule_url text,
  floor_map_url text,
  layout_pdf_url text,
  panorama_url text,
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array'),
  fetched_on date not null,
  updated_at timestamptz not null default now()
);

create index classrooms_building_slug_idx on public.classrooms (building_slug);
create index classrooms_characteristics_idx on public.classrooms using gin (characteristics);

create trigger classrooms_set_updated_at
before update on public.classrooms
for each row execute function private.set_updated_at();

alter table public.classroom_characteristics enable row level security;
alter table public.classrooms enable row level security;

create policy "classroom characteristics are publicly readable"
on public.classroom_characteristics for select to anon, authenticated using (true);

create policy "classrooms are publicly readable"
on public.classrooms for select to anon, authenticated using (true);

revoke all on public.classroom_characteristics from anon, authenticated;
revoke all on public.classrooms from anon, authenticated;
grant select on public.classroom_characteristics to anon, authenticated;
grant select on public.classrooms to anon, authenticated;
