# 0007 — Anonymous Check-ins, Public Aggregates Only

Date: 2026-09-28

## Status

Accepted

## Context

Community ratings of spaces and rooms (noise, light, busyness, how easy it is to
focus, features present) are the main source of sensory data. Nothing else provides
them. The meeting raised two worries: exposing students' identities, and whether
guests should see this data at all. Submissions have no free text, and the word
"review" suggests there is.

## Decision

- Contributions are called **check-ins**: structured, timestamped, no free text.
- **Only signed-in `@umich.edu` users can submit.** Anyone, including guests, can
  read the aggregated results.
- Raw `check_ins` rows, including `user_id`, **are never readable by clients**
  (row-level security: users can insert their own rows, and no one can select raw
  rows). Public data only comes from aggregate views/functions: counts,
  distributions, most recent check-in times bucketed to about 15 minutes.
- Check-ins never ask about diagnoses or disabilities. They describe the space, not
  the person.

## Consequences

- Guests get the product's core value without signing in. Signing in is only needed
  to contribute.
- Only aggregates are ever exposed, so there's no reviewer PII to leak publicly.
  Rounded timestamps and counts make it hard to trace a single check-in back to a
  person.
- Moderation stays simple, since there's no free text to moderate. Photos, if added,
  would change that (see [MVP Scope](../product/mvp-scope.md)).
- `user_id` is kept for rate limiting and abuse handling only (e.g. one check-in per
  space per user per hour), never for display.
