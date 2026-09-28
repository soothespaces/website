# Work Breakdown

The product is split into **work packages**. Each one is a slice that a single person
can own end to end: its UI, its Supabase tables and policies, its server routes, and
its scripts. The goal is that nobody hands work across layers, and packages only touch
each other through a small set of agreed contracts (below), so they can be built in
parallel and joined at the end.

**Assignment is deliberately deferred.** One person can own more than one package, and
packages that only start after the MVP (WP6, WP7) can be picked up by whoever frees up
first. The only owner ideas so far: **WP1 → Tanner, WP2 → Mark.** Scope per phase
(MVP / P1 / P2) is defined in [MVP Scope](mvp-scope.md).

## Packages

### WP1: Design System & App Shell

The visual language and everything outside the map.

| | |
|---|---|
| **MVP** | Design tokens (monochrome + one accent, light/dark variants) in the Tailwind config. Base components: button, chip, toggle, slider/scale, sheet/panel, banner, dialog. App shell: header/nav, footer, landing page, Privacy/ToS placeholder pages, responsive layout. Returning users go straight to the map |
| **P1/P2** | Onboarding, demo polish, component states the other packages need |
| **Owns** | `src/components/ui/`, the Tailwind tokens, marketing and legal routes |
| **Provides** | Tokens and components, used by every other package |
| **Starts first** | Everyone depends on it. Target: tokens + base components merged by Fri Oct 3 |

### WP2: Accessibility & Preferences

How the app adapts to each user.

| | |
|---|---|
| **MVP** | Settings page: light/dark, high contrast, font size, reduced motion. Guests' settings in localStorage, with a sign-up banner. Default view (map or list) |
| **P1** | Colorblind modes. WCAG audit pass (axe/Lighthouse) across every package's pages. Synced settings for signed-in users. **"My needs" profile**: saved preferences (quiet, dim, step-free, all-gender restroom, …) |
| **Owns** | Settings route, `useSettings()`, the `user_settings` table, the accessibility audit checklist |
| **Provides** | `useSettings()`, including the `needs` object that WP3 reads to set default filters and ranking |
| **Consumes** | WP1 tokens (contrast and colorblind modes swap token values, so WP1 and WP2 agree the token structure together in week 1). WP4 `useSession()` for synced settings |

### WP3: Places & Discovery

What exists on campus and how you find it.

| | |
|---|---|
| **MVP** | `buildings` + `spaces` tables and seed import (UM Library's 34 spaces, mguide's 24, building footprints). Map view (MapLibre). Space pins. Space detail panel with slots. List view. Filters, with state shared between map and list |
| **P1** | Search (spaces, buildings, room numbers). Ranking/default filters from WP2's `needs` profile |
| **P2** | Accessibility layer: accessible entrances, ramp/elevator directions, restrooms |
| **Owns** | Map and list routes, `src/features/places/`, `buildings`/`spaces` and their migrations, `scripts/seed/` |
| **Provides** | The map instance (for WP5's overlay), the detail panel slots, `spaces` IDs |

### WP4: Accounts & Check-ins

Who can contribute, and the contributions themselves.

| | |
|---|---|
| **MVP** | Google OAuth restricted to `@umich.edu`. `useSession()`. Sign-in prompt. Check-in form. The `check_ins` table with policies (insert own rows only, raw rows never readable). Aggregate views. `<CheckInSummary>` and `<CheckInButton>` components ([ADR 0007](../decisions/0007-anonymous-check-ins-public-aggregates.md)) |
| **P2** | Optional microphone noise sample. User photos, only with a moderation plan |
| **Owns** | Auth config and callback, `src/features/checkins/`, `check_ins` and its aggregate views/functions |
| **Provides** | `useSession()`, the check-in components, check-in aggregates (read by WP7) |

### WP5: Indoor Maps

Zooming from campus down into floors and rooms.

| | |
|---|---|
| **MVP** | Floor-plan pilot on Shapiro (and possibly East Quad): extraction pipeline → images + room masks in Storage, `floor_plans` + `room_zones` tables, map overlay (fallback: plain image in a panel), floor switcher, clickable rooms, a room sheet with slots |
| **P1** | Alignment tool ([ADR 0005](../decisions/0005-manual-floor-plan-alignment-tool.md)). All 7 library buildings. Pipeline hardening |
| **P2** | Floor plans beyond libraries (dorm lounges) |
| **Owns** | `scripts/mprint/`, `src/features/floorplans/`, the admin alignment route, `floor_plans`/`room_zones` and their migrations |
| **Provides** | `room_zones` (with building + room number, the join key WP6 uses), room sheet slots |

### WP6: Availability (post-MVP)

What's free right now: bookable rooms and seats, plus open classrooms.

| | |
|---|---|
| **P1** | LibCal availability for all three instances ([Data Sources § 10](../technical/data-sources.md#10-libcal-bookable-rooms-and-seats-unified-live-availability), [ADR 0008](../decisions/0008-libcal-availability-read-only.md)): server-side fetch + cache, item metadata import, matching items to spaces/room zones by room number, `<AvailabilityBadge>`, "available now" filter, deep link to book |
| **P2** | Classroom "free right now" from Registrar schedules (`room-schedules.json`) through the same badge and filter |
| **Owns** | `src/features/availability/`, the LibCal route/job, `bookable_items` and availability cache tables |
| **Consumes** | WP3 `spaces`, WP5 `room_zones`, WP3's filter hook |
| **Early start is safe** | The fetcher and cache are server-only with no UI dependencies, so this can be spiked before Oct 16 by anyone with slack |

### WP7: Busyness (post-MVP)

How crowded a place is: live where possible, historical otherwise.

| | |
|---|---|
| **P1** | "Right now": live Waitz where available (our own key, [ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md)) + recent check-ins with their age. Sorting by current conditions |
| **P2** | Patterns by weekday × hour (and week of term) from check-in aggregates. Simulated-data generator for the demo |
| **Owns** | `src/features/busyness/`, the Waitz route, pattern views |
| **Consumes** | WP4 check-in aggregates, WP3 detail panel and sort hooks |

## Contracts: agree on these in one meeting on Wed Oct 1

These are the only places where packages touch.

**Shared IDs / schema** (each package writes its own migrations):

| Table | Package | Fields other packages depend on |
|---|---|---|
| `buildings` | WP3 | `slug` (PK), `acronym`, `footprint` |
| `spaces` | WP3 | `id`, `building_slug` |
| `floor_plans` | WP5 | `id`, `building_slug`, `floor_number` |
| `room_zones` | WP5 | `id`, `floor_plan_id`, `room_number`, `space_id` (nullable) |
| `check_ins` | WP4 | exactly one of `space_id` / `room_zone_id` |
| `user_settings` | WP2 | `user_id`, `settings` JSON (WP2 and WP3 agree the shape of `needs`) |
| `bookable_items` | WP6 | `libcal_item_id`, `space_id` / `room_zone_id` (nullable) |

**Target type**, used by every component that shows or submits data about a place:
`{ kind: 'space' | 'room', id }`.

**UI slots:**

- WP3's space detail panel renders `<CheckInSummary>` and `<CheckInButton>` (WP4),
  `<FloorPlanEntry buildingSlug>` (WP5), `<AvailabilityBadge>` (WP6), and
  `<BusynessNow>` (WP7). Each slot renders nothing until its package ships, so the
  panel never waits on anyone.
- WP5's room sheet renders the same components with `kind: 'room'`.
- WP3's map exposes the MapLibre instance. WP5 adds its overlay layers to it.

**Hooks:** `useSession()` (WP4), `useSettings()` (WP2), plus WP1's tokens and
components, used everywhere.

## Sequencing to the lo-fi build (Oct 16)

| By | Package | Deliverable |
|---|---|---|
| Wed Oct 1 | All | Contracts meeting |
| Fri Oct 3 | WP1 | Tokens + base components merged (WP1 and WP2 agree the token structure first) |
| Fri Oct 3 | WP3 | Supabase project + `buildings`/`spaces` seeded; preview deploys working |
| Mon Oct 6 | WP4 | Sign-in works; `useSession()` merged |
| Fri Oct 9 | WP1–WP5 | Each package works on its own, against mocks where needed |
| Wed Oct 14 | All | Slots wired together; the full flow works end to end |
| Fri Oct 16 | All | **Lo-fi build complete** (then fall break) |

## Working agreements

- **Each PR is reviewed by someone who doesn't own that package.**
- **Daily async status** in the group chat; **weekly scope check** against the roadmap.
- **An owner can cut scope in their own package** using its documented fallback,
  flagged in the weekly check. Changing a contract needs every package it touches.
- **Course documents follow packages.** Each owner writes their package's part of the
  requirements, lo-fi write-up, and testing report.
