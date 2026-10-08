# 0005 — Manual Alignment Tool for Georeferencing MPrint Floor Plans

Date: 2026-09-22

## Status

Accepted

## Context

A seamless map→floor zoom (see [Architecture](../technical/architecture.md)) needs
each MPrint floor-plan image anchored to the building's real-world position — not
per-room, but the image as a whole (see
[MPrint Room Extraction](../technical/mprint-extraction.md)). Automatically deriving
that alignment (matching a raster architectural drawing's exterior outline against a
GeoJSON footprint polygon via computer vision) is a much harder, less reliable problem
than doing it by hand, and it's a one-time task per building/floor, not something end
users ever do.

## Decision

Build a small internal-only web tool: display the building's GeoJSON footprint as a
"ghost" outline (projected to local flat meters, not raw lat/lng, so dragging feels
like normal 2D manipulation) over the MPrint raster image, and let an admin
drag/rotate/scale one against the other until they line up. On save, compute the
lat/lng of the aligned image's 4 corners and store those against that floor's
`FloorPlan` record.

This maps directly onto MapLibre GL's `image` source type, which places a raster on
the map from exactly 4 corner coordinates (handling rotation/skew itself) — so the
tool's only real job is producing those 4 points, not a general transform matrix, and
there's no custom projection math needed at render time.

## Consequences

- One repetitive but fast manual task per building/floor (not per room) — a good UI
  (scroll-to-zoom, keyboard nudges, snap-to-corner) keeps this from being tedious at
  the scale this project needs (starting with the libraries from
  [Data Sources § 9](../technical/data-sources.md#9-um-librarys-own-find-study-space-tool-best-source-yet-purpose-built),
  plus priority dorms/buildings).
- No CV/auto-alignment work needed, and no dependency on floor plans being pixel-
  perfect or consistently sized between floors — each floor is aligned independently.
- `FloorPlan` needs 4 stored corner coordinates (see
  [Data Model](../technical/data-model.md)) instead of a generic affine/homography
  matrix.
- Building without this alignment still works — the floor plan can be shown in a
  panel/modal on building click (see [Architecture](../technical/architecture.md)'s
  map↔floor transition options) — alignment only unlocks the continuous-zoom version.
