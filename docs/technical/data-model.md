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
- **StudySpace** — two sources, of different quality. **Primary: UM Library's own 34
  official records** (see [Data Sources § 9](data-sources.md#9-um-librarys-own-find-study-space-tool-best-source-yet-purpose-built)),
  fields `title`, `slug` (detail page path), `bodySummary` (description),
  `spaceFeatures` (`natural_light`, `wheelchair_accessible`,
  `all_gender_restroom_on_floor`, `whiteboards`, `bookable`, `external_monitors`),
  `noiseLevel` (`quiet` | `conversational` | `low_noise`), `building` (a name string,
  needs mapping to `buildingSlug` — not 1:1: Hatcher North/South are two `building`
  values for one building), `campus`, `imageUrl`/`imageAlt`. This is the taxonomy to
  standardize on — adopt `spaceFeatures`/`noiseLevel` as *the* schema fields rather
  than inventing new ones, since it already covers what generic amenity/noise tags
  didn't (lighting, per-space wheelchair/restroom accessibility). Only 7 libraries,
  no capacity/hours. **Secondary: 24 mguide.app-derived records** (see
  [Data Sources § 1](data-sources.md#1-study-spaces-24-records)) covering non-library
  buildings the primary source doesn't touch — `slug`, `name`, `buildingSlug`, `floor`,
  `lat`/`lng` (building-level), `amenities` (wifi/outlets/computers/printing/
  groupRooms/whiteboards/scanners — generic, not the § 9 taxonomy), `noiseLevel`
  (`quiet`/`moderate`/`social` — a different 3-tier scale than § 9's, needs
  reconciling), `capacity`, `waitzId` (only 6/24 set). Migrating these onto the § 9
  taxonomy (mapping generic amenities → `spaceFeatures` where possible, e.g. inferring
  `wheelchair_accessible` isn't safe without real data) is TBD. The official
  `department` type (§ 8) — named lounges/libraries per building, e.g. East Quad's
  `anderson-lounge`, `greene-lounge`, `benzinger-library` — is a real candidate list to
  expand coverage further, though each still needs § 9-style tagging to become a full
  record.
- **FloorPlan** — one MPrint image (`buildingSlug` + `mprintTag` + `floorNumber`), plus
  its **map anchor**: the calibration (a handful of real-world corner coordinates)
  that places the image as a whole at the building's position on the outdoor map, for
  a seamless map→floor zoom (see [MPrint Room Extraction](mprint-extraction.md)). TBD,
  not yet attempted — without it the floor plan can still be shown (e.g. on building
  click, as a panel), just not as a continuous geographic zoom.
- **RoomZone** — a clickable region within a `FloorPlan`, produced by the extraction
  prototype. **This is the primary unit user-generated content attaches to** —
  ratings, photos, whatever — not a side effect of a coarser `StudySpace` record.
  Fields: `floorPlanId`, `roomNumber` (OCR'd label, e.g. "1808"), and a reference to
  that floor plan's label mask (a small raster the same size as the image — no
  polygon/vector shape needed, since a zone only needs to be clickable on the
  displayed image itself; see the linked doc for why per-room geometry doesn't need
  its own real-world coordinates even though the `FloorPlan` it belongs to does).
  Where `roomNumber` matches a `RoomEquipment` entry (below), that metadata applies;
  where it doesn't (e.g. a named lounge like East Quad's Greene Lounge, room 1808), it
  needs a manual override entry (name, type).
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
- **Rating** and **Photo** — community review/photo, tied to a `RoomZone` where a
  building has floor-plan data (the primary, fine-grained case per the product
  design), or to a `StudySpace` directly where it doesn't. Both TBD, no data yet —
  this is user-generated content the app itself creates.
- **ContributedPin** — a crowdsourced submission (new space, updated barrier/sensory
  tag) tied to an authenticated User, pending or applied to a StudySpace/Building/
  Entrance. TBD, no data yet.
- **User** — authentication identity for the crowdsourced contribution flow, via
  Supabase Auth (Google OAuth, restricted to `@umich.edu` accounts — see
  [ADR 0003](../decisions/0003-supabase-as-backend.md)).

Concrete schemas (fields, types, relationships, RLS policies) still need writing as
Supabase SQL migrations — see [Data Sources § Next Steps](data-sources.md#next-steps).
