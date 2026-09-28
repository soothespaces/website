# MVP Scope & Reach Goals

This is the final scope: what must work for the **lo-fi prototype (build done Fri Oct
16)** and the reach goals after that, ranked by how much they help target users
compared with what they cost. Each item names one owner (see
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

**Check-in form** (the Accounts & Community owner finalizes this in Phase 1; it
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

## MVP: lo-fi prototype, build complete Fri Oct 16

Fall break is Oct 17–20, so Oct 21–22 is for fixes only.

| # | Item | Owner |
|---|---|---|
| 1 | Design tokens + base components (button, chip, toggle, sheet/panel, banner) | Mark |
| 2 | App shell: header/nav, footer, landing page, Privacy/ToS placeholder pages, responsive layout. Signed-in and returning users go straight to the map | Mark |
| 3 | Accessibility settings: light/dark, high contrast, font size, reduced motion. Guests' settings stored in localStorage, with a sign-up banner | Mark |
| 4 | Map view: building footprints + study-space pins (34 official library spaces + 24 mguide spaces) | Calvin |
| 5 | Space detail panel: official features, noise, photo, plus slots for check-in data and the floor-plan entry point | Calvin |
| 6 | List view + filters (noise level, `spaceFeatures`), sharing filter state with the map | Calvin |
| 7 | Sign-in: Google OAuth restricted to `@umich.edu`, with a sign-in prompt on "Check in" | Gjonpjer |
| 8 | Check-ins: the form above, anonymous storage, public aggregates shown in the detail panel | Gjonpjer |
| 9 | Floor-plan pilot: Shapiro (and possibly East Quad), floor switcher, clickable room zones, checking in to a room. **Fallback:** the floor plan as a plain image in a panel | Tanner |

Not in the MVP, on purpose: live Waitz (still waiting on the key), busyness history,
and floor plans beyond the pilot.

## Reach goals

### P1: by usability testing (Nov 13)

| Item | Owner |
|---|---|
| WCAG audit pass (axe/Lighthouse on core pages) + colorblind modes | Mark |
| Synced settings for signed-in users | Mark |
| Campus outreach: SSD / Library / ITS for data access and recruiting usability-test participants | Mark |
| "My needs" profile: saved preferences that set default filters and ranking | Calvin |
| Search (spaces, buildings, room numbers) | Calvin |
| "Right now": live Waitz where available, plus recent check-ins with their age; sort by current conditions | Gjonpjer |
| Floor plans for all 7 library buildings: harden the pipeline, build the alignment tool ([ADR 0005](../decisions/0005-manual-floor-plan-alignment-tool.md)) | Tanner |

### P2: by the final demo (Dec 11)

| Item | Owner |
|---|---|
| Busyness patterns by weekday × hour (and week of term) from check-ins, seeded with simulated data for the demo | Gjonpjer |
| Optional microphone noise sample during a check-in (on-device, relative level only) | Gjonpjer |
| Classroom "free right now" from Registrar schedules | Calvin |
| Accessibility layer: accessible entrances, ramp/elevator directions, all-gender/accessible restrooms | Calvin |
| Floor plans beyond libraries, starting with dorm lounges (named from `department` records) | Tanner |
| Onboarding and demo polish; final demo video | Mark |
| User photos on spaces/rooms, **only if a moderation plan exists by Nov 18** | Gjonpjer |

### P3: stretch

Step-free route planning · private study-room booking aggregation (needs research into
each library's booking system) · BestTime building-level forecasts · ML busyness
prediction · 2.5D building extrusion.

### Considered, not planned

Physical noise sensors (hardware and approvals), Google Popular Times scraping
(against Google's terms), off-campus business partnerships (outside the
campus-focused scope; worth mentioning as future work in the planning doc).
