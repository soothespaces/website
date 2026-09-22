# Project Documentation

This directory is the single source of truth for everything about the project — from
high-level product thinking to technical implementation details. If it's worth knowing
about the project, it belongs in here as a markdown file, not in chat history or slides.

## Product

What we're building, for whom, and why.

- [Overview](product/overview.md) — problem statement, the idea, target audience
- [Features](product/features.md) — UI/UX feature specs
- [Roadmap](product/roadmap.md) — milestones and phases

## Technical

How it's built.

- [Architecture](technical/architecture.md) — system design, frontend/backend/data flow
- [Data Sources](technical/data-sources.md) — what data we actually have, and gaps
- [Data Model](technical/data-model.md) — schema for spaces, amenities, ratings, tags
- [Integrations](technical/integrations.md) — GeoJSON/MPrint ingestion, Waitz occupancy API
- [Accessibility](technical/accessibility.md) — WCAG approach and testing checklist

## Decisions

An [Architecture Decision Record](https://adr.github.io/) (ADR) log — one short, dated
file per significant technical decision, kept even after the decision is superseded.

- [0001 — Record architecture decisions](decisions/0001-record-architecture-decisions.md)
- [0002 — Next.js, TypeScript, Tailwind, Vercel](decisions/0002-nextjs-typescript-tailwind-vercel.md)
- [0003 — Supabase as the only backend](decisions/0003-supabase-as-backend.md)
- [0004 — Do not depend on mguide.app's Waitz proxy](decisions/0004-do-not-depend-on-mguide-waitz-proxy.md)

## Conventions

- New feature or product idea → add or extend a file under `product/`.
- New technical subsystem or design → add or extend a file under `technical/`.
- A decision that would be annoying to re-litigate later (framework, data store, API
  choice, naming convention) → add a new numbered ADR under `decisions/`. Never edit an
  old ADR's decision after the fact — add a new one that supersedes it and link back.
- Keep this README's tables of contents up to date when adding or removing files.
