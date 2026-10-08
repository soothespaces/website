# 0001 — Record Architecture Decisions

Date: 2026-09-22

## Status

Accepted

## Context

The team needs a lightweight way to track significant technical decisions (frameworks,
data stores, API choices, naming conventions) so the reasoning survives beyond chat
history and doesn't have to be re-litigated later.

## Decision

Use an Architecture Decision Record (ADR) log under `docs/decisions/`, one file per
decision, numbered sequentially (`0001-`, `0002-`, ...). Each ADR states its Context,
Decision, and Consequences at the time it was made. ADRs are never edited to change
their decision after the fact — if a decision is reversed or replaced, a new ADR is
added and links back to the one it supersedes.

## Consequences

- Anyone joining the project can read `docs/decisions/` in order to understand why the
  system looks the way it does.
- Slightly more overhead per decision (one short file), in exchange for not losing the
  reasoning.
