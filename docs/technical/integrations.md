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
before traveling to them). Auth, rate limits, and polling/webhook strategy TBD. Of the
24 curated study spaces sourced so far, only 6 have a `waitzId` to call the API with —
see [Data Sources § 1](data-sources.md#1-study-spaces-24-records).
