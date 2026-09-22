# Architecture

Status: not yet designed in detail. This is a placeholder to be filled in as the team
makes decisions — record them here and as ADRs under [decisions/](../decisions/).

## Known constraints (from the project proposal)

- Frontend: interactive 2D map (GeoJSON building footprints + MPrint interior layouts),
  faceted filtering, WCAG-compliant display controls, real-time detail modals,
  crowdsourced pin submission.
- Needs a data layer for: study spaces, environmental attributes (noise, lighting,
  amenities), community ratings, and crowdsourced submissions requiring
  authentication.
- Needs a live integration with the Waitz IoT occupancy API for real-time crowd
  density (see [Integrations](integrations.md)).

## Current stack

- Next.js (App Router) + TypeScript + Tailwind CSS — see
  [ADR 0002](../decisions/0002-nextjs-typescript-tailwind-vercel.md).
- Supabase (Postgres + Auth + Realtime + Storage), accessed via `supabase-js` — see
  [ADR 0003](../decisions/0003-supabase-as-backend.md). No separate backend service:
  the Next.js app talks to Supabase directly. Any server-side glue that shouldn't run
  in the browser (e.g. calling the Waitz API with a secret key) lives in Next.js route
  handlers/server components, deployed as Vercel serverless functions — not a
  standalone backend.
- Hosting/deploy: Vercel.

## Open questions

- Map rendering library (e.g. MapLibre GL, Leaflet, Mapbox GL) — TBD.
- Whether the Waitz occupancy API is called directly from the client, proxied through
  a Next.js route handler, or synced into Supabase on a schedule — TBD (see
  [Integrations](integrations.md)).
- How much MPrint interior data to digitize: a validated OCR + flood-fill prototype
  can auto-extract clickable per-room zones (see
  [MPrint Room Extraction](mprint-extraction.md)), which changes the tradeoff from
  "cheap raster image vs. expensive full manual digitization" to "how much automation
  hardening (OCR validation, per-building tuning) is worth doing" — still TBD, but the
  fully-manual-or-nothing framing is outdated.
- Whether MPrint images are hot-linked from `mprint.umich.edu` at request time or
  mirrored into Supabase Storage/the repo — TBD.
- **Map↔floor transition design.** The product intent is a seamless drill-down: zoom
  into a building on the outdoor map, and — if the user wants that fine-grained view —
  it opens onto the floor plan with individual clickable rooms, each carrying its own
  reviews/photos. Two implementation shapes, not yet chosen between: (a) a real
  geographically-anchored overlay (the floor-plan image placed at the building's map
  coordinates via the map library's image-source support, so zooming in is
  continuous — needs the per-floor whole-image anchor from
  [MPrint Room Extraction](mprint-extraction.md), not yet attempted), or (b) a
  panel/modal that opens on building click without being part of the same continuous
  map surface (no anchoring needed, faster to build, less "seamless"). Room-level
  click targets work the same way either way since they stay in the floor plan
  image's own pixel space regardless of which shape (a)/(b) is chosen.
