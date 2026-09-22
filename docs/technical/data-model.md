# Data Model

Status: grounded in the first real data drop (see [Data Sources](data-sources.md)) but
not yet turned into Supabase migrations. Entities below reflect the fields we actually
have, plus what the feature set (see [Features](../product/features.md)) still needs
that isn't in the data yet — those are marked TBD.

- **Building** — from the official U-M facilities data + matching GeoJSON polygon
  footprint (466 of each, joined by `slug`). Fields: `slug`, `name`, `preferredName`,
  `acronym`, `address`, `category`, `lat`/`lng`, `website`, `children` (sub-units),
  `floors` (count, not per-floor geometry), `buildingType`, `campus`, `ownership`,
  `classroomCount`, `history` (yearBuilt/architect/style/etc.), `rampAccess` (free-text
  accessibility note, present on 104/466). No MPrint-style interior layout exists in
  the data — see [Data Sources § Gaps](data-sources.md#gaps-relative-to-what-the-app-needs).
- **Entrance** — from OSM, 1,601 points tied to a `buildingSlug`. Fields:
  `entranceType`, `wheelchair`, `automatic`, `access`, `lit`, `covered`, `door`,
  `description`, `osmId`, point geometry. Sparse (e.g. only 96/1,601 have any
  `wheelchair` tag at all) — treat absence as "unknown," never as "no."
- **StudySpace** — 24 curated records today (see [Data Sources § 1](data-sources.md#1-study-spaces-24-records)).
  Fields: `slug`, `name`, `buildingSlug`, `floor` (a label, e.g. "2nd Floor"),
  `lat`/`lng` (currently just the parent building's, not per-floor/room), `amenities`
  (free-form list: wifi, outlets, computers, printing, groupRooms, whiteboards,
  scanners), `noiseLevel` (quiet | moderate | social), `capacity`, `waitzId` (nullable
  — only 6/24 set). TBD: lighting quality and other sensory attributes the product
  overview promises aren't represented by any field yet; adaptive-furniture/physical-
  clearance accessibility attributes are TBD too (not the same as the building's
  `rampAccess`/entrance `wheelchair` tags, which describe getting into the building,
  not the space itself).
- **OccupancyReading** — live crowd density for a space, sourced from Waitz (see
  [Integrations](integrations.md)). TBD — not in the static data by nature (it's a
  runtime API call), and only possible for the 6 spaces that have a `waitzId`.
- **Rating** — community rating/review tied to a StudySpace. TBD, no data yet — this is
  user-generated content the app itself creates.
- **ContributedPin** — a crowdsourced submission (new space, updated barrier/sensory
  tag) tied to an authenticated User, pending or applied to a StudySpace/Building/
  Entrance. TBD, no data yet.
- **User** — authentication identity for the crowdsourced contribution flow, via
  Supabase Auth (Google OAuth, restricted to `@umich.edu` accounts — see
  [ADR 0003](../decisions/0003-supabase-as-backend.md)).

Concrete schemas (fields, types, relationships, RLS policies) still need writing as
Supabase SQL migrations — see [Data Sources § Next Steps](data-sources.md#next-steps).
