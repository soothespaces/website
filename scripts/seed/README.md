# Seed data

Builds `supabase/seed.sql` (buildings, study spaces with descriptions, LibCal bookable rooms and seats, Library opening hours, building entrances, class meetings, MClassrooms classrooms and printers) from committed snapshots of
public sources. Printers come from `mprint-printers.json`, a trimmed copy of MPrint's
printer list exported by hand (MPrint's API needs a U-M login). MClassrooms rooms come
from `mclassrooms.json`, exported by hand from the logged-in mclassrooms.umich.edu. Entrances come from `scripts/campus-map/raw/` (see
[scripts/campus-map](../campus-map/README.md)). See [Supabase Backend Plan § Seed data](../../docs/technical/supabase-backend.md#seed-data)
for the design.

| File | What |
|---|---|
| `raw/` | Snapshots of each source, plus `SOURCES.md` with URLs and fetch time. Never edit by hand. |
| `overrides.json` | Hand mappings: Library building names and LibCal location ids to slugs, mguide noise and amenity mapping, mguide spaces and LibCal groupings to unlist, classroom and printer building codes. |
| `fetch.mjs` | Pulls every source into `raw/`. |
| `build.mjs` | `raw/` + `overrides.json` to `supabase/seed.sql`, one `-- @section` per table group. |
| `section.mjs` | Prints chosen sections of `seed.sql` as one transaction, to load a single part. |

## Refresh the snapshots

Run `npm run seed:fetch` locally, or run the **Seed snapshot** workflow from the
Actions tab on a branch: it fetches on a GitHub runner and commits `raw/` back to
that branch. Then run `npm run seed:build` and commit `supabase/seed.sql`.

## Where the seed runs

- **Locally:** `npx supabase db reset` (or `db start` on a fresh stack) loads
  `supabase/seed.sql` after the migrations.
- **CI:** the Supabase migrations check loads it too, so a seed that no longer fits the
  schema fails the PR.
- **Production:** the GitHub integration deploys migrations but not the seed. After a
  refresh is merged, run the **Load production data** workflow from the Actions tab and
  pick the part to load (`classroom_meetings`, `printers`, … or `all`); it needs the
  `SUPABASE_DB_URL` repository secret (the Session pooler string). Locally,
  `node scripts/seed/section.mjs <part> | psql "$SUPABASE_DB_URL"` does the same, and
  `psql "$SUPABASE_DB_URL" -f supabase/seed.sql` loads everything. It's
  idempotent: every row is an upsert on its key (`slug`, or `(instance, libcal_item_id)`
  for bookable items), except the Library's `opening_hours` rows, the campus map's `building_entrances`, mguide's `classroom_meetings`, the MClassrooms tables and MPrint's `printers`,
  which are deleted and reinserted so rows the source dropped go away too.
