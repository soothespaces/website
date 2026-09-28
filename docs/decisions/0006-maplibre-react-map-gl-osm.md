# 0006 — MapLibre GL + react-map-gl + OpenStreetMap

Date: 2026-09-27

## Status

Accepted

## Context

The map is the app's central interface. It has to render building footprints,
study-space pins, and floor-plan images anchored at each building's real-world
position ([ADR 0005](0005-manual-floor-plan-alignment-tool.md)), inside a Next.js/React
app, with no per-request map-tile costs.

## Decision

Use **MapLibre GL JS** for rendering, through **react-map-gl** for React bindings, on
**OpenStreetMap**-based tiles and data.

## Consequences

- Open source, with no Mapbox/Google API key or usage billing.
- MapLibre's `image` source places a raster from 4 corner coordinates, which is
  exactly the format the floor-plan alignment tool saves. Its `fill-extrusion` layer
  also allows 2.5D buildings later.
- mguide.app uses the same library on the same campus data, which shows the approach
  works here.
- OSM's license requires visible attribution on the map.
