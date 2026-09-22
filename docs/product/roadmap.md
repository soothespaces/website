# Roadmap

Milestones/phases as they're decided (e.g. per-sprint or per-assignment checkpoints
for EECS 497). Fill in dates and owners once the team commits to a sequence.

## Phase 1 — Data foundation

Seeded from the [Data Sources](../technical/data-sources.md) analysis, now covering
both the original data drop and the wider mguide.app dataset it came from.

- [ ] Commit the full raw data set (buildings, polygons, entrances, curated spaces,
      rooms, restrooms, pathways, parking, dining) into the repo as seed data
- [ ] Write Supabase SQL migrations for the schema in [Data Model](../technical/data-model.md)
- [ ] Seed Supabase from the committed data
- [ ] Design how `rooms.json` (acronym-keyed), `restrooms.json` (slug-keyed), and
      `pathways.geojson` (raw geometry) join into one `buildingSlug`-keyed
      accessibility view instead of four disconnected shapes
- [ ] Decide the lighting-quality taxonomy specifically (noise and adaptive-furniture/
      assistive-listening now have real data via `rooms.json`)
- [ ] Build an MPrint discovery/mirroring script (tag→floor-count mapping beyond the
      112 buildings with an `acronym`, download images rather than hot-linking)
- [ ] Decide how much MPrint digitization to do: raster reference image vs. manually
      hotspotted clickable rooms
- [ ] Design the Waitz proxy route handler — mguide.app's `/api/waitz` confirms the
      proxy-through-backend shape works; we still need our own Waitz credentials/API
      details

## Phase 2 — TBD

- [ ]
