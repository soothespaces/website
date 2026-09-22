# Roadmap

Milestones/phases as they're decided (e.g. per-sprint or per-assignment checkpoints
for EECS 497). Fill in dates and owners once the team commits to a sequence.

## Phase 1 — Data foundation

Seeded from the [Data Sources](../technical/data-sources.md) analysis of the first
data drop.

- [ ] Commit raw data (buildings, polygons, entrances, curated spaces) into the repo
      as seed data
- [ ] Write Supabase SQL migrations for the schema in [Data Model](../technical/data-model.md)
- [ ] Seed Supabase from the committed data
- [ ] Decide the sensory/environmental data taxonomy (noise is covered; lighting and
      other sensory dimensions are not yet)
- [ ] Decide the accessibility-data strategy (building `rampAccess` text + sparse
      entrance `wheelchair` tags need a plan to become reliable, connected data)
- [ ] Build an MPrint discovery/mirroring script (tag→floor-count mapping beyond the
      112 buildings with an `acronym`, download images rather than hot-linking)
- [ ] Decide how much MPrint digitization to do: raster reference image vs. manually
      hotspotted clickable rooms

## Phase 2 — TBD

- [ ]
