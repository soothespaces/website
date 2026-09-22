# Integrations

## GeoJSON building footprints

Base map geometry for campus buildings. **Sourced** — 466 building polygons plus 1,601
OSM-derived entrance points, received as a data drop and analyzed in
[Data Sources](data-sources.md). Update process (one-time import vs. periodic refresh
against OSM) still TBD.

## MPrint interior layouts

Interior floor plans used to map study zones inside buildings. **Not present** in the
data received so far — the `floors` field on each building is just a count, not
geometry. Either source real MPrint data, or scope the MVP to building-level pins with
a floor/room list instead of true indoor mapping — see
[Data Sources § Gaps, item 3](data-sources.md#gaps-relative-to-what-the-app-needs).

## Waitz IoT occupancy API

Provides real-time crowd density used for live occupancy data in the
[Real-Time Spot Detail Cards](../product/features.md#real-time-spot-detail-cards) and
for the "not-only-you" filtering flow (letting users avoid overstimulating environments
before traveling to them). Auth, rate limits, and polling/webhook strategy TBD. Of the
24 curated study spaces sourced so far, only 6 have a `waitzId` to call the API with —
see [Data Sources § 1](data-sources.md#1-study-spaces-24-records).
