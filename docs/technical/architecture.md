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
- Hosting/deploy: Vercel.

## Open questions

- Map rendering library (e.g. MapLibre GL, Leaflet, Mapbox GL) — TBD.
- Backend/data store for spaces, ratings, and user-submitted pins — TBD.
- Auth provider for the crowdsourced contribution flow — TBD.
