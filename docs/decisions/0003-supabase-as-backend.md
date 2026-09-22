# 0003 — Supabase as the Only Backend

Date: 2026-09-22

## Status

Accepted

## Context

The app needs persistent storage (study spaces, environmental attributes, ratings,
crowdsourced pins), authentication (for the crowdsourced contribution flow), and
ideally realtime updates (occupancy, new pins) — without the team standing up and
operating a separate backend service.

## Decision

Use Supabase (Postgres + Auth + Realtime + Storage) as the entire backend, accessed
directly from the Next.js app via `supabase-js`. There is no custom backend service:
no separate API server to deploy, scale, or operate. Row Level Security (RLS) policies
in Postgres are the authorization boundary, not application server code.

Any logic that genuinely can't run in the browser (e.g. calling a third-party API with
a secret key, like Waitz — see [Integrations](../technical/integrations.md)) lives in
Next.js route handlers/server components, which Vercel deploys as serverless
functions. This is glue code, not a backend service to maintain.

## Consequences

- No backend deployment/ops story beyond Supabase itself and Vercel.
- Data access control must be enforced with Postgres RLS policies, not server-side
  checks — RLS policies need to be written and tested as carefully as any backend
  authorization code would be.
- Supabase Auth is the auth provider for the crowdsourced contribution flow (resolves
  that open question from [ADR 0002](0002-nextjs-typescript-tailwind-vercel.md)), using
  the Google OAuth provider restricted to `@umich.edu` accounts. Since Supabase Auth
  doesn't gate sign-in by email domain on its own, enforcement is two-layered: an
  `auth.users`/profile check (e.g. a Postgres trigger or RLS policy rejecting non-
  `@umich.edu` emails) plus a client-side check for UX, so a stray non-umich Google
  account can't slip through if only the client-side check existed.
- Supabase Realtime is the natural fit for pushing live occupancy/new-pin updates to
  connected clients, instead of client-side polling.
- Ties the data layer to Postgres/Supabase specifically; see
  [Data Model](../technical/data-model.md) for schema, which should be written as SQL
  migrations under Supabase's migration tooling.
