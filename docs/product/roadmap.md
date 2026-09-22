# Roadmap

Milestones/phases as they're decided (e.g. per-sprint or per-assignment checkpoints
for EECS 497). Fill in dates and owners once the team commits to a sequence.

## Phase 1 — Data foundation

Seeded from the [Data Sources](../technical/data-sources.md) analysis, now covering
the original data drop, the wider mguide.app dataset it came from, and UM's own
official campus map API.

- [ ] Commit the full raw data set into the repo as seed data: mguide.app's buildings,
      polygons, entrances, curated spaces, rooms, restrooms, pathways, parking, dining;
      and the official `building`/`department`/`parking` types + building photos
- [ ] Reconcile the two building sets (official 265 vs. mguide-derived 466) into one,
      preferring official `rampAccess`/`elevatorAccess`/`acronym` where they overlap
- [ ] Write Supabase SQL migrations for the schema in [Data Model](../technical/data-model.md)
- [ ] Seed Supabase from the committed data
- [ ] Design how `rooms.json` (acronym-keyed), `restrooms.json` (slug-keyed),
      `pathways.geojson` (raw geometry), and `parking`'s `accessiblespace` join into one
      `buildingSlug`-keyed accessibility view instead of six disconnected shapes
- [ ] Evaluate official `department` records (named lounges/libraries per building) as
      seed candidates for expanding `StudySpace` coverage beyond the 24 curated today
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
