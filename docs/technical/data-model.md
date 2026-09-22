# Data Model

Status: grounded in the first real data drop (see [Data Sources](data-sources.md)) but
not yet turned into Supabase migrations. Entities below reflect the fields we actually
have, plus what the feature set (see [Features](../product/features.md)) still needs
that isn't in the data yet — those are marked TBD.

- **Building** — from official U-M facilities data + matching GeoJSON polygon
  footprint, in two overlapping copies: a 466-record mguide.app-derived set (richer:
  `preferredName`, `history`, `buildingType`, `campus`, `ownership`, `classroomCount`)
  and the 265-record official `apibuilder.studentlife.umich.edu` set, which is the
  authoritative source for `rampAccess`/`elevatorAccess`/`acronym` and adds
  **`elevatorAccess`** (free-text, 67/265) alongside `rampAccess` (110/265 official,
  104/466 mguide copy) — see [Data Sources § 8](data-sources.md#8-official-um-student-life-campus-map-higher-authority-source).
  Common fields either way: `slug`, `name`, `acronym`, `address`, `category`, `lat`/
  `lng`, `website`, `children` (sub-units/departments). `floors` is a count, not
  per-floor geometry — no MPrint-style interior layout exists in either building
  dataset itself (MPrint is sourced separately, § 5). The two building sets need
  reconciling into one before migration — see [Data Sources § Next Steps](data-sources.md#next-steps).
- **BuildingPhoto** — from `mapproxy.studentlife.umich.edu/image.php?d={slug}`, per
  building, returns an array of `{path, name}` real photo URLs (confirmed for East
  Quad). Not yet pulled into the repo.
- **AccessibleParking** — from the official `parking` type, point geometry with
  `lotname`, `type` (e.g. "Blue"), `enforcementhours`, and a boolean
  **`accessiblespace`**. The only accessible-parking data found so far.
- **Entrance** — from OSM, 1,601 points tied to a `buildingSlug`. Fields:
  `entranceType`, `wheelchair`, `automatic`, `access`, `lit`, `covered`, `door`,
  `description`, `osmId`, point geometry. Sparse (e.g. only 96/1,601 have any
  `wheelchair` tag at all) — treat absence as "unknown," never as "no."
- **StudySpace** — 24 curated records today (see [Data Sources § 1](data-sources.md#1-study-spaces-24-records)).
  Fields: `slug`, `name`, `buildingSlug`, `floor` (a label, e.g. "2nd Floor"),
  `lat`/`lng` (currently just the parent building's, not per-floor/room), `amenities`
  (free-form list: wifi, outlets, computers, printing, groupRooms, whiteboards,
  scanners), `noiseLevel` (quiet | moderate | social), `capacity`, `waitzId` (nullable
  — only 6/24 set). TBD: lighting quality has no source anywhere yet. Adaptive
  furniture and assistive listening now have a real source (`RoomEquipment` below) but
  only for registrar classrooms, not most of today's 24 curated spaces — still needs
  wiring together. The official `department` type (§ 8) — named lounges/libraries per
  building, e.g. East Quad's `anderson-lounge`, `greene-lounge`, `benzinger-library` —
  is a real candidate list to expand `StudySpace` coverage from, though each still
  needs noise/amenity/accessibility enrichment to become a full record.
- **RoomEquipment** — from `rooms.json` (Registrar Schedule of Classes data), keyed by
  building acronym + room number, not `buildingSlug`/`StudySpace.slug` (needs a join).
  771 rooms across 77 buildings. Fields: `floor`, `type`, `capacity`, `roomType`,
  `equipment` (list, e.g. `wheelchair-instructor`, `assistive-listening`,
  `tables-moveable`/`tables-fixed`, `whiteboard`, `projector`, ...) with a human-
  readable `equipmentDetail` per tag. See [Data Sources § 6](data-sources.md#6-additional-mguideapp-static-data-confirmed-live-not-yet-pulled-in).
  Only covers classrooms/conference rooms in the course catalog, not informal lounges.
- **Restroom** — from `restrooms.json` (Refuge Restrooms), keyed by `buildingSlug`, 87
  buildings. Fields: `floor`, `room`, `accessible` (wheelchair, boolean),
  `changingTable` (boolean), `directions` (free text). Gender-inclusive by source.
- **PathSegment** — from `pathways.geojson` (OSM), 13,817 line-segment features not
  currently tied to any building. Fields: `type` (footway | path | cycleway | steps |
  pedestrian), `wheelchair`, `surface`, `lit`, `covered`, line geometry. The network an
  accessible-routing feature would run on; `wheelchair` coverage is sparse (27 yes / 3
  no / rest untagged).
- **OccupancyReading** — live crowd density for a space, sourced from Waitz (see
  [Integrations](integrations.md)). Not in the static data by nature (it's a runtime
  API call), and only possible for the 6 spaces that have a `waitzId`. mguide.app's
  `/api/waitz` proxy shape (`{ id, name, busyness, trend, subLocs }`, bucketed at
  50/80) is a useful reference for our own shape even though we'll hit Waitz directly.
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
