-- Opening hours, a longer description for spaces, and Google Maps place data
-- per building (snapshotted by a script; the app never calls Google or SerpApi).

alter table public.spaces
  add column description text;

-- Hours come in periods (a semester, exam weeks, a holiday) that each give
-- per-weekday intervals. For a given date, the narrowest period that covers it
-- and lists that weekday wins; ties go to the later valid_from. A weekday can
-- have several intervals (several rows). Times are local (America/Detroit):
--   - opens and closes both null: closed that day;
--   - closes at or before opens: the interval ends the next day, so 08:00-02:00
--     is 8 AM to 2 AM and 10:00-00:00 is 10 AM to midnight;
--   - 00:00-24:00: open all day.
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  building_slug text
    references public.buildings (slug)
    on update cascade
    on delete cascade,
  space_id uuid
    references public.spaces (id)
    on delete cascade,
  label text,
  valid_from date not null,
  valid_until date not null,
  -- 0 = Sunday ... 6 = Saturday, the same as extract(dow from ...).
  weekday smallint not null check (weekday between 0 and 6),
  opens time,
  closes time,
  -- 'public' while anyone can walk in, 'mcard' while only U-M ID holders can
  -- (many U-M buildings are card-access after hours).
  access text not null default 'public' check (access in ('public', 'mcard')),
  source text not null check (source in ('um_library', 'google', 'manual')),
  source_url text,
  constraint opening_hours_one_subject check (num_nonnulls(building_slug, space_id) = 1),
  constraint opening_hours_valid_range check (valid_from <= valid_until),
  constraint opening_hours_times_together check ((opens is null) = (closes is null)),
  constraint opening_hours_nonempty check (opens is distinct from closes or opens is null)
);

create index opening_hours_building_idx
  on public.opening_hours (building_slug, valid_until)
  where building_slug is not null;
create index opening_hours_space_idx
  on public.opening_hours (space_id, valid_until)
  where space_id is not null;

-- One Google Maps place per building, from SerpApi's google_maps place results
-- (see docs/technical/data-sources.md § 11). Refreshed monthly at most.
create table public.google_places (
  building_slug text primary key
    references public.buildings (slug)
    on update cascade
    on delete cascade,
  place_id text not null unique,
  data_id text,
  data_cid text,
  -- Google's own name, address and position, kept to check the match.
  name text not null,
  address text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  types text[] not null default '{}',
  rating numeric(2, 1) check (rating between 1 and 5),
  review_count integer check (review_count >= 0),
  website text,
  phone text,
  located_in text,
  -- "People typically spend 45 min to 1.5 hr here"
  typical_time_spent text,
  hours_last_updated text,
  -- Attribute lists by category, e.g. {"accessibility": ["Wheelchair accessible
  -- entrance"], "amenities": [...]}. unsupported_extensions holds the ones
  -- Google lists as not offered; keep them apart.
  extensions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extensions) = 'object'),
  unsupported_extensions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(unsupported_extensions) = 'object'),
  -- Review topic keywords with mention counts, e.g. [{"keyword": "quiet",
  -- "mentions": 12}]. Never reviewer names or review text.
  review_topics jsonb not null default '[]'::jsonb
    check (jsonb_typeof(review_topics) = 'array'),
  fetched_at timestamptz not null,
  constraint google_place_coordinates_together check ((lat is null) = (lng is null))
);

-- Google's typical busyness curve: 0-100 per weekday and hour, local time.
-- Hours Google doesn't report (usually closed) have no row.
create table public.building_popular_times (
  building_slug text not null
    references public.buildings (slug)
    on update cascade
    on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  hour smallint not null check (hour between 0 and 23),
  busyness smallint not null check (busyness between 0 and 100),
  fetched_at timestamptz not null,
  primary key (building_slug, weekday, hour)
);

alter table public.opening_hours enable row level security;
alter table public.google_places enable row level security;
alter table public.building_popular_times enable row level security;

create policy "opening hours are publicly readable"
on public.opening_hours for select to anon, authenticated using (true);
create policy "google places are publicly readable"
on public.google_places for select to anon, authenticated using (true);
create policy "popular times are publicly readable"
on public.building_popular_times for select to anon, authenticated using (true);

revoke all on public.opening_hours from anon, authenticated;
revoke all on public.google_places from anon, authenticated;
revoke all on public.building_popular_times from anon, authenticated;
grant select on public.opening_hours to anon, authenticated;
grant select on public.google_places to anon, authenticated;
grant select on public.building_popular_times to anon, authenticated;
