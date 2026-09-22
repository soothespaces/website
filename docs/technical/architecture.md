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
