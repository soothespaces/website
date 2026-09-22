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
- **Map↔floor transition design — decided: geographically-anchored overlay.** The
  product intent is a seamless drill-down: zoom into a building on the outdoor map,
  and — if the user wants that fine-grained view — it opens onto the floor plan with
  individual clickable rooms, each carrying its own reviews/photos. Implemented as a
  real anchored overlay (the floor-plan image placed at the building's map
  coordinates), not a panel/modal, using the per-floor alignment produced by
  [ADR 0005](../decisions/0005-manual-floor-plan-alignment-tool.md)'s manual alignment
  tool. Room-level click targets stay in the floor plan image's own pixel space either
  way (see [MPrint Room Extraction](mprint-extraction.md)) — the alignment only
  affects where the image itself sits on the map, not how rooms within it are clicked.
- **3D building massing (optional, cheap upgrade).** Google's photorealistic 3D
  building tiles can't be reused here — proprietary, and their terms only license
  display through Google's own renderer, not extraction into a different map stack
  (MapLibre). A flat 2D footprint polygon is fine as the baseline. A free middle
  ground if wanted later: every building record already has a `floors` count, so
  `floors × ~3.5m` extruded via MapLibre's built-in `fill-extrusion` layer gives basic
  2.5D block massing with no new data sourcing — not photorealistic, but a real step
  up from flat, for free.
- **GPS cannot detect floor or room, and shouldn't be relied on to try.** Horizontal
  GPS accuracy is ~5–10m outdoors in good conditions, often 15–20m+ near dense campus
  buildings; vertical/altitude accuracy is 2–3x worse than horizontal (commonly
  10–20m+ of error) — far bigger than a single floor's ~3–4m height, so GPS altitude
  cannot distinguish floors on typical phone hardware, ever, not just with more
  engineering effort. Indoors, GPS is usually degraded or absent, falling back to
  WiFi/cell positioning (tens of meters of error). This is why even Google's own
  indoor maps for airports/malls require manual floor selection rather than detecting
  it — the same pattern applies here: GPS is good for "which building are you near,"
  floor/room selection should be a manual tap. A phone's barometric altimeter can
  suggest a *relative* floor change (pressure delta from a calibrated ground-floor
  baseline) as a possible future enhancement, but it drifts with weather and isn't a
  v1 requirement.
