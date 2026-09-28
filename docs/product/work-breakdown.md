# Work Breakdown & Ownership

**The principle is vertical slices.** Each person owns one area of the product end to
end: its UI, its Supabase tables and security policies, its server routes, and its
data scripts. Nobody hands work across layers. The official roles
(Front-end & Design, Backend & DB, …) are a loose guide. Ownership is what decides who
builds and fixes a thing. Anything outside a slice (tokens, schema IDs, component
slots) is agreed once up front as a **contract**, so slices can be built at the same
time and joined at the end.

## The four slices

### Mark: Shell, Design System & Accessibility (+ External Comms)

Everything outside the map, plus the design language everyone else uses.

- **MVP:** design tokens + base components (button, chip, toggle, sheet/panel,
  banner). App shell (header/nav, footer). Landing page. Privacy/ToS placeholder
  pages. Settings page (theme, contrast, font size, reduced motion) with guest
  localStorage and a sign-up banner. Routing so returning users go straight to the
  map.
- **P1:** WCAG audit pass + colorblind modes. Synced settings (`user_settings` table).
- **P2:** onboarding and demo polish.
- **Owns:** `src/components/ui/`, the Tailwind tokens, marketing/legal/settings
  routes, `useSettings()`, and the `user_settings` table.
- **Non-engineering:** landing-page copy, campus outreach (SSD, Library, ITS data
  request), recruiting usability-test participants, demo videos (A4b, final).

### Calvin: Places & Discovery (+ Dev Infrastructure)

What exists on campus and how you find it.

- **MVP:** Supabase project setup. `buildings` + `spaces` tables and the seed import
  (UM Library's 34 spaces, mguide's 24 spaces, building footprints). Map view.
  Space pins. Space detail panel (with slots for other slices). List view. Filters,
  with state shared between map and list.
- **P1:** "My needs" profile (default filters and ranking). Search.
- **P2:** classroom "free right now" from Registrar schedules. Accessibility layer
  (entrances, ramp/elevator directions, restrooms).
- **Owns:** map and list routes, `src/features/places/`, `buildings`/`spaces` (and
  later schedule and accessibility tables) with their migrations, `scripts/seed/`.
- **Also:** Vercel preview deploys and a CI check (lint + typecheck + build) on every
  PR.

### Gjonpjer: Accounts & Community Data (+ Internal Comms)

Who can contribute, and everything the community contributes.

- **MVP:** Google OAuth restricted to `@umich.edu`. `useSession()`. The sign-in prompt.
  The check-in form. The `check_ins` table with security policies (users can insert
  their own rows; nobody can read raw rows). The aggregate query/view. The check-in
  summary and "Check in" button components.
- **P1:** "Right now": Waitz proxy route (with our own key) + recent check-ins with
  their age.
- **P2:** busyness patterns by weekday × hour + a simulated-data generator for the
  demo. Optional microphone noise sample. User photos (only if a moderation plan
  exists).
- **Owns:** auth config + callback, `src/features/checkins/`, `src/features/busyness/`,
  the Waitz route, `check_ins` + its aggregate views and functions.
- **Non-engineering:** meeting notes, the daily status thread, tracking course
  deadlines.

### Tanner: Indoor Maps (+ Product Management)

The feature that sets the project apart: zooming from the campus map down into
floors and rooms.

- **MVP:** pilot the floor plans on Shapiro (and possibly East Quad). Extraction
  pipeline → images + room masks in Storage. `floor_plans` + `room_zones` tables. Map
  overlay (or the plain-image panel fallback). Floor switcher. Clickable rooms. A room
  detail sheet that embeds Gjonpjer's check-in components.
- **P1:** internal alignment tool; floor plans for all 7 library buildings; pipeline
  hardening (OCR validation, dilation tuning).
- **P2:** floor plans beyond libraries (dorm lounges).
- **Owns:** `scripts/mprint/`, `src/features/floorplans/`, the admin alignment route,
  `floor_plans`/`room_zones` and their migrations.
- **Non-engineering:** Linear and the Gantt chart, the weekly scope check, assembling
  course documents.

## Contracts: agree on these in one meeting on Wed Oct 1

These are the only places where slices touch. Once they're agreed, each person can
build against mocks without waiting on anyone else.

**Shared IDs / schema** (each owner writes their own migration):

| Table | Owner | Key fields other slices depend on |
|---|---|---|
| `buildings` | Calvin | `slug` (PK), `acronym`, `footprint` |
| `spaces` | Calvin | `id`, `building_slug` |
| `floor_plans` | Tanner | `id`, `building_slug`, `floor_number` |
| `room_zones` | Tanner | `id`, `floor_plan_id`, `room_number`, `space_id` (nullable) |
| `check_ins` | Gjonpjer | exactly one of `space_id` / `room_zone_id` |
| `user_settings` | Mark | `user_id`, `settings` JSON (Calvin defines the shape of the `needs` key) |

**Check-in target type:** `{ kind: 'space' | 'room', id }`. It's used by every
component that shows or submits check-ins.

**UI slots:**

- Calvin's space detail panel renders `<CheckInSummary target>` and
  `<CheckInButton target>` (Gjonpjer) and `<FloorPlanEntry buildingSlug>` (Tanner).
- Calvin's map exposes the MapLibre map instance. Tanner's overlay adds its own
  sources and layers to it.
- Tanner's room sheet embeds Gjonpjer's components with `kind: 'room'`.

**Hooks:** `useSession()` (Gjonpjer), `useSettings()` (Mark), plus the tokens and
components (Mark), which everyone uses.

## Sequencing to Oct 16

| By | Who | Deliverable |
|---|---|---|
| Wed Oct 1 | All | Contracts meeting; the output is the tables above, refined |
| Fri Oct 3 | Mark | Tokens + base components merged. Others use them from here on |
| Fri Oct 3 | Calvin | Supabase project + `buildings`/`spaces` seeded; preview deploys working |
| Mon Oct 6 | Gjonpjer | Sign-in works; `useSession()` merged |
| Fri Oct 9 | Each owner | Their slice works on its own, against mocks where needed |
| Wed Oct 14 | All | Slots wired together; the full flow works end to end |
| Fri Oct 16 | All | **Lo-fi build complete** (then fall break) |

## Working agreements

- **Each PR is reviewed by someone outside that slice**, rotating. This spreads
  knowledge and avoids having a single person who knows each area.
- **Daily async status** in the group chat; **weekly scope check** (PM) against the
  roadmap.
- **An owner can cut scope in their own slice**, as long as they use the documented
  fallback and flag it in the weekly check. Changes to a contract need everyone
  whose slice it touches.
- **Course documents follow slices.** Each person writes their slice's part of the
  user requirements, lo-fi write-up, and testing report, and the PM assembles them.

## Load balance

Tanner has the riskiest slice as well as PM work. That's covered by the plain-image
fallback and by the pilot being limited to 1–2 buildings. Mark's engineering load is
lighter in the MVP because he also carries outreach, recruiting, and videos. Calvin's
slice is the largest by UI surface area but the most conventional to build.
Gjonpjer's is the smallest in the MVP and grows the most in P1/P2, when live and
historical busyness arrive.
