# MVP Scope & Prioritized Reach Features

Distilled from the 2026-09-27 planning meeting and the team's "Project MVP Scope" notes,
checked against what the data actually supports (see [Features](features.md) and
[Data Sources](../technical/data-sources.md)). The MVP is what must work for the
**lo-fi prototype peer review (Oct 23)** and demo video (Oct 28). Everything else is a
reach feature, ranked by how much it helps the target users compared with what it
costs. Dates are in [Roadmap](roadmap.md).

## Decisions made in the meeting

- **Website only**, responsive and **mobile-first**: breakpoints change the layout
  (for example, the nav collapses to a hamburger menu). Phone and desktop both work.
- **Auth**: Supabase + Google OAuth, `@umich.edu` accounts only, passwordless. No
  email/password or other providers, since each one adds complexity
  ([ADR 0003](../decisions/0003-supabase-as-backend.md)).
- **Guests can browse** without an account. Actions that need an account prompt a
  sign-in.
- **Map stack**: MapLibre GL + `react-map-gl` + OpenStreetMap data, with the required
  OSM attribution shown on the map ([ADR 0006](../decisions/0006-maplibre-react-map-gl-osm.md)).
- **Reviews are anonymous, written only by `@umich.edu` users, and have no free
  text.** They're chip toggles and short scales, because typing is the biggest
  barrier to leaving a review. Reviews never ask about a diagnosis or disability.
  They describe the *space* (for example, "is this ADHD-friendly") instead of the
  reviewer.
- **Reviews are timestamped**, which is what makes busyness-by-day/hour possible later.
- **Design**: monochrome (black, grey, white) with one accent color, all set through
  Tailwind design tokens so contrast and colorblind modes can swap colors in later.
  Minimal, low-stimulation.
- **List view alongside the map**, and some users (for example, screen-reader users)
  can make it the default.
- **Floor-plan pipeline stays in Python.** It runs offline as a batch job that writes
  static assets (floor-plan images and room masks) to Supabase Storage. It never runs
  inside the web app, so a TypeScript rewrite would add nothing, and the working
  prototype is already Python ([MPrint Room Extraction](../technical/mprint-extraction.md)).

## Open question for the team

- **Should guests be able to *read* reviews?** The meeting put "view reviews" behind
  login, but reviews are anonymous, so login protects nobody's privacy. It does leave
  guests with little to look at. The recommendation, and what this plan assumes, is
  that **reading is public and writing requires login**. Confirm or overrule.

## MVP (lo-fi prototype, working build by Fri Oct 16)

The build has to be done by **Oct 16**, not the Oct 23 peer review, because fall
break is Oct 17–20. Treat Oct 21–22 as buffer for fixes only. Items are listed
roughly in build-dependency order, and every one has the data it needs today.

1. **App shell**: header with logo and nav, footer linking placeholder Privacy
   Policy and Terms of Service pages, a landing page (what it is, why it helps, CTA to
   sign up or explore), design tokens, and a responsive layout. Signed-in and
   returning users go straight to the map.
2. **Map view**: building footprints and study-space pins, seeded from UM Library's 34
   official spaces plus the 24 mguide-derived spaces.
3. **Space detail panel**: the official features (natural light, wheelchair
   accessible, all-gender restroom on floor, …), noise level, photo, and aggregated
   community ratings.
4. **List view**: the same spaces and filters as the map, in an accessible list.
5. **Filters**: noise level plus `spaceFeatures` chips.
6. **Sign-in**: Google OAuth restricted to `@umich.edu`, with a sign-in prompt on
   "add review".
7. **Chip-based reviews**: anonymous and timestamped, covering noise, light, busyness,
   and focus-friendliness (5-point, "very friendly" to "very hostile"), plus feature
   chips a reviewer can confirm. Results show as aggregates on the detail panel.
8. **Accessibility settings**: light/dark theme, high contrast, font size, reduced
   motion. Guests' settings live in localStorage, with a banner suggesting they sign
   up to keep them.
9. **Floor-plan pilot**: one or two buildings (Shapiro, and possibly East Quad) with a
   floor switcher and clickable room zones from the extraction pipeline. Rooms can be
   reviewed individually. **This is the riskiest MVP item and also what sets the
   project apart.** Fallback: show the floor plan as a plain image in a panel if the
   aligned map overlay isn't ready.

**Not in the MVP, on purpose:** live Waitz occupancy (we still need our own API key,
[ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md), so spaces show
"live data unavailable"), busyness patterns, and floor plans beyond the pilot.

## Reach features, in priority order

### P1: by usability testing (Nov 13)

These make the MVP something people can properly test.

1. **WCAG audit pass** (axe/Lighthouse on every core page) plus colorblind modes.
   Accessibility is the core promise of the product, so this can't slip to December.
2. **Floor plans for all 7 library buildings**: harden the pipeline, build the
   internal alignment tool ([ADR 0005](../decisions/0005-manual-floor-plan-alignment-tool.md)),
   then align building by building.
3. **Live Waitz occupancy** for spaces that have a Waitz ID, if we have the key by then.
4. **Synced settings** for signed-in users.

### P2: by the final demo (Dec 11)

5. **Busyness by weekday and hour**, built from review timestamps: a simple
   aggregate histogram, not ML, broken down by week of term. For the demo, seed it
   with **simulated review data**, because we won't have hundreds of real reviewers.
6. **"Is this classroom free right now?"**, using Registrar schedule data
   (`rooms.json`, `room-schedules.json`), which we already have. The meeting called
   availability the most useful add-on, and classrooms are the part we can actually
   get.
7. **Accessibility layer**: accessible entrances, ramp and elevator directions per
   building, and all-gender/accessible restrooms. All of this data is already sourced.
8. **Floor plans beyond libraries** (priority dorm lounges and study areas).
9. **User photos on spaces and rooms.** These need a moderation plan first, because
   anonymous uploads can contain inappropriate content or bystanders' faces.

### P3: stretch, after the course if time allows

10. **Accessible (step-free) route planning** between buildings.
11. **Private study-room booking/availability.** Every library runs its own booking
    system, so this first needs research into whether any of them has a usable API.
12. **Google Popular Times.** The API key costs money and the terms are restrictive;
    our own review-based pattern (#5) is the substitute.
13. **ML busyness prediction** (week of term, midterm weeks, …). It needs far more
    telemetry than we'll have.
14. **2.5D building extrusion**, as visual polish.
