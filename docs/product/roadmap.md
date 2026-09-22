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
- [ ] Harden the validated MPrint room-extraction prototype ([writeup](../technical/mprint-extraction.md)):
      auto-calibrate dilation radius, validate OCR against `rooms.json`, add
      georeferencing, run across more buildings before trusting the output
- [ ] Apply for our own Waitz API access rather than depending on mguide.app's
      `/api/waitz` proxy (see [ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md))

## Phase 2 — Core features

Ordered by the feasibility read in [Features](features.md): fully-data-ready features
first, then partial ones with their workaround, ratings/crowdsourcing last since it
depends on Phase 1's Supabase schema and produces the data the other gaps need.

- [ ] Map viewer: building footprints + `StudySpace` pins (fully data-ready)
- [ ] Multi-attribute filtering: noise level + `spaceFeatures`/amenities (fully
      data-ready, pending the taxonomy-reconciliation decision from Phase 1)
- [ ] WCAG display controls: high contrast, scalable text, reduced motion (zero data
      dependency — can build in parallel with anything else)
- [ ] Spot detail cards: amenities now, capacity where available (mguide spaces only),
      ratings left as an explicit empty state until crowdsourcing ships
- [ ] Crowdsourced contribution flow (auth + Supabase write path) — unblocks ratings
      and further coverage growth
- [ ] Live occupancy card — blocked on our own Waitz API access (Phase 1) and on
      building the Waitz-ID mapping for the 34 UM Library spaces, which doesn't exist
      yet
- [ ] MPrint floor-plan viewer — start with the plain zoomable image, layer in
      clickable per-zone reviews once the extraction pipeline is hardened (no
      georeferencing needed for this — see
      [Features § Interactive 2D Map Viewer](features.md#interactive-2d-map-viewer)
      and [MPrint Room Extraction](../technical/mprint-extraction.md))

## Phase 3 — Additional features (stretch)

From [Features § Additional Features Enabled by Available Data](features.md#additional-features-enabled-by-available-data),
not in the original proposal but directly supported by sourced data:

- [ ] Accessible route planning between buildings (`pathways.geojson`)
- [ ] Gender-inclusive / wheelchair-accessible restroom finder
- [ ] Accessible parking finder
- [ ] "How to get in" building access cards (ramp/elevator directions)
- [ ] Accessible-classroom/meeting-space finder (`rooms.json` equipment)
- [ ] Real photos on space/building cards
- [ ] Building history/context cards
- [ ] Bus/transit directions to a space
