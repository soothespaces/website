# 0008 — Room Availability from LibCal: Read-Only, Cached, Deep-Link to Book

Date: 2026-09-28

## Status

Accepted

## Context

Knowing which rooms and seats are free right now was named the most useful feature
beyond finding spaces. UM's bookable study spaces (libraries, North Campus engineering
buildings, central campus rooms) all run on Springshare LibCal across three instances
(see [Data Sources § 10](../technical/data-sources.md#10-libcal-bookable-rooms-and-seats-unified-live-availability)).
LibCal's official API needs credentials from UM's LibCal admin, which we don't have.
The public booking pages load availability from an unauthenticated JSON endpoint.

## Decision

- Show availability **read-only**. The app never creates, changes, or cancels
  bookings. "Book" deep-links to the item's own LibCal page, where the student signs
  in with their UM account.
- Fetch **server-side only** (a Next.js route handler or scheduled job), never from
  the browser. Cache per location for at least 5 minutes, and only for locations the
  app actually shows. That's a few requests per hour per location, well below what one
  person browsing the booking page generates.
- **Ask the Library for official read-only LibCal API credentials** as an outreach
  task. If granted, switch to the official API. If asked to stop using the public
  endpoint, stop.
- Store only availability state plus item metadata (room name, number, capacity).
  Never store who booked what; the endpoint doesn't expose it and we wouldn't keep it.

## Consequences

- Live availability for every bookable room and seat on the three instances, joined
  to floor-plan rooms by room number, at low load on UM's systems.
- The undocumented endpoint can change without notice. The integration lives in one
  module with a "availability unavailable" fallback state, so a breakage never takes
  the rest of the app down.
- Unlike [ADR 0004](0004-do-not-depend-on-mguide-waitz-proxy.md) (Waitz via a third
  party's proxy), this reads UM's own public booking system directly, with the
  official-credentials path as the goal.
