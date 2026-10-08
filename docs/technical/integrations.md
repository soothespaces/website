# Integrations

## GeoJSON building footprints

Base map geometry for campus buildings. **Sourced** — 466 building polygons plus 1,601
OSM-derived entrance points, received as a data drop and analyzed in
[Data Sources](data-sources.md). Update process (one-time import vs. periodic refresh
against OSM) still TBD.

## MPrint interior layouts

Interior floor plans used to map study zones inside buildings, sourced from UM's own
[mprint.umich.edu](https://mprint.umich.edu/) viewer. **Confirmed working**: raster
PNGs at `https://mprint.umich.edu/assets/floorplans/{tag}/{tag}_{floorNumber}.png`,
where `{tag}` is a building's `acronym` field lowercased (verified for East/South/
West/North Quad). Detailed CAD-style drawings with individual room numbers, stairs,
and elevators — see [Data Sources § 5](data-sources.md#5-mprint-interior-floor-plans-confirmed-separate-source)
for full detail and caveats (raster not vector, `acronym` only covers 112/466
buildings, floor counts need discovery per building). Not yet mirrored into our own
storage — see [Data Sources § Next Steps](data-sources.md#next-steps).

## Waitz IoT occupancy API

Provides real-time crowd density used for live occupancy data in the
[Real-Time Spot Detail Cards](../product/features.md#real-time-spot-detail-cards) and
for the "not-only-you" filtering flow (letting users avoid overstimulating environments
before traveling to them). Waitz's own auth/rate limits/base URL are still TBD for us,
but the shape of the integration is now validated: mguide.app (see
[Data Sources § 7](data-sources.md#7-mguideapp-live-api-confirmed-via-reverse-engineered-bundle))
proxies Waitz through its own backend (`GET /api/waitz` → `{ data: [{ id, name,
busyness, trend, subLocs }] }`, bucketed into `low`/`moderate`/`very-busy` at 50/80)
rather than calling it from the browser — matches our plan in
[ADR 0003](../decisions/0003-supabase-as-backend.md) to do the same via a Next.js
route handler. Of the 24 curated study spaces sourced so far, only 6 have a `waitzId`
to call the API with — see [Data Sources § 1](data-sources.md#1-study-spaces-24-records).

## Accessible restrooms and pathways

Two more data sources fill in accessibility gaps directly:
[`restrooms.json`](data-sources.md#6-additional-mguideapp-static-data-confirmed-live-not-yet-pulled-in)
(gender-inclusive + wheelchair-accessible restrooms, via Refuge Restrooms) and
`pathways.geojson` (13,817 OSM path segments tagged `wheelchair`/`surface`, the network
an accessible-routing feature would run on). Not yet pulled into the repo — see
[Data Sources § Next Steps](data-sources.md#next-steps).

## UM Library's "Find Study Space" data

The best-fit source found so far — see
[Data Sources § 9](data-sources.md#9-um-librarys-own-find-study-space-tool-best-source-yet-purpose-built).
34 official, library-curated study spaces embedded directly in
[the library's own page](https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/)
as a `fass-data` JSON blob — no reverse engineering needed, just reading the page.
Comes with exactly the sensory/accessibility taxonomy the product overview promises
(`natural_light`, `wheelchair_accessible`, `all_gender_restroom_on_floor`, plus a
`quiet`/`conversational`/`low_noise` scale) and an SVG icon set (`fass-icon-map`) worth
reusing directly in our UI rather than inventing a parallel taxonomy. **Recommended as
the primary `StudySpace` seed and the schema to standardize `spaceFeatures`/
`noiseLevel` on**, for the 7 libraries it covers; other buildings still need the
mguide.app-derived spaces and eventual crowdsourcing.

## Official UM Student Life campus map API

`https://apibuilder.studentlife.umich.edu/api/1/type/{building|department|parking|bus-stops}`
— UM's own official campus map API (unauthenticated, CORS-open), distinct from and
more authoritative than mguide.app. See
[Data Sources § 8](data-sources.md#8-official-um-student-life-campus-map-higher-authority-source)
for full detail. Adds `elevatorAccess` (a field mguide's copy doesn't carry), an
`accessiblespace` flag on parking lots, named lounge/department listings per building
(candidate `StudySpace` seeds), and real building photos via a separate
`mapproxy.studentlife.umich.edu/image.php?d={slug}` endpoint. Recommended as the
long-term primary source for building/accessibility/parking/photo data, with
mguide.app kept for what it alone provides (entrances, pathways, per-room equipment,
restrooms, and the Waitz proxy pattern above).
