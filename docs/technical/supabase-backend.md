# Supabase Backend Plan

Status: **implemented on the feature branch, 2026-10-08; not deployed yet.** This turns
[Data Model](data-model.md), the contracts in [Work Breakdown](../product/work-breakdown.md#contracts-agree-on-these-in-one-meeting-on-wed-oct-1)
and ADRs [0003](../decisions/0003-supabase-as-backend.md),
[0007](../decisions/0007-anonymous-check-ins-public-aggregates.md) and
[0008](../decisions/0008-libcal-availability-read-only.md) into one layout: schemas,
tables, RLS, functions, Storage, seed pipeline, and who owns each migration. The
implementation is under `supabase/migrations/`; SQL below documents it.

Already done outside the repo: the Supabase project (`doinwugtdzxxrmvcmemm`), the
Google provider turned on, and email sign-up turned off
([SOS-56](https://linear.app/soothespaces/issue/SOS-56)). Already in the repo:
browser/server clients, the session-refresh proxy, `npm run db:types`, and the PR check
that applies migrations to a throwaway database.

## What the MVP needs from the backend

| # | MVP item | Backend needs | Lo-fi (Oct 16) | Full (Nov 6) |
|---|---|---|---|---|
| 1 | Tokens + components | None | | |
| 2 | App shell | None | | |
| 3 | Settings | `user_settings` table (shape agreed now, sync is P1) | Not needed: localStorage | Table exists, unused until P1 |
| 4 | Map | `buildings` (footprint, center), `spaces` (position) | Yes | Yes |
| 5 | Detail panel | `spaces` fields, `photos` + `photos` bucket, `check_in_summary()`, "has floor plans" lookup | Yes (Library photos) | Yes |
| 6 | List + filters | `spaces.noise_level`, `spaces.features`, `check_in_overview()` | Noise only | All filters |
| 7 | Sign-in | `@umich.edu` gate (auth hook + callback check), redirect URLs | Yes | Yes |
| 8 | Check-ins | `private.check_ins`, `submit_check_in()`, summary functions | Save + counts | Full form, distributions |
| 9 | Floor plans | `floor_plans`, `room_zones`, `floor-plans` Storage bucket | One Shapiro floor | All Shapiro floors + `corners` |

Not needed for the MVP and left out on purpose: Realtime, Edge Functions, PostGIS,
search indexes, admin roles. Each has a note under
[Later packages](#later-packages-p1p2) on where it would plug in.

## Schemas

| Schema | Exposed through the Data API | Holds |
|---|---|---|
| `public` | Yes | Reference data anyone can read, the caller's own `user_settings`, and the RPC functions clients call |
| `private` | **No** | Raw `check_ins` and helper functions. Not in `[api] schemas`, and `anon`/`authenticated` get no grants on it |
| `storage` | Supabase-managed | Buckets for floor plans and photos |
| `auth` | Supabase-managed | Users. We only add a hook; we never write to `auth` tables |

Why raw check-ins live in `private` instead of `public` with an insert-only policy:
ADR 0007 says raw rows and `user_id` must never be readable. In `public`, that relies on
every future policy and grant being right. In a schema the API doesn't expose, a
mistaken grant or policy still can't leak rows. Clients write through one
`security definer` function, which also gives us a single place for the domain check,
rate limit and time-window check. (Worth recording as ADR 0010 once agreed.)

The migrations were applied in order to a clean Postgres database with stubbed
Supabase roles and `auth.uid()`/`auth.jwt()`. The pgTAP suite passed all 26 checks,
`supabase db lint` reported no schema errors, and generated TypeScript types compile.
CI applies and tests them against the complete local Supabase stack.

Grants are written explicitly in every migration. Supabase now lets projects stop
auto-granting new `public` tables to `anon`/`authenticated` (see `auto_expose_new_tables`
in `supabase/config.toml`), so we shouldn't depend on either default.

## Shared types

One migration, `base`, creates the `private` schema and the enums every package uses.
The vocabularies come from UM Library's `fass-data` and the check-in form in
[MVP Scope](../product/mvp-scope.md#terminology-check-in-not-review).

```sql
create schema private;
revoke all on schema private from public, anon, authenticated;

-- Shared by official space data and check-ins, so filters can combine both.
create type public.noise_level as enum ('quiet', 'low_noise', 'conversational', 'loud');
create type public.light_level as enum ('dim', 'moderate', 'bright');
create type public.busyness_level as enum ('empty', 'some_seats', 'half_full', 'mostly_full', 'packed');

-- UM Library spaceFeatures first, then mguide amenities that say something.
-- (mguide's `wifi` is on every record, so it's dropped.)
create type public.space_feature as enum (
  'natural_light', 'wheelchair_accessible', 'all_gender_restroom_on_floor',
  'whiteboards', 'bookable', 'external_monitors',
  'outlets', 'computers', 'printing', 'scanners', 'group_rooms'
);

create type public.space_source as enum ('um_library', 'mguide', 'manual');
```

Noise mapping on import: Library `quiet`/`low_noise`/`conversational` map one to one.
mguide `quiet` → `quiet`, `moderate` → `conversational`, `social` → `loud`. **WP3 to
confirm the mguide mapping.** The check-in form's "step-free access" chip writes
`wheelchair_accessible`, and "all-gender restroom nearby" writes
`all_gender_restroom_on_floor`. Labels are UI copy; the keys stay the Library's.

## Tables

### `public.buildings` (WP3)

```sql
create table public.buildings (
  slug            text primary key,
  name            text not null,
  short_name      text,                -- mguide preferredName
  acronym         text,                -- not unique: `al` is used twice
  official_id     text unique,         -- buildingRecordNumber = official API id
  address         text,
  category        text,
  campus          text,
  lat             double precision,
  lng             double precision,
  footprint       jsonb,               -- GeoJSON Polygon or MultiPolygon, null if none
  floors          smallint,
  website         text,
  ramp_access     text,                -- official API wins over mguide
  elevator_access text,                -- official API only
  extra           jsonb not null default '{}'  -- history, children, buildingType, ...
);
```

- `footprint` is plain GeoJSON in `jsonb`, not PostGIS. The MVP renders footprints and
  never queries them spatially, and supabase-js returns PostGIS columns as hex WKB
  unless you add casts everywhere. Switch to PostGIS when a feature needs a spatial
  query (nearest space, step-free routing).
- The current `buildings-map.geojson` has 526 features for 466 buildings: 23 slugs
  appear more than once (multi-part buildings) and 20 features are points, not
  polygons. The seed build merges polygons per slug into one `MultiPolygon` and drops
  the points.
- About 470 footprints are around 570 KB. Serve them through a cached route handler
  or a static file generated from the table, not a fresh query on every map load.
  `max_rows` is 1000, so one `select` still returns them all.

### `public.spaces` (WP3)

```sql
create table public.spaces (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,    -- stable key so re-seeding upserts, never duplicates
  building_slug text not null references public.buildings (slug) on update cascade,
  name          text not null,
  summary       text,                    -- Library bodySummary
  floor         smallint,
  floor_label   text,                    -- "2nd Floor", "Basement"
  lat           double precision,        -- null = use the building's center
  lng           double precision,
  noise_level   public.noise_level,      -- official tag, not crowd data
  features      public.space_feature[] not null default '{}',
  capacity      integer,                 -- mguide only; Library data has none
  image_url     text,
  image_alt     text,
  source        public.space_source not null,
  source_url    text,
  waitz_id      text,                    -- P1, 6 of 24 mguide spaces have one
  is_listed     boolean not null default true,
  updated_at    timestamptz not null default now()
);
create index on public.spaces (building_slug);
create index on public.spaces using gin (features);
```

- Spaces are never deleted, only unlisted (`is_listed = false`), because check-ins
  reference them.
- Seed rule for overlap: where the Library's 34 spaces cover a building, the mguide
  spaces for that building (for example the three Shapiro floors) are imported with
  `is_listed = false`.
- Library `building` strings map to slugs in the seed script, including "Hatcher
  Library North" and "Hatcher Library South" → one Hatcher building.
- Filters in supabase-js: `.eq('noise_level', 'quiet').contains('features', ['natural_light'])`.

### `public.floor_plans` and `public.room_zones` (WP5)

Columns follow what `scripts/mprint/label_rooms.py export` writes (`size`, `sha256`,
and per room `index`, `roomNumber`, `centroid`, `bbox`).

```sql
create table public.floor_plans (
  id            uuid primary key default gen_random_uuid(),
  building_slug text not null references public.buildings (slug) on update cascade,
  floor_number  smallint not null,
  floor_label   text,
  mprint_tag    text not null,           -- `ulib` for Shapiro
  image_path    text not null,           -- in the floor-plans bucket
  mask_path     text not null,
  width         integer not null,
  height        integer not null,
  source_sha256 text not null,
  corners       jsonb,                   -- [[lng,lat] x4] TL, TR, BR, BL; null until aligned
  unique (building_slug, floor_number)
);

create table public.room_zones (
  id            uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references public.floor_plans (id),
  room_number   text not null,
  mask_index    smallint not null check (mask_index between 1 and 255),
  name          text,                    -- manual override, e.g. "Greene Lounge"
  centroid_x    integer not null,
  centroid_y    integer not null,
  bbox          integer[] not null check (cardinality(bbox) = 4),
  space_id      uuid references public.spaces (id),
  unique (floor_plan_id, room_number),
  unique (floor_plan_id, mask_index) deferrable initially deferred
);
```

Gotcha: `export` numbers mask pixels by sorting room numbers, so adding one room
shifts every `mask_index` after it. The importer must upsert on
`(floor_plan_id, room_number)` and update `mask_index` in place (hence the deferred
unique), so a room's `id`, and the check-ins on it, survive a re-export.

### `private.check_ins` (WP4)

```sql
create table private.check_ins (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id) on delete set null,
  space_id      uuid references public.spaces (id),
  room_zone_id  uuid references public.room_zones (id),
  visited_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  noise         public.noise_level,
  light         public.light_level,
  natural_light boolean,
  busyness      public.busyness_level,
  ease_of_focus smallint check (ease_of_focus between 1 and 5),  -- 5 = very easy
  features      public.space_feature[] not null default '{}',
  constraint one_target check (num_nonnulls(space_id, room_zone_id) = 1),
  constraint has_answer check (
    num_nonnulls(noise, light, natural_light, busyness, ease_of_focus) > 0
    or cardinality(features) > 0
  )
);
alter table private.check_ins enable row level security;  -- and no policies at all
create index on private.check_ins (space_id, visited_at desc) where space_id is not null;
create index on private.check_ins (room_zone_id, visited_at desc) where room_zone_id is not null;
create index on private.check_ins (user_id, created_at desc);
```

- `on delete set null` for users: deleting an account keeps the aggregate stable and
  leaves the row with no link to anyone. **Open question** (cascade is the other
  option).
- No free text, and nothing about the person, per ADR 0007.

### `public.user_settings` (WP2)

```sql
create table public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);
```

Proposed `settings` shape, mirroring the `data-*` attributes planned in
[SOS-52](https://linear.app/soothespaces/issue/SOS-52), so syncing is a straight copy of
the guest's localStorage value:

```jsonc
{
  "theme": "system" | "light" | "dark",
  "contrast": "system" | "more",
  "palette": "default" | "cvd",
  "text": 100 | 112.5 | 125 | 150,
  "motion": "system" | "reduce",
  "defaultView": "map" | "list",
  "needs": {                        // P1, read by WP3 for default filters and ranking
    "noise": ["quiet", "low_noise"],
    "features": ["wheelchair_accessible", "all_gender_restroom_on_floor"]
  }
}
```

Rows are created on first save (upsert from the client), not by a trigger on
`auth.users`, so a bug here can never block sign-in.

### Opening hours and Google places (added 2026-10-09)

Migration `20261009140000_hours_and_google.sql`.

- **`public.spaces.description`:** the "About the space" text from each Library
  space page (plain text, blank-line paragraphs, `- ` list items). `summary` stays the
  one-line teaser.
- **`public.opening_hours`:** one row per (period, weekday, interval) for a building or
  a space. A period is a date range with a `label` ("Fall and winter semester hours",
  "Thanksgiving break hours"). For a date, use the rows of the **narrowest period that
  covers it and lists that weekday** (ties: later `valid_from`); a weekday can have
  several intervals. `opens`/`closes` null means closed; `closes <= opens` ends the next
  day; `00:00`–`24:00` is all day. `access` is `public` or `mcard` for card-only hours.
  The seed loads the Library CMS hours for every Library space and for the buildings
  that are wholly libraries (Shapiro, Hatcher, Taubman HSL), dropping periods that ended
  before the snapshot. Other buildings with a saved Google place get Google's regular week
  (`source = 'google'`, label "Regular hours (Google Maps)"), valid for 120 days from the
  fetch since Google gives no end date.
  Example lookup:

  ```sql
  select h.* from public.opening_hours h
  where h.building_slug = $1 and $2::date between h.valid_from and h.valid_until
    and h.weekday = extract(dow from $2::date)
    and (h.valid_until - h.valid_from, h.valid_from) = (
      select g.valid_until - g.valid_from, g.valid_from from public.opening_hours g
      where g.building_slug = $1 and $2::date between g.valid_from and g.valid_until
        and g.weekday = extract(dow from $2::date)
      order by 1, 2 desc limit 1);
  ```
- **`public.google_places`:** one Google Maps place per building from SerpApi's place
  results: ids (`place_id`, `data_id`, `data_cid`), Google's name/address/position to
  check the match, `types`, `rating`, `review_count`, `website`, `phone`, `located_in`,
  `typical_time_spent`, `hours_last_updated`, `extensions` and `unsupported_extensions`
  (attribute lists by category, e.g. `accessibility`), and `review_topics` (keyword +
  mention count only, never reviewer names or text), plus `fetched_at`.
- **`public.building_popular_times`:** Google's typical 0–100 busyness per building,
  weekday and hour. Hours Google doesn't report have no row.

All three are public read with no client writes, like `buildings`.

### Building entrances (added 2026-10-09)

Migration `20261009150000_building_entrances.sql`. **`public.building_entrances`** has
one row per exterior door from the U-M Facilities & Operations campus map
([Data Sources § 13](data-sources.md#13-u-m-facilities-campus-map-found-2026-10-09)):
position, `accessible` and `automatic` (FO rates every door on both), `keypad`,
`floor_label` as FO writes it (`01`, `0G`, `0B`), `location_description` (FO's
plain-language "east section of the building, 120 feet west of Lurie Tower…") and
survey `notes` ("More than 5 lbs of force required to open"). Doors carry FO's building
record number, which matches `buildings.official_id` or `extra->>'buildingRecordNumber'`;
the seed links 1,281 of 2,653 doors (655 of the 890 accessible ones) to a building
slug. The rest are on buildings we don't list (housing, off-campus offices) and keep the
record number and FO's `building_name`. `id` is FO's GlobalID; the seed replaces every
`source = 'fo_campus_map'` row on each run and leaves `manual` rows alone. Public read,
no client writes.

## RLS and grants

Every table in `public` has RLS enabled. Policies use `(select auth.uid())` rather
than `auth.uid()` so Postgres evaluates it once per query instead of once per row.

| Object | `anon` | `authenticated` | Writes |
|---|---|---|---|
| `buildings`, `spaces`, `floor_plans`, `room_zones` | select | select | Seed and import scripts only (secret key or DB URL, which bypass RLS) |
| `user_settings` | none | select/insert/update/delete own row | Owner |
| `private.check_ins` | none | none | Only through `submit_check_in()` |
| `submit_check_in()` | no execute | execute | |
| `check_in_summary()`, `check_in_overview()` | execute | execute | |
| `hook_before_user_created()` | no execute | no execute | Called by `supabase_auth_admin` only |

Reference tables:

```sql
alter table public.spaces enable row level security;
create policy "spaces are public" on public.spaces
  for select to anon, authenticated using (true);
grant select on public.spaces to anon, authenticated;
revoke insert, update, delete, truncate on public.spaces from anon, authenticated;
```

`user_settings`:

```sql
alter table public.user_settings enable row level security;
create policy "read own settings" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own settings" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own settings" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own settings" on public.user_settings
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.user_settings to authenticated;
```

Rules for every `security definer` function: `set search_path = ''`, schema-qualify
every name, and `revoke execute ... from public, anon, authenticated` before granting
only the roles that need it. Revoking from `public` alone isn't enough: Supabase's
default privileges grant `execute` on new `public` functions (and all privileges on new
`public` tables) to `anon` and `authenticated` directly.

## Auth: `@umich.edu` only

Three layers, matching ADR 0003 and [SOS-58](https://linear.app/soothespaces/issue/SOS-58):

1. **`hd: 'umich.edu'`** on `signInWithOAuth`, so Google pre-selects the UM account.
   UX only; it blocks nothing.
2. **`before_user_created` auth hook** (the real gate). Rejects the sign-up before a
   row reaches `auth.users`:

   ```sql
   create function public.hook_before_user_created(event jsonb)
   returns jsonb language plpgsql as $$
   begin
     if lower(coalesce(event -> 'user' ->> 'email', '')) !~ '^[^@]+@umich\.edu$' then
       return jsonb_build_object('error', jsonb_build_object(
         'http_code', 403, 'message', 'Use your @umich.edu Google account'));
     end if;
     return '{}'::jsonb;
   end $$;
   grant execute on function public.hook_before_user_created to supabase_auth_admin;
   revoke execute on function public.hook_before_user_created from public, anon, authenticated;
   ```

   Turn it on in the dashboard (Authentication → Hooks) for production, and in
   `config.toml` for local:

   ```toml
   [auth.hook.before_user_created]
   enabled = true
   uri = "pg-functions://postgres/public/hook_before_user_created"
   ```

   The anchored regex rejects `x@umich.edu.evil.com` and subdomains such as
   `@med.umich.edu` (**open question** whether those should be allowed).
3. **Callback check** in `src/app/auth/callback/route.ts`: after
   `exchangeCodeForSession`, sign out and redirect with a message if the email isn't
   `@umich.edu`. With the hook in place this should never fire, but it gives a clear
   message if the hook is ever turned off.

`submit_check_in()` checks the domain from the JWT again, so check-ins stay
`@umich.edu`-only even if an account slipped in before the hook was enabled. After
enabling the hook, look for strays once:
`select email from auth.users where email !~* '^[^@]+@umich\.edu$';`

Local development: Google OAuth needs real client credentials, so locally keep email
sign-up on (`[auth.email] enable_signup = true`, already the default) and sign in with
a magic link to any `name@umich.edu` address. Supabase's local mail catcher receives
the email, and the hook still enforces the domain. Production keeps email off.

## Check-in functions (WP4)

**Write:** `supabase.rpc('submit_check_in', { target_kind, target_id, noise, ... })`
does four things, in order:

1. Rejects the call if `auth.uid()` is null or `auth.jwt() ->> 'email'` isn't
   `@umich.edu` (SQLSTATE `42501`, which PostgREST returns as 401/403).
2. Rejects `visited_at` more than 5 minutes in the future or more than 24 hours in the
   past ("I was here earlier today"). This lives in the function, not a `check`
   constraint, because a constraint using `now()` would break on re-validation.
3. Rate limit from ADR 0007: one check-in per user per target per hour. It raises
   `PT429`, which PostgREST turns into HTTP 429, so the UI can say "You checked in here
   recently".
4. Inserts into `private.check_ins` and returns nothing, so no raw row ever goes back
   to the client.

<details>
<summary><code>submit_check_in()</code> (tested)</summary>

```sql
create function public.submit_check_in(
  target_kind text,                 -- 'space' | 'room', the shared target type
  target_id uuid,
  noise public.noise_level default null,
  light public.light_level default null,
  natural_light boolean default null,
  busyness public.busyness_level default null,
  ease_of_focus smallint default null,
  features public.space_feature[] default '{}',
  visited_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_space uuid := case when target_kind = 'space' then target_id end;
  v_room uuid := case when target_kind = 'room' then target_id end;
begin
  if uid is null or lower(coalesce(auth.jwt() ->> 'email', '')) !~ '^[^@]+@umich\.edu$' then
    raise exception 'Sign in with your @umich.edu account to check in' using errcode = '42501';
  end if;
  if v_space is null and v_room is null then
    raise exception 'target_kind must be space or room' using errcode = '22023';
  end if;
  if submit_check_in.visited_at > now() + interval '5 minutes'
     or submit_check_in.visited_at < now() - interval '24 hours' then
    raise exception 'visited_at must be within the last 24 hours' using errcode = '22023';
  end if;
  if exists (
    select 1 from private.check_ins c
    where c.user_id = uid
      and c.space_id is not distinct from v_space
      and c.room_zone_id is not distinct from v_room
      and c.created_at > now() - interval '1 hour'
  ) then
    raise exception 'You checked in here in the last hour' using errcode = 'PT429';
  end if;
  insert into private.check_ins
    (user_id, space_id, room_zone_id, visited_at,
     noise, light, natural_light, busyness, ease_of_focus, features)
  values
    (uid, v_space, v_room, submit_check_in.visited_at,
     submit_check_in.noise, submit_check_in.light, submit_check_in.natural_light,
     submit_check_in.busyness, submit_check_in.ease_of_focus,
     coalesce(submit_check_in.features, '{}'));
end $$;
revoke execute on function public.submit_check_in from public, anon;
grant execute on function public.submit_check_in to authenticated;
```

Parameter names double as the JSON keys in `supabase.rpc()`, so they match the column
names. That's why references inside the body are qualified as `submit_check_in.noise`.

</details>

**Read**, both `stable security definer`, executable by `anon` and `authenticated`:

- `check_in_summary(target_kind, target_id, since interval default '90 days')` →
  `jsonb` for the detail panel and room sheet. Example output:
  `{"count": 2, "last_at": "2026-10-08T18:45:00+00:00", "noise": {"quiet": 2},
  "light": {}, "busyness": {"half_full": 1}, "natural_light": 0,
  "ease_of_focus_median": 2, "features": {"outlets": 1, "natural_light": 1}}`.
  `last_at` is rounded down to 15 minutes.
- `check_in_overview(target_kind, since interval default '90 days')` → one row per
  target (`target_id`, `check_in_count`, `last_at`, `typical_noise`, `typical_light`,
  `ease_of_focus_median`), for list sorting, pin labels ("quiet, 3 check-ins") and
  "quiet by check-ins" filters. One call covers every space instead of one per pin.
  Busyness is left out on purpose: a 90-day "typical" busyness means little, and
  "right now" busyness is WP7's (P1).

<details>
<summary><code>check_in_summary()</code> and <code>check_in_overview()</code> (tested)</summary>

```sql
create function public.check_in_summary(
  target_kind text, target_id uuid, since interval default '90 days'
) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (
    select ci.* from private.check_ins ci
    where case check_in_summary.target_kind
            when 'space' then ci.space_id = check_in_summary.target_id
            when 'room' then ci.room_zone_id = check_in_summary.target_id
          end
      and ci.visited_at > now() - check_in_summary.since
  )
  select jsonb_build_object(
    'count', (select count(*) from c),
    'last_at', (select date_bin('15 minutes', max(c.visited_at), timestamptz 'epoch') from c),
    'noise', (select coalesce(jsonb_object_agg(x.v, x.n), '{}') from
      (select c.noise v, count(*) n from c where c.noise is not null group by 1) x),
    'light', (select coalesce(jsonb_object_agg(x.v, x.n), '{}') from
      (select c.light v, count(*) n from c where c.light is not null group by 1) x),
    'busyness', (select coalesce(jsonb_object_agg(x.v, x.n), '{}') from
      (select c.busyness v, count(*) n from c where c.busyness is not null group by 1) x),
    'natural_light', (select count(*) from c where c.natural_light),
    'ease_of_focus_median', (select percentile_disc(0.5) within group (order by c.ease_of_focus) from c),
    'features', (select coalesce(jsonb_object_agg(x.v, x.n), '{}') from
      (select f v, count(*) n from c, unnest(c.features) f group by 1) x)
  );
$$;
revoke execute on function public.check_in_summary from public, anon, authenticated;
grant execute on function public.check_in_summary to anon, authenticated;

create function public.check_in_overview(
  target_kind text, since interval default '90 days'
) returns table (
  target_id uuid, check_in_count bigint, last_at timestamptz,
  typical_noise public.noise_level, typical_light public.light_level,
  ease_of_focus_median smallint
)
language sql stable security definer set search_path = '' as $$
  select coalesce(ci.space_id, ci.room_zone_id),
         count(*),
         date_bin('15 minutes', max(ci.visited_at), timestamptz 'epoch'),
         mode() within group (order by ci.noise),
         mode() within group (order by ci.light),
         percentile_disc(0.5) within group (order by ci.ease_of_focus)
  from private.check_ins ci
  where ci.visited_at > now() - check_in_overview.since
    and case check_in_overview.target_kind
          when 'space' then ci.space_id is not null
          when 'room' then ci.room_zone_id is not null
        end
  group by 1;
$$;
revoke execute on function public.check_in_overview from public, anon, authenticated;
grant execute on function public.check_in_overview to anon, authenticated;
```

</details>

Neither returns `user_id`, row IDs or exact timestamps. **Open question:** should
per-value distributions be hidden below a minimum count (say 3)? A distribution built
from one check-in shows that person's answers, though not who they are.

**Open question:** should a room check-in also count toward its parent space
(`room_zones.space_id`)? Proposed: no for the MVP. Show them separately, and let the
space summary include rooms later if testing shows sparse data.

## Storage (WP5, WP3)

| Bucket | Public | Contents | Written by |
|---|---|---|---|
| `floor-plans` | Yes | `{building_slug}/{floor_number}/plan.png` and `mask.png` | WP5 import script, secret key |
| `photos` | Yes | Building and space photos, pre-resized (see [Photos](#photos)) | WP3 photo script, secret key |

Public buckets serve through the CDN URL with no `storage.objects` policies, and with
no insert policies only the secret key can write. Create buckets in a migration
(`insert into storage.buckets ...`) so production gets them, and also under
`[storage.buckets.*]` in `config.toml` for local. User photos (P2) would need a
separate **private** bucket with moderation; they don't belong in either bucket above.

### Photos

**Decision: resize once in a script, store in Supabase Storage, serve the files
straight from Supabase's CDN, and keep one row per photo in `public.photos`.** Photos
are data about buildings, like footprints, so they live next to that data instead of
in the app's code.

| Option | Verdict |
|---|---|
| Commit to `public/`, served by Vercel | **No** for building photos. Git keeps every version forever, so a few hundred photos bloat every clone. Adding a photo needs a code change and a deploy. There's no link to a building row. Fine for a handful of UI images (landing hero, empty states). |
| Supabase Storage + Vercel resizing (`next/image` default) | **Works, but has a hard cap.** Vercel Hobby includes 5,000 image transformations a month. Past that, new images return HTTP 402 and show their `alt` text instead. Each width × format of each photo counts, and so does each re-check after the cache goes stale. |
| Supabase Storage + Supabase resizing | **Not available.** Image transformations are Pro-only. |
| **Supabase Storage, pre-resized** | **Chosen.** No transformations at request time, so no quota to hit. Costs 1 GB storage and 5 GB cached egress on the Free plan. 200 photos × 3 widths × about 80 KB is about 50 MB stored. About 120 KB per detail-panel view is roughly 40,000 photo views a month inside the free egress. |
| Hot-link the original URLs | **No.** Links break, pages slow down, and the source site sees every visitor's IP, which cuts against our privacy promise. |

**Script** (`scripts/photos/`, WP3), run locally with the secret key:

1. Read `scripts/photos/photos.json`, a committed list of entries:
   `{ building_slug | space_slug, file | source_url, alt, credit, license, kind?,
   floor?, lat?, lng?, heading? }`. The format is in
   [scripts/photos/README.md](../../scripts/photos/README.md).
2. Download each photo. Use `sharp` to auto-rotate it and strip EXIF (EXIF can include
   the photographer's GPS location), then write WebP at widths 480, 960 and 1600
   (never upscaled), quality 75.
3. Upload to `photos/{buildings|spaces}/{slug}/{photo_id}-{width}.webp` with
   `cacheControl: '31536000'`. Every re-export gets a new `photo_id`, so the long
   cache is never wrong.
4. Upsert the `public.photos` row.

The script is `scripts/photos/import.mjs` (`npm run photos:import`). Files are named
by a hash of the original, so re-runs are safe; `--prune` deletes rows no longer in
`photos.json`.

**Placement and panoramas (added 2026-10-09, migration
`20261009130000_photo_placement.sql`).** The team's own photos say where they were
taken, so the app can show the photos nearest a room or bookable item instead of only
"photos of this building":

- `floor`, plus `lat`/`lng` of where the photographer stood and an optional
  `heading` (compass direction faced). Map coordinates, not floor-plan pixels: MPrint
  crops each floor differently, while each `floor_plans.corners` ties its image to the
  map, so a room centroid converts to lat/lng for a nearest-photo lookup and placements
  survive re-exports or vectorized plans. Place them by clicking a map, not from phone
  GPS.
- `kind` is `photo` or `panorama`. Panoramas are 2:1 equirectangular images (for
  example from the Ricoh Theta Z1 in the U-M equipment loan catalog), stored at widths
  2048 and 4096 for a 360° viewer such as Pannellum or Photo Sphere Viewer.
- `source_url` is now optional, since team photos have no page to link to.

```sql
create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  building_slug text references public.buildings (slug) on update cascade,
  space_id      uuid references public.spaces (id),
  path_prefix   text not null,          -- photos/buildings/shapiro/<id>; files are <prefix>-<width>.webp
  widths        smallint[] not null,    -- widths actually generated, e.g. {480,960,1600}
  width         integer not null,       -- original size, for aspect ratio (no layout shift)
  height        integer not null,
  alt           text not null check (length(trim(alt)) > 0),
  credit        text not null,          -- "University of Michigan Library", "Jane Doe / Wikimedia Commons"
  license       text not null,          -- "UM, used with credit", "CC BY-SA 4.0", ...
  source_url    text not null,
  sort_order    smallint not null default 0,
  is_listed     boolean not null default true,
  constraint one_subject check (num_nonnulls(building_slug, space_id) = 1)
);
create index on public.photos (building_slug, sort_order) where building_slug is not null;
create index on public.photos (space_id, sort_order) where space_id is not null;
-- RLS and grants: same "public read, no client writes" pattern as `spaces`.
```

`alt` is required: for this app, a photo without alt text is a bug. The Library's
`fass-data` ships `imageAlt` for its 34 spaces. Every other photo needs alt text
written as it's added.

**Rendering:** use `next/image` with a custom `loader` that returns the nearest
generated width (`${base}/${path_prefix}-${w}.webp`), so Vercel never transforms
anything. Use `sizes` that match the panel layout, `width`/`height` from the row so
nothing shifts while it loads, and lazy loading by default. Show `credit` under the
photo, linked to `source_url` when the license requires attribution.

**Which photos we may use:**

| Source | OK? | Notes |
|---|---|---|
| UM Library `fass-data` `imageUrl` (§ 9) | Yes, with credit | UM's own photos of its spaces, with alt text already written |
| `mapproxy.studentlife.umich.edu/image.php?d={slug}` (§ 8) | Yes, with credit | UM's official campus map photos |
| Wikimedia Commons | Yes | Follow each file's license (usually CC BY or CC BY-SA): credit the author and name the license |
| Photos the team takes | Yes | Best for interiors, and lets us control what's shown |
| Google Maps or SerpApi photos, Yelp, news sites, blogs | **No** | Uploaders or publishers hold the copyright, and Google's terms forbid re-hosting |

The `license` and `credit` columns are `not null`, so an unlicensed photo can't get in
by accident.

## Seed data

### Is the raw data in the repo? Yes, since 2026-10-09

Snapshots of the MVP sources are now committed under `scripts/seed/raw/` (see
[scripts/seed/README.md](../../scripts/seed/README.md)). Before that, as checked on
every branch and the full git history on 2026-10-08, the only data file
anywhere is `scripts/mprint/labels/ulib_2.json` (Shapiro floor 2 room labels). Missing:

| Source | Records | Status |
|---|---|---|
| Original `data.json` drop (4 concatenated JSON values) | 24 spaces, 466 footprints, 466 buildings, 1,601 entrances | Never committed. [Data Sources](data-sources.md) says so |
| UM Library `fass-data` + `fass-icon-map` | 34 spaces | Not pulled |
| Official `apibuilder.studentlife.umich.edu` `building` | 265 | Not pulled |
| mguide `rooms.json`, `restrooms.json` | 771 rooms, 87 buildings | Not pulled (P1/P2) |
| MPrint Shapiro images | | Fetched by URL in the README, not committed (by design) |

Nothing is lost: every source still answers. The original drop is four separate files
on mguide.app, so the snapshot can be rebuilt exactly:

| `data.json` part | Live file |
|---|---|
| 24 study spaces | `https://mguide.app/data/study-spots.json` |
| 466 footprints | `https://mguide.app/data/buildings-map.geojson` (now 526 features, see above) |
| 466 buildings | `https://mguide.app/data/buildings-meta.json` |
| 1,601 entrances | `https://mguide.app/data/entrances.geojson` |

The footprint count already drifted between the drop and today, which is the argument
for committing a dated snapshot rather than fetching at build time.

### Pipeline

```
scripts/seed/
  fetch.mjs         pulls every source into raw/, writes raw/SOURCES.md (URL + date)
  raw/              committed snapshots, one file per source, never hand-edited
  overrides.json    hand mappings: Library building name → slug, noise mapping, unlisted mguide spaces
  build.mjs         raw/ + overrides → supabase/seed.sql (idempotent upserts)
supabase/seed.sql   generated, committed, loaded by `supabase db reset` locally
```

- `seed.sql` uses `insert ... on conflict (slug) do update` (`(instance, libcal_item_id)`
  for bookable items), so it's safe to run again.
- Production: migrations deploy through the Supabase GitHub integration on merge, but
  that doesn't run `seed.sql`. The WP3 owner runs it once against production with
  `psql "$SUPABASE_DB_URL" -f supabase/seed.sql`, and again after each snapshot
  refresh.
- Floor plans don't go through `seed.sql`. WP5's import script runs `label_rooms.py
  export`, uploads `plan.png`/`mask.png` to Storage and upserts `floor_plans` and
  `room_zones` with the secret key. Hand-aligned Shapiro `corners` go in a committed
  JSON file the importer reads.
- The secret key and DB URL stay on the machine running the import (or a GitHub
  Actions secret). They never go in Vercel's public env vars or the browser.

Sizes to commit: about 2.5 MB of raw JSON for the MVP sources. `pathways.geojson`
(4.2 MB) waits until routing is actually planned.

## Migration files and owners

Timestamps fix the order, since later files reference earlier tables.

```
supabase/migrations/
  20261008193000_base.sql                  shared   private schema, enums
  20261008193100_auth_umich_only.sql       WP4      before_user_created hook
  20261008193200_places.sql                WP3      buildings/spaces, RLS, grants
  20261008193300_floor_plans.sql           WP5      tables, RLS, floor-plans bucket
  20261008193400_check_ins.sql             WP4      private.check_ins, submit_check_in()
  20261008193500_check_in_aggregates.sql   WP4      check_in_summary(), check_in_overview()
  20261008193600_user_settings.sql         WP2      table, owner-only RLS
  20261008193700_photos.sql                WP3      metadata, RLS, photos bucket
  20261009120000_bookable_items.sql        WP6      LibCal rooms and seats
  20261009130000_photo_placement.sql       WP3      photo kind, floor, position, heading
  20261009140000_hours_and_google.sql      WP3      opening_hours, google_places, popular times
  20261009150000_building_entrances.sql    WP3      exterior doors from the FO campus map
supabase/tests/
  mvp_backend.test.sql                     shared   pgTAP, run by `supabase test db`
  bookable_items.test.sql, photo_placement.test.sql, hours_and_google.test.sql,
  building_entrances.test.sql              per-migration checks
```

After each merge, run `npm run db:types` so `src/types/supabase.ts` matches.

### Database tests

The migrations workflow runs `npx supabase test db`. The suite covers:

- `anon` can select `spaces` but can't insert, update or delete it.
- `anon` and `authenticated` get a permission error on `private.check_ins`.
- `anon` can't execute `submit_check_in()`. An `authenticated` JWT with a non-umich
  email is rejected. A umich JWT succeeds once, then hits the rate limit.
- `check_in_summary()` output has no `user_id` and only 15-minute timestamps.
- A user can read and write their own `user_settings` row and can't see anyone else's.
- The hook returns an error for `a@gmail.com` and `a@umich.edu.evil.com`, and `{}` for
  `a@umich.edu`.

## Order of work to the lo-fi build

| Target | What | Who | Unblocks |
|---|---|---|---|
| Oct 9 | Agree this plan (open questions below), merge `base` | All | Everyone's migrations |
| Oct 10 | `buildings_spaces` + raw snapshots + `seed.sql`, seeded in production | WP3 | Map pins, detail panel (SOS-33, SOS-34) |
| Oct 10 | Auth hook + callback check, redirect URLs set | WP4 | Sign-in end to end (SOS-58, SOS-56) |
| Oct 12 | `check_ins` + `submit_check_in()` + a count-only `check_in_summary()` | WP4 | Lo-fi check-in (SOS-38) |
| Oct 12 | `floor_plans` + bucket + Shapiro floor 2 imported | WP5 | Floor-plan panel (SOS-40) |
| Oct 14 | Integration on a preview deploy | All | SOS-43 |
| Nov 6 | Full summaries, `check_in_overview()`, `user_settings`, RLS tests, all Shapiro floors with `corners` | WP2, WP4, WP5 | MR deliverable |

## Later packages (P1/P2)

These are sketched so the MVP schema doesn't box them in. None need changes to the
MVP tables beyond what's above.

- **WP6 LibCal:** `public.bookable_items` exists since 2026-10-09 (migration
  `20261009120000_bookable_items.sql`), seeded from `raw/libcal-items.json`: PK
  `(instance, libcal_item_id)`, `lid`, `kind` (LibCal's own `space`/`seat`, since
  "spaces" include booths and game stations, not just rooms), `title`,
  `location_name`, `grouping`, `building_slug`, `floor`, `room_number`, `capacity`,
  `booking_url`, `thumbnail_url`, `is_listed`, and nullable `space_id`/`room_zone_id`
  for later joins. Listed rows are public read. Availability itself is cached by
  the Next.js route handler (`revalidate: 300`), not stored. Add a
  `private.availability_cache` table only if the Vercel cache turns out not to be
  enough. Never store who booked what (ADR 0008).
- **WP7 busyness:** Waitz goes through a route handler keyed on `spaces.waitz_id`, with
  nothing stored. "Recent check-ins" is `check_in_summary(..., since => '3 hours')`.
  Weekday × hour patterns (P2) are a `check_in_patterns()` function over the same
  table. Simulated demo data goes in a separate seed file, never production.
  The tables for Google popular times via SerpApi
  ([Data Sources § 11](data-sources.md#11-serpapi-google-maps-data-through-a-paid-scraping-api-researched-2026-10-08))
  exist since 2026-10-09 (see [Opening hours and Google places](#opening-hours-and-google-places)):
  a monthly script, not yet written, fills `public.google_places` and
  `public.building_popular_times`. The app reads only these tables, never SerpApi.
  The key stays in the script's environment as `SERPAPI_API_KEY`, never `NEXT_PUBLIC_*`.
- **WP2 needs profile and sync:** already covered by `user_settings.settings.needs`.
- **WP3 search:** across about 60 spaces and 470 buildings, client-side filtering is
  enough. Add `pg_trgm` indexes only if search moves server-side.
- **WP5 alignment tool:** needs someone allowed to write `floor_plans.corners`.
  Simplest is running the tool locally with the secret key. If it has to run on the
  deployed site, add `private.admins (user_id)` and an update policy on `floor_plans`
  that checks it.
- **WP3 accessibility layer (P2):** `entrances` (point, `building_slug`, OSM tags),
  `restrooms` (`building_slug`, `floor`, `accessible`, `changing_table`),
  `room_equipment` (acronym + room number → `room_zones`), all public read. This is
  probably when PostGIS earns its place.
- **Realtime:** not needed. If it's ever turned on, `private.check_ins` must never be
  added to the publication.

## Open questions

1. mguide noise mapping: `moderate` → `conversational` and `social` → `loud`? (WP3)
2. Exactly `@umich.edu`, or also subdomains like `@med.umich.edu`? (WP4)
3. Account deletion: anonymize check-ins (`set null`, proposed) or delete them? (WP4)
4. Minimum count before per-value distributions are shown? (WP4)
5. Room check-ins roll up into the parent space's summary: not for the MVP? (WP4, WP5)
6. Building base list: mguide's 466 with official fields layered on top by
   `official_id` (proposed), or the official 265? (WP3)
