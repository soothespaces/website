# Data Sources

Status: analysis of the first data drop (`data.json`, 2.7MB, not yet committed to the
repo — see [Next Steps](#next-steps)). It's actually four separate top-level JSON
values concatenated in one file, not one JSON document:

| # | Shape | Count | Content |
|---|-------|-------|---------|
| 1 | array | 24 | Hand-curated study spaces |
| 2 | GeoJSON `FeatureCollection` (Polygon) | 466 | Building footprints, for map rendering |
| 3 | array | 466 | Building metadata (official U-M facilities data) |
| 4 | GeoJSON `FeatureCollection` (Point) | 1,601 | Building entrances (OSM-derived) |

All four are keyed by `slug` (spaces reference `buildingSlug`; every `buildingSlug` in
the spaces array and every polygon's `slug` resolves to a record in the buildings
array — checked, zero orphans either direction).

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

## Gaps relative to what the app needs

1. **Study-space coverage is the biggest gap.** 24 curated spaces across 17 buildings
   vs. 466 buildings total — most academic buildings, all dorms beyond the three
   "quads," and anything Medical/Administrative/Athletic have zero entries. This has to
   grow substantially, likely combining more manual curation with the crowdsourced
   contribution flow from day one rather than after launch.
2. **No sensory/environmental data beyond a single manual `noiseLevel` tag.** Nothing
   for lighting quality, adaptive furniture, or other sensory dimensions the proposal
   calls out as core — those need a defined taxonomy and a way to populate them (manual
   survey, crowdsourced, or both).
3. **No interior/per-floor maps.** `floors` is a count, not geometry. If per-floor
   indoor mapping is still wanted (per the original "MPrint layouts" idea), that's a
   wholly separate sourcing effort — MPrint access, floor plan digitization, or
   dropping the indoor-layout ambition in favor of building-level pins + a room/floor
   list.
4. **Accessibility data is real but thin and disconnected.** `rampAccess` (building
   level, prose) and entrance `wheelchair` tags (point level, <10% coverage) don't
   connect to each other and don't cover most buildings. Options: geocode/parse
   `rampAccess` text against nearby entrance points, treat both as-is as "best
   available" and let crowdsourcing fill gaps, or seek a more authoritative UM
   accessibility dataset (Services for Students with Disabilities / Facilities may have
   one).
5. **No live data of any kind in this file** — expected, since Waitz occupancy is a
   runtime API call, not a data dump. But only 6/24 spaces have a `waitzId` to call it
   with.
6. **No hours of operation, no photos.** Relevant for "can I use this space right now."
7. **No user-generated content yet** — ratings, crowdsourced pins, accounts. That's the
   app's job to create, not something to source.

## Next Steps

1. Commit this raw data drop into the repo as seed data (e.g. `supabase/seed/` or
   `data/raw/`) instead of leaving it only as an upload, so it's versioned and
   reproducible — split back into its 4 logical files rather than kept concatenated.
2. Turn [Data Model](data-model.md)'s sketch into real Supabase SQL migrations,
   informed by the actual fields above (in particular: keep `buildingSlug` as the
   join key, and give `StudySpace` its own lat/lng or floor-relative position instead
   of inheriting the building's).
3. Write and run a seed script that loads buildings + polygons + entrances + the 24
   curated spaces into Supabase, so the map has real content from day one.
4. Decide the sensory/environmental data taxonomy (noise, lighting, etc.) the product
   overview promises, since current data only covers noise, and only coarsely.
5. Decide how to close the study-space coverage gap: more manual curation before
   launch, prioritizing the crowdsourced contribution flow, or both.
6. Decide the accessibility-data strategy (see gap 4) — this is arguably the most
   product-critical open question, since accessibility is the app's whole premise.
7. Scope whether per-floor interior mapping stays in scope for this semester given no
   MPrint data currently exists, or whether the MVP is building-level pins with a
   floor/room list (see [Architecture](architecture.md)'s open questions).
