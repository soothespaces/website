# Roadmap

Milestones/phases as they're decided (e.g. per-sprint or per-assignment checkpoints
for EECS 497). Fill in dates and owners once the team commits to a sequence.

## Phase 1 — Data foundation

Seeded from the [Data Sources](../technical/data-sources.md) analysis, now covering
the original data drop, the wider mguide.app dataset it came from, UM's official
campus map API, and UM Library's own "Find Study Space" data.

- [ ] Commit UM Library's `fass-data`/`fass-icon-map` (34 official study spaces, 7
      libraries) as the primary `StudySpace` seed and adopt its `spaceFeatures`/
      `noiseLevel` taxonomy as the schema standard — do this first, highest quality
- [ ] Commit the rest of the raw data set into the repo as seed data: mguide.app's
      buildings, polygons, entrances, curated spaces, rooms, restrooms, pathways,
      parking, dining; and the official `building`/`department`/`parking` types +
      building photos
- [ ] Reconcile the two building sets (official 265 vs. mguide-derived 466) into one,
      preferring official `rampAccess`/`elevatorAccess`/`acronym` where they overlap
- [ ] Write Supabase SQL migrations for the schema in [Data Model](../technical/data-model.md)
- [ ] Seed Supabase from the committed data
- [ ] Design how `rooms.json` (acronym-keyed), `restrooms.json` (slug-keyed),
      `pathways.geojson` (raw geometry), and `parking`'s `accessiblespace` join into one
      `buildingSlug`-keyed accessibility view instead of seven disconnected shapes
- [ ] Evaluate official `department` records (named lounges/libraries per building) as
      seed candidates for expanding `StudySpace` coverage beyond libraries
- [ ] Decide how to extend the `spaceFeatures`/`noiseLevel` taxonomy to non-library
      spaces (dorm lounges, department-listed rooms) via survey or crowdsourcing
- [ ] Build an MPrint discovery/mirroring script (tag→floor-count mapping beyond the
      112 buildings with an `acronym`, download images rather than hot-linking)
- [ ] Decide how much MPrint digitization to do: raster reference image vs. manually
      hotspotted clickable rooms
- [ ] Apply for our own Waitz API access rather than depending on mguide.app's
      `/api/waitz` proxy (see [ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md))

## Phase 2 — TBD

- [ ]
