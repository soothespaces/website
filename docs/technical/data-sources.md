# Data Sources

Status: analysis of the first data drop (`data.json`, 2.7MB, not yet committed to the
repo — see [Next Steps](#next-steps)), plus MPrint interior floor plans confirmed as a
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

**Provenance**: pulled from the API backing [mguide.app](https://mguide.app/), a third
-party UM campus map, which itself presumably sources from official UM facilities/OSM
data (the field shapes — `buildingRecordNumber`, OSM `osmId` tags — support that). It's
someone else's API, not an official UM data feed, so treat field completeness/accuracy
as "best effort" and don't assume stability of the endpoint long-term — worth committing
the raw drop into the repo (see [Next Steps](#next-steps)) precisely because it may not
be re-fetchable later.

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
- **These are raster images, not vector geometry.** They're excellent for showing a
  user "here's what this floor looks like" (zoomable/pannable, like a scanned map), but
  there's no structured per-room polygon data — turning a specific room number into a
  clickable, filterable map pin means manually digitizing hotspot regions per room per
  floor, not just dropping the image in.
- Floor count per building isn't given anywhere in our data (`floors` in dataset #3 is
  a count, but hasn't been cross-checked against how many MPrint images actually
  exist per building) — needs the same probing approach as tag discovery.

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
3. **Interior/per-floor maps are sourceable (MPrint, see § 5) but not yet structured
   data.** The images exist and the URL pattern is confirmed; what's missing is (a) a
   full building→tag mapping beyond the 112 buildings with an `acronym`, and (b) a
   decision on how much manual digitization (room hotspots) is worth doing vs. just
   showing the raster image as a reference layer under the pin-based map.
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
4. Build an MPrint discovery/mirroring script: for each building, try
   `{acronym-lowercased}_{n}.png` for increasing `n` until a fetch falls back to the
   app shell, record the resulting tag→floor-count mapping, and download the images
   (or at least their URLs) into the repo/Supabase Storage rather than hot-linking
   `mprint.umich.edu` from production. For the 354 buildings with no `acronym`, the tag
   is unknown and needs another discovery method (a real MPrint index, if one exists,
   or manual lookup for the buildings that actually need interior maps).
5. Decide the sensory/environmental data taxonomy (noise, lighting, etc.) the product
   overview promises, since current data only covers noise, and only coarsely.
6. Decide how to close the study-space coverage gap: more manual curation before
   launch, prioritizing the crowdsourced contribution flow, or both.
7. Decide the accessibility-data strategy (see gap 4) — this is arguably the most
   product-critical open question, since accessibility is the app's whole premise.
8. Decide how much MPrint digitization is worth doing for the semester: raster image
   as a reference layer (cheap) vs. manually hotspotted rooms (expensive, but matches
   the original "mapped interiors" pitch) — see [Architecture](architecture.md).
