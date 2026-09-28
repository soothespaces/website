# MVP Scope & Reach Goals

This is the final scope: the MVP, which must work as a lo-fi build by **Fri Oct 16**
and at full quality by **Fri Nov 6** (the Minimum Requirement Deliverable), and the
reach goals after that, ranked by how much they help target users compared with what
they cost. Each item names the work package it belongs to (see
[Work Breakdown](work-breakdown.md)). Dates are in [Roadmap](roadmap.md).

Sources: the 2026-09-27 planning meeting, the team's "Project MVP Scope" notes, peer
feedback (Catherine Fan), and what the data actually supports
([Features](features.md), [Data Sources](../technical/data-sources.md)).

## Decisions

- **Website only**, responsive and **mobile-first**, working at every screen size.
- **Auth**: Supabase + Google OAuth, `@umich.edu` accounts only, passwordless
  ([ADR 0003](../decisions/0003-supabase-as-backend.md)).
- **Anyone can browse and read aggregated check-in data. Only `@umich.edu` users can
  submit a check-in** ([ADR 0007](../decisions/0007-anonymous-check-ins-public-aggregates.md)).
  Public pages only ever show aggregates. Raw submissions and who made them are
  never readable by other users.
- **Map stack**: MapLibre GL + react-map-gl + OpenStreetMap
  ([ADR 0006](../decisions/0006-maplibre-react-map-gl-osm.md)).
- **Design**: monochrome with one accent color, built on Tailwind design tokens.
  Minimal and low-stimulation.
- **List view alongside the map**, which users can set as their default.
- **Floor-plan pipeline stays in Python**. It's an offline batch job that writes
  images and room masks to Supabase Storage.

## Terminology: "check-in", not "review"

"Review" suggests writing, and there's no free text anywhere. Use **check-in**:

- It suggests something quick that you do while you're there, which is what we want.
  The busyness-by-hour feature depends on data from people who are actually in the
  space.
- It explains why every submission is timestamped.
- It doesn't suggest stars or a written opinion.

UI copy: button **"Check in"**. Aggregates: **"Based on 14 check-ins"**. Avoid
"report", which sounds like flagging abuse.

**Check-in form** (WP4 finalizes this in Phase 1; it
reuses UM Library's taxonomy where one exists):

| Dimension | Input |
|---|---|
| Noise | quiet / low noise / conversational / loud |
| Light | dim / moderate / bright, plus a "natural light" chip |
| Busyness | empty / some seats / half full / mostly full / packed |
| Easy to focus? | very easy → very hard (5-point) |
| Features present | chips: outlets, whiteboards, step-free access, all-gender restroom nearby, … |
| When | defaults to now; "I was here earlier today" lets the user pick a time |

## Where busyness data can come from

The question was whether Google's live busyness data can cover buildings that have
no Waitz ID.

| Source | Coverage | Legitimate? | Verdict |
|---|---|---|---|
| **Waitz** | A small number of UM buildings/floors | Yes, with our own key ([ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md)) | **Use** where available |
| **Google Popular Times / live busyness** | Whole buildings Google has enough traffic data for; never rooms or floors | **No official API.** The Places API doesn't expose it. The libraries that exist (e.g. `populartimes`) scrape Google Maps' internal endpoints, which breaks Google's terms and gets blocked | **Don't build on it** |
| **BestTime.app** | Public venues (whole buildings); forecasts plus some live signal | Yes; commercial API, free test tier, paid plans | **Possible P3.** Building-level only, and there's a cost. Try the free tier on a few buildings before committing |
| **Our own check-ins** | Any space or room anyone checks in to | Yes (it's our own data) | **Primary source outside Waitz buildings**: recent check-ins now (P1), patterns by weekday and hour later (P2) |
| **Class schedules** (Registrar `room-schedules.json`) | Buildings with scheduled classrooms | Yes | **P2 heuristic**: classes starting or ending in a building predict foot traffic, and it also powers "classroom free now" |
| **Campus Wi-Fi device counts** (UM ITS / Library) | Potentially every building. Waitz itself likely runs on this kind of signal | Only with campus approval | **Ask early** (external comms). Approval could take months, so don't depend on it |

Bottom line: no legitimate source gives Google-quality live busyness for buildings
without Waitz. Where there's no Waitz, show the **most recent check-ins with their
age** ("Busy, 25 min ago · 3 check-ins"). Show "no recent data" when there's nothing,
and never guess.

## Peer feedback and what changed

| Feedback | Response |
|---|---|
| Real need; "not-only-you" is well met by community feedback, list view, and high contrast | No change. These stay in the MVP. |
| "APIs can provide light and noise levels" | **No API provides these.** That's the whole reason for check-ins. The only official source is UM Library's tags (34 spaces). The planning doc should say this explicitly. |
| Historical tracking + active data collection, possibly with campus approval | Check-in timestamps give historical patterns (P2). Requesting campus Wi-Fi/occupancy data is a P1 outreach task. |
| Busyness from Google Maps | Assessed above: no legitimate API. BestTime is a paid P3 option. |
| Physical noise-sensing hardware | Out of scope (hardware, approvals, upkeep). **Software substitute (P2):** an optional microphone reading during a check-in. It's computed on the device, only a relative level is sent, and no audio is ever recorded or uploaded. |
| Predict busyness/noise from history | P2 is a simple weekday × hour aggregate. ML stays P3; it needs far more data than we'll have. |
| "Influence the present day" | **P1 "right now" view**: sort and filter by live Waitz data and recent check-ins. |
| Prioritize the people who really need it | **P1 "My needs" profile**: saved preferences (quiet, dim, step-free, all-gender restroom, …) that set default filters and ranking. It's stored like a setting and never tied to a diagnosis or shown publicly. |
| Business partnerships | Not an engineering item. Campus partners come first: Services for Students with Disabilities, the Library, and ITS for data access and recruiting testers. Off-campus businesses are listed under "considered, not planned". |

## MVP

The MVP has two checkpoints, which are two of the assignment's required milestones
(see [Roadmap](roadmap.md#strategic-milestones)):

- **★ Preliminary Solution, Fri Oct 16 (lo-fi build).** The core flow works end to
  end, roughness allowed: open the map, pick a space, see its details, sign in, check
  in, open the Shapiro floor plan. Fall break is Oct 17–20, so Oct 21–22 is for fixes
  only.
- **★ Minimum Requirement Deliverable, Fri Nov 6.** All 9 items at full quality with
  real data, lo-fi feedback fixed, WCAG audit passing on core pages. This is the build
  that usability testing starts on (Nov 9).

Packages are defined in [Work Breakdown](work-breakdown.md).

| # | Item (full scope, by Nov 6) | Lo-fi cut (Oct 16) | Package |
|---|---|---|---|
| 1 | Design tokens + base components | Tokens + button, chip, panel | WP1 |
| 2 | App shell: header/nav, footer, landing page, Privacy/ToS placeholder pages, responsive layout. Returning users go straight to the map | Header + landing stub | WP1 |
| 3 | Settings: light/dark, high contrast, font size, reduced motion, default view. Guests' settings in localStorage, with a sign-up banner | Light/dark only | WP2 |
| 4 | Map view: building footprints + study-space pins (34 official library spaces + 24 mguide spaces) | Yes | WP3 |
| 5 | Space detail panel: official features, noise, photo, plus slots for other packages | Yes | WP3 |
| 6 | List view + filters (noise level, `spaceFeatures`), sharing state with the map | Noise filter only | WP3 |
| 7 | Sign-in: Google OAuth restricted to `@umich.edu`, with a sign-in prompt on "Check in" | Yes | WP4 |
| 8 | Check-ins: the form above, anonymous storage, public aggregates in the detail panel | Form + save + simple counts | WP4 |
| 9 | Floor-plan pilot: Shapiro (and possibly East Quad), floor switcher, clickable room zones, checking in to a room, shown as a map overlay | One Shapiro floor as an image with clickable rooms, in a panel (the fallback path) | WP5 |

For item 9, the Nov 6 overlay can use Shapiro's corners aligned by hand; the reusable
alignment tool is P1.

Not in the MVP, on purpose: room availability and busyness (both start in P1),
floor plans beyond the pilot.

## Reach goals

The capacity check in [Roadmap](roadmap.md#working-hours-available) (about 375
team-hours, at an assumed 10 h/person/week) leaves roughly 75 h after testing, in
Phase 8 (Nov 19 → Dec 4), for fixes from usability testing **plus** reach goals. So:
P1 is what Phase 8 aims for, in priority order after test fixes. P2 happens only if
capacity allows. Isolated packages (WP6 is server-only) can start earlier if someone
has slack before Nov 6.

### P1: Phase 8 (Nov 19 → Dec 4), in priority order after test fixes

| Item | Package |
|---|---|
| **Room and seat availability from LibCal**: "available now" badge and filter, deep link to book, matched to floor-plan rooms by room number ([ADR 0008](../decisions/0008-libcal-availability-read-only.md)) | WP6 |
| "Right now" busyness: live Waitz where available, plus recent check-ins with their age | WP7 |
| "My needs" profile: saved preferences that set default filters and ranking | WP2 (stores it) + WP3 (applies it) |
| Colorblind modes | WP2 |
| Search (spaces, buildings, room numbers) | WP3 |
| Floor plans for all 7 library buildings: pipeline hardening + alignment tool ([ADR 0005](../decisions/0005-manual-floor-plan-alignment-tool.md)) | WP5 |
| Synced settings for signed-in users | WP2 |

Campus outreach isn't in this list because it starts now, in Phase 1: Library
(official LibCal API credentials), SSD (recruiting for contextual interviews and
usability testing), ITS (occupancy data).

LibCal availability moved up from the old P3 "private room booking" item. The research
showed booking is unified across three LibCal instances and availability is readable
today, so the biggest risk ("every library has its own system") turned out not to
apply.

### P2: only if capacity allows before feature complete (Dec 4)

| Item | Package |
|---|---|
| Busyness patterns by weekday × hour (and week of term) from check-ins, seeded with simulated data for the demo | WP7 |
| Classroom "free right now" from Registrar schedules (same badge and filter as LibCal) | WP6 |
| Accessibility layer: accessible entrances, ramp/elevator directions, all-gender/accessible restrooms | WP3 |
| Floor plans beyond libraries, starting with dorm lounges | WP5 |
| Optional microphone noise sample during a check-in (on-device, relative level only) | WP4 |
| Onboarding and demo polish; final demo video | WP1 + non-engineering |
| User photos on spaces/rooms, **only if a moderation plan exists by Nov 18** | WP4 |

### P3: stretch

Step-free route planning · BestTime building-level forecasts · ML busyness prediction
· 2.5D building extrusion.

### Considered, not planned

Physical noise sensors (hardware and approvals), Google Popular Times scraping
(against Google's terms), off-campus business partnerships (outside the
campus-focused scope; worth mentioning as future work in the planning doc).
