# Data Sources

Status: analysis of the first data drop (`data.json`, 2.7MB, not yet committed to the
repo — see [Next Steps](#next-steps); still true on 2026-10-08, and each of its four
parts is a live mguide.app file, see
[Supabase Backend Plan § Seed data](supabase-backend.md#seed-data)), plus MPrint interior floor plans confirmed as a
separate, usable source. It's actually four separate top-level JSON values
concatenated in one file, not one JSON document:

| # | Shape | Count | Content |
|---|-------|-------|---------|
| 1 | array | 24 | Hand-curated study spaces |
| 2 | GeoJSON `FeatureCollection` (Polygon) | 466 | Building footprints, for map rendering |
| 3 | array | 466 | Building metadata (official U-M facilities data) |
| 4 | GeoJSON `FeatureCollection` (Point) | 1,601 | Building entrances (OSM-derived) |

All four are keyed by `slug` (spaces reference `buildingSlug`; every `buildingSlug` in
the spaces array and every polygon's `slug` resolves to a record in the buildings
array — checked, zero orphans either direction).

**Provenance, now confirmed precisely**: this is a subset of the static data files that
power [mguide.app](https://mguide.app/), a third-party UM campus map built with
React + MapLibre GL. Its JS bundles (fetched and grepped directly — no browser needed)
reveal the full picture:

- Most of its data — buildings, footprints, entrances, study spots, dining, parking,
  restrooms, pathways, transit, etc. — is served as **static JSON/GeoJSON files at
  `https://mguide.app/data/*`**, same-origin, no auth, no CORS restriction. This is
  presumably itself built from official UM facilities/OSM/Registrar data (field shapes
  like `buildingRecordNumber` and OSM `osmId` support that), but mguide.app is the
  immediate source, not UM directly.
- A small amount of genuinely live data — real-time Waitz occupancy and campus safety
  incidents — goes through mguide's own backend at `https://api.mguide.app`, which
  itself proxies the upstream services rather than exposing them straight from the
  browser. See [§ 7](#7-mguideapp-live-api-confirmed) for both.

Since this is someone else's app, not an official UM data feed or a documented public
API: treat field completeness/accuracy as "best effort," don't assume the endpoints are
stable or intended for third-party use long-term, and be a considerate client if
pulling more (mirror data rather than hot-linking or polling `/data/*` at request time
in production — see [Next Steps](#next-steps)). Committing what we pull into the repo
now matters precisely because none of this is guaranteed to still be there later.

## 1. Study spaces (24 records)

```jsonc
{
  "slug": "shapiro-library-1f",
  "name": "Shapiro Library — 1st Floor",
  "buildingSlug": "harold-t-and-vivian-b-shapiro-library",
  "floor": "1st Floor",
  "lat": 42.27570, "lng": -83.73721,   // building-level coords, not per-floor
  "amenities": ["wifi", "outlets", "printing", "scanners"],
  "noiseLevel": "quiet",                // quiet | moderate | social
  "capacity": 120,
  "waitzId": "shapiro-1"                // null for most records
}
```

This is essentially the `StudySpace` entity from [Data Model](data-model.md), already
shaped almost exactly right. Coverage is thin, though:

- Only **17 of 466 buildings** have any curated space at all (6 Library/Museum, 5
  Academic, 3 Housing, 3 Student Life — nothing in Medical, Administrative, Athletic,
  Parking).
- Amenity vocabulary in use: `wifi`, `outlets`, `computers`, `printing`, `groupRooms`,
  `whiteboards`, `scanners`. `wifi` and `outlets` are on every record — not
  discriminating. No amenity for lighting quality, adaptive furniture, or sensory
  accommodations, despite those being core to the product's pitch.
- `noiseLevel` distribution: 10 quiet, 10 moderate, 4 social — a manual/estimated tag,
  not a measured value.
- Only **6 of 24** have a `waitzId` (i.e. can show live occupancy at all).
- All floors of the same building share identical `lat`/`lng` (e.g. all 3 Shapiro
  floors) — fine for a building-level pin, not enough to place distinct per-floor pins
  on an indoor map.

## 2 & 3. Buildings (466 records + matching polygons)

Rich, official-looking U-M facilities data (`buildingRecordNumber`, `buildingPhase`,
architectural `history`), joined 1:1 with GeoJSON polygon footprints:

```jsonc
{
  "id": 7, "name": "Ann and Robert H. Lurie Biomedical Engineering Building",
  "preferredName": "Lurie Biomedical Engineering", "slug": "ann-and-robert-h-lurie-biomedical-engineering-building",
  "acronym": "LBME", "address": "1101 BEAL AVE", "category": "Academic",
  "lat": 42.28884, "lng": -83.71363, "website": "https://bme.umich.edu/",
  "rampAccess": "The front entrance of the LBME building",   // free text, 104/466 have this
  "children": ["conference-room", "..."],                     // sub-units/departments
  "hasPolygon": true, "floors": 4,                             // floor COUNT, not per-floor layout
  "buildingRecordNumber": "1000406", "buildingPhase": "In Service",
  "buildingType": "Teach, Research, Support", "campus": "North", "ownership": "Owned",
  "classroomCount": 7,
  "history": { "yearBuilt": 2006, "architect": "ZGF Architects", "style": "Contemporary",
               "namedFor": "...", "notable": "...", "uses": "..." }
}
```

- `category`: Housing (242), Academic (107), Administrative (26), Student Life (25),
  Athletic (25), Medical (24), Library/Museum (14), Parking (3).
- `campus`: North (272), Central (86), Medical (32), Athletic (26), Off-Campus (8), +40
  null.
- **`rampAccess`** is a free-text, human-written accessibility note on 104/466
  buildings (e.g. *"A ramp is located at the North entrance (near the Diag)"*, or, for
  one building, *"No accessible entrance — ... please contact Carol Righi..."*). This
  is valuable, directly on-mission data, but unstructured: it names an entrance side in
  prose, not a coordinate or a link to a specific entrance in dataset #4.
- `floors` is a bare integer (floor count), **not** an MPrint-style per-floor interior
  layout. The interior mapping the proposal describes ("MPrint layouts to create mapped
  interiors") is not present in this data at all.
- No hours of operation, no photos.

## 4. Entrances (1,601 points, OSM-derived)

```jsonc
{
  "type": "Feature",
  "properties": {
    "entranceType": "main", "wheelchair": "yes", "name": null,
    "door": "hinged", "automatic": "button", "level": null, "access": "yes",
    "lit": "yes", "covered": null,
    "description": "After hours access for authorized users with a valid U of M ID card.",
    "buildingSlug": "ann-and-robert-h-lurie-biomedical-engineering-building",
    "osmId": 3146326465
  },
  "geometry": { "type": "Point", "coordinates": [-83.7135245, 42.2887762] }
}
```

This is the closest thing to structured, point-level accessibility data, but it's
**sparse**: OSM tags are only present where someone happened to survey them.

- `wheelchair`: 53 `yes`, 41 `no`, 1 `limited`, 1 `yes;no` (malformed/dual-tagged) —
  out of 1,601 entrances. The other **1,505 are simply untagged**, not "no".
- `automatic`: 22 `button`, 1 `yes`, 43 `no`, rest untagged.
- `lit`: 72 `yes`, 3 `no`, rest untagged. `covered`: 26/16/rest untagged.
- `entranceType`: main (935), service (628), emergency (22), secondary (9), stairs (7).
- Only 33 have a `name`, only 102 have a free-text `description`.

## 5. MPrint interior floor plans (confirmed, separate source)

[mprint.umich.edu](https://mprint.umich.edu/) is UM's own interior floor plan viewer.
It serves raster floor plan images at a predictable URL:

```
https://mprint.umich.edu/assets/floorplans/{tag}/{tag}_{floorNumber}.png
```

Confirmed by direct fetch: `eq_1.png` through `eq_4.png` (East Quad, floors 1–4) all
return real ~500–700KB PNGs; `eq_9.png` 404s (falls back to the app shell). Each image
is a full architectural CAD-style drawing with individual room numbers labeled (e.g.
`1400`, `1400C`, `1408`), stairs, and elevators — genuinely detailed, not a schematic.

**The `{tag}` matches our existing `acronym` field, lowercased** — verified: East Quad
is `acronym: "EQ"` in dataset #3 and `eq` in the MPrint URL; same pattern holds for
South/West/North Quad (`SQ`/`WQ`/`NQ`). This means dataset #3 already carries the join
key needed to construct MPrint URLs for *some* buildings — but:

- Only **112 of 466 buildings have an `acronym` at all**, and one value (`al`) is
  reused by two different buildings — so acronym-based tag guessing is a good starting
  point, not a complete or guaranteed-unique mapping. Full coverage requires either
  probing each candidate URL (HTTP 200 vs. app-shell fallback) or finding an actual
  MPrint building index/API.
- **These are raster images, not vector geometry** — but a prototype pipeline
  (OCR + dilated flood fill) can extract per-room polygons and numbers from them
  automatically, validated on a real floor plan including the hard case (a room with
  a non-physical/dashed boundary). Not production-ready and not yet tested beyond 2
  buildings — see [MPrint Room Extraction](mprint-extraction.md) for the full writeup,
  what worked, what didn't, and what's still missing (georeferencing, OCR validation,
  broader building coverage).
- Floor count per building isn't given anywhere in our data (`floors` in dataset #3 is
  a count, but hasn't been cross-checked against how many MPrint images actually
  exist per building) — needs the same probing approach as tag discovery.

## 6. Additional mguide.app static data (confirmed live, not yet pulled in)

Beyond the 4 files in the original upload, `https://mguide.app/data/` serves a lot
more — confirmed live by direct fetch (all HTTP 200, no auth):

| File | Size | Content |
|---|---|---|
| `rooms.json` | ~1.0MB | **Registrar classroom data — see below, directly fills the sensory/accessibility gap.** |
| `restrooms.json` | ~40KB | **Gender-inclusive + wheelchair-accessible restroom finder — see below.** |
| `pathways.geojson` | ~4.2MB | 13,817 walking-path segments (footway/path/cycleway/steps/pedestrian), tagged `wheelchair`/`surface`/`lit`/`covered` — the network an accessible-routing feature would run on. |
| `parking.geojson` | ~133KB | Parking lot/structure footprints. |
| `dining.json` | — | Dining hall/cafe locations and info. |
| `classroom-codes.json` | ~29KB | Room-code reference data. |
| `search-tags.json` | ~9KB | Search/autocomplete tag index. |
| `academic-calendar.json` | — | Term dates. |
| `blue-lights.geojson` | ~14KB | Campus emergency call-box locations (safety, not accessibility). |
| `michigan-boundary.geojson`, `michigan-mask.geojson` | — | Campus boundary geometry, for map styling. |
| `course-index.json`, `room-schedules.json` | — | Course/room scheduling data (registrar). |
| `gtfs/*.json`, `theride/*.json` | — | Bus transit (routes, stops, shapes, schedules) — two GTFS feeds (campus bus + TheRide). |
| `stop-amenities.json`, `stop-photos.json` | — | Transit stop detail. |

Two of these are directly on-mission and worth prioritizing:

**`rooms.json`** — keyed by building acronym (not slug; e.g. `"MLB"` for Modern
Languages Building), sourced from the Registrar's Schedule of Classes room data. 771
rooms across 77 buildings, each with `floor`, `type`, `capacity`, `roomType`, and an
**`equipment` list** with real per-room accessibility/furniture attributes:

```jsonc
{
  "MLB": {
    "building": "modern-languages-building", "name": "Modern Languages Building", "floors": 4,
    "rooms": {
      "2011": {
        "floor": 2, "type": "discussion", "capacity": 28, "roomType": "classroom",
        "equipment": ["tables", "ethernet", "wheelchair-instructor", "instructor-computer",
                      "whiteboard", "lecture-capture", "doc-camera", "projector",
                      "tables-moveable", "sound-system"],
        "equipmentDetail": { "wheelchair-instructor": { "name": "Wheelchair Access: Instructor",
          "desc": "Room provides wheelchair access to instructor area." }, "...": "..." }
      }
    }
  }
}
```

Equipment vocabulary across all 771 rooms (with counts): `projector` (382),
`instructor-computer` (343), `lecture-capture` (309), `wheelchair-instructor` (306),
`doc-camera` (289), `sound-system` (287), `ethernet` (280), `chalkboard` (280),
`tables` (256), `whiteboard` (179), `tables-moveable` (136), `tablet-arm` (115),
`tables-fixed` (73), `assistive-listening` (41), plus microphone/camera/display tags.
**`assistive-listening` and `tables-moveable`/`tables-fixed` are exactly the sensory/
adaptive-furniture taxonomy [Gap 2](#gaps-relative-to-what-the-app-needs) said we
didn't have** — this is real, structured, per-room data for it, not something to
invent from scratch. Caveat: it only covers rooms in the Schedule of Classes (i.e.
classrooms/conference rooms), not lounges or informal study areas, and it's keyed by
acronym, so it needs the same acronym-coverage caveat as MPrint (§ 5).

**`restrooms.json`** — keyed by building slug (87 buildings), sourced from Refuge
Restrooms (`"source": "refuge-restrooms"`), a gender-inclusive restroom database:

```jsonc
{
  "angell-hall": {
    "buildingName": "Angell Hall",
    "restrooms": [
      { "floor": 5, "room": null, "accessible": false, "changingTable": false,
        "directions": "5th floor of Angell, near the astronomy classrooms" }
    ],
    "source": "refuge-restrooms"
  }
}
```

Each restroom entry has a boolean `accessible` (wheelchair) and `changingTable` flag
plus free-text `directions`. Directly relevant given the target audience includes users
needing specific physical accommodations, not just study spaces.

## 7. mguide.app live API (confirmed, via reverse-engineered bundle)

`https://api.mguide.app` backs two runtime endpoints (found by grepping the fetch calls
in mguide's JS, not by using a browser/devtools — reading the same minified bundle
files `curl` already pulled down was enough):

- **`GET /api/waitz`** — proxies Waitz occupancy server-side instead of calling Waitz
  from the browser. Returns `{ data: [{ id, name, busyness, trend, subLocs: [...] }] }`.
  mguide matches a space to its Waitz record by `id === waitzId`, or a slugified
  `name`, or by searching each record's `subLocs`. Their busyness→level bucketing:
  `>= 80` → `very-busy`, `>= 50` → `moderate`, else `low`. **This validates
  [ADR 0003](../decisions/0003-supabase-as-backend.md)'s plan to proxy Waitz through a
  Next.js route handler rather than calling it client-side** — mguide independently
  made the same call, likely for the same reasons (hide any Waitz credentials, avoid
  CORS, control caching).
- **`GET /api/safety`** — campus safety/blue-light incident feed, polled with a 10s
  timeout and cached in `localStorage`. Not relevant to this project's scope.
- (`POST /api/feedback` also exists — crash/bug reporting, not relevant.)

No official Waitz API details (auth, base URL, rate limits) were recovered this way,
since mguide's own backend is the thing calling Waitz, not the browser — that part of
[Integrations § Waitz](integrations.md) is still genuinely TBD for us.

## 8. Official UM Student Life campus map (higher-authority source)

[maps.studentlife.umich.edu](https://maps.studentlife.umich.edu/) — the *actual*
official UM campus map (an Angular app), distinct from and more authoritative than
mguide.app. Found the same way: fetched its bundle directly (no browser needed) and
grepped for endpoint strings. It calls a genuinely official, unauthenticated,
CORS-open API:

```
https://apibuilder.studentlife.umich.edu/api/1/type/{building|department|parking|bus-stops}?limit=-1&visible[eq][]=1
```

(`limit=-1` returns everything; the app's default page size is 50.) Confirmed live by
direct fetch. Only 4 types exist (checked the whole bundle for `type/` strings) — no
entrances, pathways, room-equipment, or restroom types here, so this **complements**
rather than replaces the mguide.app-derived data in §§ 1–6:

- **`building`** (265 visible records) — this is the primary source `officalbuildingid`
  (mguide's `buildingRecordNumber`), `rampaccess`, and `acronym` all trace back to; our
  mguide-derived data is a copy of a subset of this. **New field not seen before:
  `elevatoraccess`** (free text, 67/265 have it, e.g. *"Enter through the south
  entrance... the elevator is located on the left just past the lobby"*) — same shape
  and caveats as `rampAccess` (prose, not a coordinate), but a real accessibility
  attribute we didn't have. Only 265 buildings vs. mguide's 466 — mguide's set appears
  to be a superset (possibly combined with OSM or non-"visible" buildings); worth
  reconciling when this becomes the seed source.
- **`department`** (child records of a building, linked via `parent`) — office/lounge/
  amenity listings within a building, e.g. East Quad's children include
  `abeng-lounge`, `anderson-lounge`, `greene-lounge`, `madrigal-lounge`,
  `benzinger-library`, each with a free-text `roomaddress` (e.g. `"1st floor Cooley"`,
  `"basement-Hayden"`). **Real, named, authoritative candidates for closing
  [Gap 1](#gaps-relative-to-what-the-app-needs) (study-space coverage)** — these are
  actual lounges/libraries UM lists per building, not something to invent — but no
  lat/lng, noise, or amenity data of their own; would need enrichment to become full
  `StudySpace` records.
- **`parking`** — each lot has a boolean **`accessiblespace`** flag plus `lotname`,
  `type` (e.g. "Blue"), `enforcementhours`, point geometry. Directly usable
  accessible-parking data, which nothing else surfaced so far had at all.
- **`bus-stops`** — just points, redundant with mguide's GTFS feeds.
- **Building photos, separately**: `https://mapproxy.studentlife.umich.edu/image.php?d={slug}`
  returns a JSON array of real photo URLs for that building (confirmed for East Quad —
  2 photos). **Fills [Gap 6](#gaps-relative-to-what-the-app-needs) (no photos)
  directly.** There's also a `places.php?q=` search endpoint, not yet explored.

Being UM's own official public map (not a third party's), this is the better primary
source to build on for buildings/accessibility/parking/photos long-term, even though
mguide.app remains the only source found so far for entrances, pathways, per-room
equipment, and restrooms.

## 9. UM Library's own "Find Study Space" tool (best source yet, purpose-built)

[lib.umich.edu/visit-and-study/study-spaces/find-study-space](https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/)
is the UM Library's own curated study-space finder — not reverse-engineered at all,
the full dataset is sitting in the page's own HTML as a `<script id="fass-data"
type="application/json">` tag ("fass" = Find A Study Space), the plainest and most
legitimate way to get data from a page there is. 34 records:

```jsonc
{
  "title": "Art, Architecture, and Engineering Library Floor 2 Computing Spaces",
  "slug": "/visit-and-study/study-spaces/conversational-study-spaces/art-architecture-and-engineering-library-floor-2-computing-spaces",
  "typeName": "node__location",
  "bodySummary": "Connect to an external monitor or work with a group at a VizHub in this mixed seating space.\r\n",
  "spaceFeatures": ["whiteboards", "external_monitors", "natural_light", "wheelchair_accessible"],
  "noiseLevel": "conversational",
  "building": "Art, Architecture, and Engineering Library",
  "campus": "North Campus",
  "imageUrl": "/_astro/aael-computing1_edited_1NJsot.webp",
  "imageAlt": "Students working individually at a set of tables with external monitors and short privacy dividers.."
}
```

This is **the best-fit source found so far** — it's the library's own accessibility/
sensory taxonomy, purpose-built for almost exactly this project's premise:

- **`spaceFeatures` vocabulary** (with counts across the 34 spaces): `natural_light`
  (26), `wheelchair_accessible` (21), `all_gender_restroom_on_floor` (13),
  `whiteboards` (10), `bookable` (9), `external_monitors` (7). **`natural_light` is the
  first real source found for the lighting dimension** — every other gap analysis pass
  said this had no source anywhere; now it does, officially. `wheelchair_accessible`
  and `all_gender_restroom_on_floor` are tagged **per space**, not per building/
  entrance like everything in §§ 2–4 — much more directly actionable (a user doesn't
  have to cross-reference a building's entrance data to know if *this specific room*
  works for them).
- **`noiseLevel`**: a proper named 3-tier scale — `quiet` (17), `conversational` (10),
  `low_noise` (7) — cleaner than mguide's `quiet`/`moderate`/`social` and it's the
  library's own term for it.
- **Real photos with alt text** (`imageUrl`/`imageAlt`), and a real one-line
  description (`bodySummary`) per space — resolves the photo gap for library spaces
  specifically, with better provenance than the studentlife.umich.edu photo endpoint.
- There's also an icon map (`fass-icon-map`, SVG paths for each `spaceFeatures` value
  plus `volume_up`/`cancel`) — worth reusing directly so our UI's accessibility icons
  match the vocabulary UM Library itself already established, rather than inventing a
  parallel one.

Caveats: only 34 spaces across 7 libraries (Shapiro 11, Hatcher South 7, Hatcher North
6, Art/Architecture/Engineering 5, Fine Arts 2, Music 2, Taubman Health Sciences 1) —
libraries only, nothing for dorm lounges/other buildings, so it complements rather than
replaces broader coverage efforts. No capacity or hours data (checked an individual
detail page too — not there either). `building` is a name string, not our
`buildingSlug` — needs mapping (also non-1:1: "Hatcher Library North" and "Hatcher
Library South" are two `building` values here but one building/`buildingSlug` in our
existing data).

**Recommendation: use this as the primary seed for `StudySpace` records in libraries**
— it's higher quality (official, purpose-curated, richer taxonomy) than the 24 generic
mguide.app-derived spaces for the 7 buildings it covers.

## 10. LibCal: bookable rooms and seats (unified, live availability)

UM's reservable study space runs on Springshare **LibCal**, and
[studyspaces.umich.edu](https://studyspaces.umich.edu/) links out to exactly three
LibCal instances. Location IDs (`lid`), checked against each instance's `/spaces` page
on 2026-09-28:

| Instance | Locations (`lid`) |
|---|---|
| `umich.libcal.com` (Library) | Shapiro 2761, Hatcher 3509, Hatcher 2nd Floor Study Spaces 23105, Hatcher Microforms 14410, Hatcher Donor Carrels 14566, Taubman Health Sciences 4183, CVGA 4004, Study Rooms 5040 |
| `umich-nc.libcal.com` (North Campus) | Duderstadt 11261, BBB 11258, GG Brown 11265, FMCRB 11359, LBME 14919, NCRC 11414, CSRB 15851, FXB 23054, Collaboration Computers 30547 |
| `umich-cc.libcal.com` (Central Campus) | SOAS 21968, SOAS Free Rooms 46354 (rooms in Mason Hall, etc.) |

**Availability endpoint.** The JSON seen in the browser's network tab comes from
`POST https://{instance}/spaces/availability/grid`. This is the call the public booking
page itself makes; the `jquery.min.js` fetch is unrelated. It's form-encoded with
`lid`, `gid` (0 = all), `eid` (-1 = all), `seat` (1 for `/seats` pages, 0 for
`/spaces` rooms), `start`/`end` (`YYYY-MM-DD`), `pageIndex`, `pageSize`. Confirmed
working from a plain server-side POST with no cookies or auth. For example, Duderstadt
seats returned 437 slots across 18 items for one day.

- Each slot is `{ start, end, itemId, checksum, className? }` in 30-minute steps,
  local time (America/Detroit, no offset).
  **`className: "s-lc-eq-checkout"` means booked. No `className` means available.
  No slot at all means closed or not bookable.** "Available now" is a slot covering
  the current time with no `className`.
- **Item metadata** (name, capacity, grouping, booking URL) isn't in the grid
  response. It's embedded in the `/spaces?lid=…` or `/seats?lid=…` page HTML as
  `resources.push({ id, title, url, eid, seatId, gid, lid, grouping, capacity })`.
  Titles include **room numbers and capacity**, e.g. `"2nd Floor - 2122 - Study Room
  (Capacity 5)"` (Shapiro) and `"2407 Mason Hall (Capacity 30)"`. That means
  bookable rooms can be joined to floor-plan `RoomZone`s by building + room number,
  the same key the extraction pipeline produces.
- **Official route:** LibCal has a documented REST API that uses OAuth client
  credentials issued by the institution's LibCal admin. We don't have credentials.
  Ask the Library for read-only access (outreach task), and until then read the
  public grid endpoint under the rules in
  [ADR 0008](../decisions/0008-libcal-availability-read-only.md).
- **Booking stays on LibCal.** Reservations need the student's own UM login, so the
  app deep-links to the item's LibCal page (`/space/{id}` or `/seat/{id}`) and never
  books on anyone's behalf.

**Inventory check (2026-09-28).** Scraping every location above with
`/{spaces|seats}?lid={lid}&gid=0&c=-1` returns **224 unique items**. Without
`gid=0&c=-1`, locations with several capacity options (e.g. Duderstadt) list nothing.
Titles are `\u`-escaped JS strings, and each item also carries `thumbnail` (a photo)
and `filterIds`. A grid poll at 12:23 on a Monday read 100 items free, 40 booked, 51
closed, and 33 with no slots that day.

| Title contains | Items | Examples |
|---|---|---|
| A room number | 134 | Shapiro `2122`–`2144`, `3042`, `3046`; Mason Hall `2407`…; DC `2340`…; LBME `1210`, `1300B`; FXB `1133B`; Hatcher carrels `Carrel 3-01 (3001)` (91) |
| A seat in a numbered room | 33 | `GGBL 2502 - Collaboration 1`, `NCRC 028-G129 Seat 01`, `CSRB 2204 Seat 1` |
| No room number | 57 | Soundproof booths `BOOTH1`–`BOOTH4`, CVGA game stations, `VIZHUB01`, Anatomage tables |

**Matching to MPrint plans.** MPrint plans exist for Shapiro (tag `ulib`, not `ugl`),
Duderstadt (`dc`), Mason Hall (`mh`), G.G. Brown (`ggbl`), FMCRB (`fmcrb`), LBME
(`lbme`) and FXB (`fxb`). No tag was found for Hatcher, BBB, NCRC, CSRB, or Taubman
(tried `hatch`, `hgl`, `hatcher`, `bbb`, `ncrc`, `csrb`, `thl` and variants). MPrint's
building list is behind its login (`/api/queues`). Shapiro's floor 2 plan shows every
LibCal room (`2122`–`2144`) as a labeled room, but the labels are only about 7px tall
at the plan's 1185×1854 resolution. Tesseract found **2 of 12** with whole-page OCR,
and did no better per room, per word, or upscaled. Instead, room numbers are
**read visually from numbered-region tiles** (`scripts/mprint/label_rooms.py`; see
[MPrint Room Extraction](mprint-extraction.md#labeling-by-reading-instead-of-ocr)).
Shapiro floor 2 is done this way, and all 12 LibCal rooms land in their own region.
The LibCal join is then an exact match on building + room number.

**Deep links.** `/space/{id}?date=YYYY-MM-DD` opens the item on that date.
`?date=YYYY-MM-DD HH:MM` also sets `autoCreateBookingDate`, which (per the page's own
script) loads the grid through `/spaces/availability/grid/pre-create` and pre-selects
that slot. The student then only confirms and signs in. Not yet tried end to end in a
browser.

**One-click booking.** The public endpoints need the student's own UM login session
(SSO with Duo) at submit time, and we can't hold or reuse that. The only legitimate
path is the official API's `POST /1.1/space/reserve` (patron `fname`/`lname`/`email`
plus `bookings: [{ id, to }]`), using API credentials the Library's LibCal admin would
issue with booking permission. That would supersede part of
[ADR 0008](../decisions/0008-libcal-availability-read-only.md) and needs a new ADR if
granted.

## 11. SerpApi: Google Maps data through a paid scraping API (researched 2026-10-08)

[SerpApi](https://serpapi.com/) runs Google searches for you and returns parsed JSON.
The team has a free key: **250 searches a month, at most 50 an hour**. Cached repeats
(same parameters within 1 hour) are free. Researched from SerpApi's docs only; no calls
made yet.

### What it returns that we don't have

| Engine | Useful fields | Gap it fills | Granularity |
|---|---|---|---|
| `google_maps` (`type=search`) | `place_id`, `data_id`, `gps_coordinates`, `operating_hours`, `type` | Finds the Google place for each building (one-time lookup) | Building |
| `google_maps` (`place_id=…`) | **`popular_times.graph_results`**: a 0–100 `busyness_score` per weekday per hour. **`live_busyness_score`** and `live_hash.info` ("Less busy than usual") for the current hour. `hours`, `extensions.accessibility` ("Wheelchair accessible entrance/restroom/seating"), `at_this_place` (cafes and offices inside), image thumbnails | Busyness ([Gap 5](#gaps-relative-to-what-the-app-needs)), hours (Gap 6), building accessibility (Gap 4) | Building |
| `google_maps_reviews` | Reviews filtered by `query` (e.g. `quiet`, `loud`, `outlets`) or by `topics` (keyword + mention count), `sort_by=newestFirst` | Hints for noise and amenity tags on spaces with no Library data | Building |
| `google_maps_photos` | User photos by category | Little: Library and studentlife photos already cover this (§§ 8–9) | Building |
| `google_maps_directions` | `travel_mode=3` (transit) with `route=4` (wheelchair accessible) | P3 step-free route planning, transit only | Route |

**Google does have popular times for UM buildings.** A public mirror of Google's data
shows Shapiro's full weekly curve (for example, Tuesday 2–3 PM at 99–100%, 3 AM at
around 10%). Which other buildings have it (Hatcher, Duderstadt, the Union, the other
libraries) is unverified until we run the lookups.

### Limits

- **Building level only.** Google has one place per building, so it can say "Shapiro is
  busy", never "Shapiro floor 2 is busy" or anything about a room. Waitz (floor level,
  6 spaces) and check-ins (space and room level) stay the finer-grained sources.
- **Live busyness doesn't fit any affordable plan.** Each refresh is one search.
  Polling 20 buildings hourly for 16 open hours a day is about 9,600 searches a month,
  more than the $75 Developer plan's 5,000. The free tier covers about 8 live lookups a
  day.
- **Typical curves are cheap.** They change slowly, so one lookup per building per
  month is enough: about 30 searches for the libraries plus the main non-library study
  buildings, plus about 30 one-time searches to find place IDs.
- **Reviews are other people's text** with names attached. Use them offline, to
  suggest tags a person then confirms. Never display or store reviewer names.
- **Google photos belong to whoever uploaded them.** Don't re-host them.

### Legal and dependency risk

- [MVP Scope](../product/mvp-scope.md#where-busyness-data-can-come-from) rejected
  Popular Times because there's no official API and DIY scrapers break Google's terms
  and get blocked. SerpApi solves the blocking, not the terms question. It scrapes
  Google so we don't have to, and only its paid plans from $150/month include its
  "U.S. Legal Shield".
- **Google is suing SerpApi** (*Google LLC v. SerpApi, LLC*, N.D. Cal.
  4:25-cv-10826, filed 2025-12-19). The court dismissed the original DMCA claims on
  2026-07-20, with prejudice for search results that don't involve copyrighted works.
  Google filed a narrower amended complaint on 2026-08-10, SerpApi moved to dismiss
  it, and the hearing was 2026-09-29. No ruling was public as of 2026-10-08. The suit
  targets SerpApi, not its customers. The risk to us is that the service gets
  restricted or shut down mid-semester.
- The official Google Places API is no substitute for busyness: it doesn't expose
  popular times. It does have hours, accessibility options and photos, but Google Maps
  Platform terms forbid showing its content on a non-Google map, and our map is
  MapLibre ([ADR 0006](../decisions/0006-maplibre-react-map-gl-osm.md)).

### Recommendation

1. **Use it for typical busyness, snapshotted.** Monthly, one script fetches
   `popular_times` for about 20–30 buildings and writes them to a
   `building_popular_times` table (see
   [Supabase Backend Plan](supabase-backend.md#later-packages-p1p2)). The app never
   calls SerpApi at runtime, so a SerpApi outage or injunction costs us freshness, not
   the feature. That's the same reasoning as
   [ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md). This gives
   WP7's weekday × hour view real data from day one instead of the planned simulated
   data. Label it in the UI ("Typical for this building, from Google Maps") and keep
   it separate from check-in data.
2. **Don't use it for live busyness.** It costs too much per refresh, and it would make
   SerpApi a runtime dependency. Recent check-ins stay the "right now" source outside
   Waitz buildings.
3. **Use Google `hours` only for non-library buildings.** For the libraries, the
   Library's own hours page
   ([lib.umich.edu/locations-and-hours/hours-view](https://www.lib.umich.edu/locations-and-hours/hours-view))
   is official and lists every space inside a building separately (e.g. Shapiro's
   Clark Commons vs. Askwith Media Library). It's a better source than Google.
4. **Optionally, use reviews and accessibility extensions as curation input.** For the
   24 mguide spaces and future non-library spaces, a teammate reviews the suggested
   tags and confirms them before they become `spaces.features` / `noise_level`. Never
   import them blindly.
5. This changes an MVP Scope decision, so it needs a new ADR ("Typical busyness from
   Google popular times via SerpApi, snapshotted, building level") if the team agrees.

Budget check for the free tier: about 30 place-ID lookups once, about 30 popular-times
snapshots a month, and about 60–90 review queries once for curation. That's under 250
in the first month and about 30 a month after.

## Gaps relative to what the app needs

1. **Study-space coverage is still the biggest gap, though much less blank than it
   looked.** For the 7 libraries § 9 covers, we now have 34 official, richly-tagged
   spaces — better than starting from mguide's 24. Outside libraries, coverage is still
   thin: 466 buildings total, and § 8's `department` records (named lounges per
   building, straight from UM's own map) are real candidates to expand from — cheaper
   than pure manual curation since names and rough locations already exist — but still
   need enrichment (noise, `spaceFeatures`-style tags) to become full `StudySpace`
   records, and won't cover informal spaces UM doesn't list as a department (a dorm
   hallway nook, an empty classroom).
2. **Sensory/environmental taxonomy is now solved for libraries, still open
   elsewhere.** § 9's `spaceFeatures` (`natural_light`, `wheelchair_accessible`,
   `all_gender_restroom_on_floor`, `whiteboards`, `bookable`, `external_monitors`) plus
   its 3-tier `noiseLevel` is a complete, official, purpose-built taxonomy — including
   `natural_light`, the one dimension nothing else had a source for. `rooms.json`'s
   equipment tags (`assistive-listening`, `tables-moveable`/`tables-fixed`) add more,
   for registrar classrooms. Neither covers informal lounges/dorm spaces outside those
   two categories — still needs a decision on whether to extend the § 9 taxonomy there
   via manual survey or crowdsourcing, rather than an unrelated new one.
3. **Interior/per-floor maps: prototype pipeline validated, not yet production data.**
   A working OCR + flood-fill extraction pipeline exists and handled the hard case
   (a non-physical/dashed room boundary) correctly on a real test — see
   [MPrint Room Extraction](mprint-extraction.md). Per-room zones stay in the floor
   plan image's own pixel space (that's sufficient for click-to-review — no per-room
   lat/lng needed). What's missing: full building→tag mapping beyond the 112 buildings
   with an `acronym`, anchoring each floor-plan *image as a whole* to the building's
   real-world position (one calibration per floor, for a seamless map→floor zoom —
   distinct from and much cheaper than per-room georeferencing), OCR-error correction,
   and running the extraction across more than 2 buildings before trusting the output.
4. **Accessibility data is better than it looked, but still disconnected across seven
   sources.** Building-level `rampAccess`/`elevatorAccess` prose (§ 8, official),
   entrance-level `wheelchair` tags (<10% coverage), `rooms.json`'s
   `wheelchair-instructor`/`assistive-listening` tags (classrooms only),
   `restrooms.json`'s accessible/changing-table flags, `pathways.geojson`'s route-level
   `wheelchair` tags (27 yes / 3 no / 13,787 untagged), `parking`'s `accessiblespace`
   flag, and now § 9's per-space `wheelchair_accessible`/`all_gender_restroom_on_floor`
   (the most directly usable of all of them, since it's already per-space) don't share
   a key or a data model today. Unifying these into one accessibility view per
   building/space is now the real work, more than sourcing is.
5. **Waitz occupancy**: only 6/24 spaces have a `waitzId`. mguide.app proxies Waitz
   through its own backend rather than calling it from the browser (see § 7) — we still
   don't have Waitz's own API details (auth, rate limits), only confirmation that
   proxying server-side is the right shape, matching our existing plan.
6. **No hours of operation** for study spaces specifically (`academic-calendar.json`
   gives term dates, not building/room hours). Photos are now sourced (§ 8,
   `image.php?d={slug}`), so that half of this gap is resolved.
7. **No user-generated content yet** — ratings, crowdsourced pins, accounts. That's the
   app's job to create, not something to source.

## Next Steps

1. Pull down and commit UM Library's `fass-data`/`fass-icon-map` (§ 9, 34 spaces) as
   the primary `StudySpace` seed for the 7 libraries it covers — highest quality, do
   this first. Adopt its `spaceFeatures`/`noiseLevel` vocabulary as *the* taxonomy
   (including reusing its SVG icon set) rather than inventing a parallel one, since it
   already does what [Gap 2](#gaps-relative-to-what-the-app-needs) needed.
2. Pull down and commit the full mguide.app `/data/*` set into the repo as seed data
   (e.g. `supabase/seed/raw/`), not just the 4 files in the original upload — at
   minimum add `rooms.json`, `restrooms.json`, and `pathways.geojson` given § 6, plus
   `parking.geojson` and `dining.json` since they're low-effort adds. Keep each as its
   own file rather than re-concatenating.
3. Also pull `apibuilder.studentlife.umich.edu`'s `building`, `department`, and
   `parking` types (§ 8, official, `limit=-1&visible[eq][]=1`) and reconcile against
   the mguide-derived building set — decide whether the official 265 or mguide's 466
   is the base building list going forward, and treat the official `rampaccess`/
   `elevatoraccess`/`acronym` as the source of truth where the two disagree.
4. Turn [Data Model](data-model.md)'s sketch into real Supabase SQL migrations,
   informed by the actual fields above (in particular: keep `buildingSlug` as the
   join key — mapping § 9's `building` name strings to it, including the many-to-one
   case of Hatcher North/South → one building — and give `StudySpace` its own lat/lng
   or floor-relative position instead of inheriting the building's).
5. Write and run a seed script that loads buildings + polygons + entrances + the § 9
   library spaces + the 24 mguide spaces into Supabase, so the map has real content
   from day one.
6. Design how `rooms.json` (keyed by acronym), `restrooms.json` (keyed by slug),
   `pathways.geojson` (raw geometry), and `parking`'s `accessiblespace` flag join into
   the same `buildingSlug`-keyed schema as everything else, so accessibility data can
   be queried per building/space instead of living in seven disconnected shapes (gap 4).
7. Build an MPrint discovery/mirroring script: for each building, try
   `{acronym-lowercased}_{n}.png` for increasing `n` until a fetch falls back to the
   app shell, record the resulting tag→floor-count mapping, and download the images
   (or at least their URLs) into the repo/Supabase Storage rather than hot-linking
   `mprint.umich.edu` from production. For the 354 buildings with no `acronym`, the tag
   is unknown and needs another discovery method (a real MPrint index, if one exists,
   or manual lookup for the buildings that actually need interior maps).
8. Decide how to extend § 9's `spaceFeatures`/`noiseLevel` taxonomy to non-library
   spaces (dorm lounges, department-listed rooms) — manual survey or crowdsourcing,
   since nothing sources it for those today.
9. Decide how to close the remaining study-space coverage gap outside libraries: use
   `department` records (§ 8) as seed candidates for named lounges, then more manual
   curation and the crowdsourced contribution flow for what's still missing.
10. Harden the MPrint extraction prototype ([full writeup](mprint-extraction.md)):
    auto-calibrate the dilation radius per image instead of a fixed constant, validate
    OCR'd room numbers against `rooms.json`'s known list per building to catch
    misreads, anchor each floor-plan image as a whole to the building's real-world
    position (one calibration per floor, for a seamless map→floor zoom — not per-room
    georeferencing, which isn't needed), and run it across more buildings (starting
    with the libraries from § 9) before trusting the output at scale. Manual override
    entries (e.g. Greene Lounge =
    room 1808, confirmed by OCR position + photo) remain necessary for rooms
    `rooms.json` doesn't cover at all, not just a fallback for extraction failures.
