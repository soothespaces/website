# 0011 — Signed-in users can see their own check-in history

Date: 2026-10-15

## Status

Accepted. Amends [0007](0007-anonymous-check-ins-public-aggregates.md).

## Context

[ADR 0007](0007-anonymous-check-ins-public-aggregates.md) says raw `check_ins` rows
are never readable by clients and `user_id` is kept only for rate limiting. That
also stops a student from seeing their own check-ins.

The side-panel design has a "Your spots" section: the places you keep coming back to,
how many times you've checked in to each, and when you were last there. It needs a
per-user view of that student's own check-ins. Tanner chose to amend 0007 for it
(2026-10-15).

## Decision

- A signed-in user can read **their own** check-in counts and last-visit dates, per
  space or room, through one function: `public.my_check_in_history()`.
- The function filters on `auth.uid()` inside a `security definer` body. It takes no
  user argument, so there's no way to ask for someone else's history.
- It returns one row per target: the target kind and id, the number of check-ins and
  the last day visited (America/Detroit date). It never returns raw rows, row ids,
  `user_id`, exact times or answers (noise, light and so on).
- Only `authenticated` can execute it. Guests have no history.
- Raw rows stay in `private.check_ins`, which clients still can't select. Everything
  else in 0007 stands: public data is aggregates only, and `user_id` is never shown
  to anyone else.

Saved places ("Your rotation") are a separate, ordinary per-user table,
`public.favorites`, with owner-only row-level security like `user_settings`. They
aren't check-ins and don't touch 0007.

## Consequences

- "Your spots" works without exposing anything about other users.
- `user_id` now has a second use besides rate limiting: answering the owner's own
  history. It's still never displayed or returned.
- Someone with access to a signed-in session (a shared or stolen laptop) can see
  where that person has checked in and on which days. That's the same exposure as
  any account page, and only day-level dates are returned.
- Only targets that are still listed are returned, so unlisting a space hides it from
  history too, the same as from the public aggregates.
