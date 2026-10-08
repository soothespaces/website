# 0002 — Next.js, TypeScript, Tailwind, Vercel

Date: 2026-09-22

## Status

Accepted

## Context

The project needs a frontend framework and hosting setup for an interactive,
accessibility-focused map application, ready to ship quickly across a small team.

## Decision

Scaffold the site with `create-next-app`: Next.js (App Router), TypeScript, Tailwind
CSS v4, `src/` directory layout, ESLint. Deploy on Vercel.

## Consequences

- Zero-config deploy on Vercel (the framework Vercel builds for).
- App Router gives file-based routing and server components out of the box, which
  suits a map-centric single-page-feeling app with a few supporting routes (auth,
  contribution flow).
- TypeScript enforced from the start, useful given the data model (spaces, ratings,
  occupancy readings) will have real shape.
- Map rendering library, backend/data store, and auth provider are separate,
  not-yet-made decisions — see [Architecture](../technical/architecture.md).
