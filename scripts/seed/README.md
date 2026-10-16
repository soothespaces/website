# Seed data

Builds `supabase/seed.sql` (buildings, study spaces with descriptions, LibCal bookable rooms and seats, Library opening hours, building entrances, class meetings and printers) from committed snapshots of
public sources. Printers come from `mprint-printers.json`, a trimmed copy of MPrint's
printer list exported by hand (MPrint's API needs a U-M login). Entrances come from `scripts/campus-map/raw/` (see
[scripts/campus-map](../campus-map/README.md)). See [Supabase Backend Plan § Seed data](../../docs/technical/supabase-backend.md#seed-data)
for the design.

| File | What |
|---|---|
| `raw/` | Snapshots of each source, plus `SOURCES.md` with URLs and fetch time. Never edit by hand. |
| `overrides.json` | Hand mappings: Library building names and LibCal location ids to slugs, mguide noise and amenity mapping, mguide spaces and LibCal groupings to unlist, classroom and printer building codes. |
| `fetch.mjs` | Pulls every source into `raw/`. |
| `build.mjs` | `raw/` + `overrides.json` to `supabase/seed.sql`. |

## Refresh the snapshots

Run `npm run seed:fetch` locally, or run the **Seed snapshot** workflow from the
Actions tab on a branch: it fetches on a GitHub runner and commits `raw/` back to
that branch. Then run `npm run seed:build` and commit `supabase/seed.sql`.

## Where the seed runs

- **Locally:** `npx supabase db reset` (or `db start` on a fresh stack) loads
  `supabase/seed.sql` after the migrations.
- **CI:** the Supabase migrations check loads it too, so a seed that no longer fits the
  schema fails the PR.
- **Production:** the GitHub integration deploys migrations but not the seed. Load it
  once after a refresh is merged (`psql "$SUPABASE_DB_URL" -f supabase/seed.sql`). It's
  idempotent: every row is an upsert on its key (`slug`, or `(instance, libcal_item_id)`
  for bookable items), except the Library's `opening_hours` rows, the campus map's `building_entrances`, mguide's `classroom_meetings` and MPrint's `printers`,
  which are deleted and reinserted so rows the source dropped go away too.
