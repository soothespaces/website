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
- [ ] Decide whether per-floor interior mapping stays in scope without MPrint data, or
      the MVP ships building-level pins + a floor/room list instead

## Phase 2 — TBD

- [ ]
