# Features

Core UI features from the initial concept. The interface overall is designed for high
legibility, ease of navigation, and strict WCAG adherence.

Each feature below is marked with how ready the data is, based on
[Data Sources](../technical/data-sources.md): ✅ **Possible now** (including features
that are crowdsourced by design, where "no data yet" is expected, not a gap), or
⚠️ **Partially possible** (real data exists but has real coverage/completeness limits).

## Interactive 2D Map Viewer

The central interface: an interactive campus map rendering GeoJSON building footprints
and MPrint interior layouts. Users pan and zoom across the map; study zones appear as
interactive, color-coded pins layered over the facilities.

- ✅ **Building footprints and pins.** 466 (mguide) or 265 (official) building
  polygons, and two real `StudySpace` sources — 34 official UM Library spaces (§9) and
  24 mguide-derived spaces (§1) — are enough to render a real map with real pins today.
- ⚠️ **MPrint interior layouts, partially — better than it looked.** A raster
  reference image per floor works today (§5), for buildings whose MPrint tag is known
  (112/466 via `acronym`, more via probing). Beyond that: a prototype pipeline
  (OCR + dilated flood fill) can auto-extract clickable per-room zones from these
  images, validated on a real floor plan — see
  [MPrint Room Extraction](../technical/mprint-extraction.md). The actual use case
  (clicking a zone on the displayed floor plan to attach a sensory review, not
  placing a room as a pin on the outdoor map) doesn't need georeferencing or clean
  polygons at all, so this is closer to done than "interior mapping" first sounded —
  the remaining work is OCR accuracy and per-image tuning, tested on only 2 buildings
  so far, not a from-scratch manual effort.

## Multi-Attribute Filtering Panel

A faceted search menu that filters map pins by strict environmental criteria: baseline
noise level (quiet, moderate, social) and specific amenities (outlets, whiteboards,
group rooms). Fully keyboard-navigable and screen-reader optimized.

- ✅ **Noise-level filtering.** Real values exist: UM Library's proper 3-tier scale
  (`quiet`/`conversational`/`low_noise`, 7 libraries) and mguide's coarser
  `quiet`/`moderate`/`social` (17 buildings) — different scales that need reconciling
  (see [Data Model](../technical/data-model.md)), but the filtering is buildable now.
- ✅ **Amenity filtering — and richer than the proposal envisioned, for libraries.**
  UM Library's `spaceFeatures` (`natural_light`, `wheelchair_accessible`,
  `all_gender_restroom_on_floor`, `whiteboards`, `bookable`, `external_monitors`) is a
  better-fit taxonomy than generic amenities, and it's real, official data for those 7
  buildings. Generic amenities (wifi, outlets, computers, printing, groupRooms,
  scanners) exist for the other 17 mguide-covered buildings.
- ✅ **Keyboard nav / screen-reader support.** Pure UI engineering, no data dependency
  — buildable regardless. mguide.app's own accessibility state (dyslexic font, high
  contrast, large text, reduced motion, screen-reader mode) is a useful scope reference.

## WCAG-Compliant Display Controls

Built-in toggles for high-contrast viewing modes, scalable text, and reduced-motion
animations, to directly accommodate users with visual impairments or sensory
processing sensitivities.

- ✅ **Fully possible, zero data dependency.** This is entirely client-side UI state —
  nothing here waits on any data source. Build whenever convenient.

## Real-Time Spot Detail Cards

Clicking a map pin opens an interactive detail modal showing community ratings,
verified amenities, maximum capacity, and live crowd density pulled from the Waitz
integration.

- ✅ **Community ratings — by design, not a gap.** These were never meant to come
  from a data source; they're crowdsourced from day one (see Crowdsourced
  Contribution Flow below), so "zero pre-existing ratings" is the correct starting
  state, not a shortfall to fix. Design the empty state (a space with no ratings yet)
  as a first-class case rather than an afterthought, since most spaces start there.
- ✅ **Verified amenities.** Same data as the filtering panel above.
- ⚠️ **Maximum capacity, partially.** Present on the 24 mguide-derived spaces; absent
  from the 34 official UM Library spaces (nothing in `fass-data` or the individual
  library pages had a seat count — checked). Either survey it manually for library
  spaces or ship without capacity there.
- ⚠️ **Live crowd density (Waitz), partially.** Requires our own Waitz API access —
  [ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md) rules out
  depending on mguide.app's proxy — which isn't obtained yet. Even once we have it,
  coverage is sparse: only 6 of the 24 mguide spaces have a `waitzId`, and the 34
  (higher-quality) UM Library spaces have no Waitz mapping at all yet — that mapping
  would need to be built by hand against whatever Waitz actually tracks for UM
  libraries.

## Crowdsourced Contribution Flow

An accessible tagging form lets authenticated users drop new coordinate pins onto the
map to document dynamic physical barriers or submit new sensory ratings for unmarked
study spots — keeping the underlying data accurate over time.

- ✅ **Fully possible now.** Auth (Google OAuth via Supabase, `@umich.edu`-restricted)
  and the backend (Supabase + RLS, [ADR 0003](../decisions/0003-supabase-as-backend.md))
  are already decided. This feature doesn't depend on any external data source since
  it's new data the app creates going forward — and it's the main mechanism that will
  close the coverage and rating gaps everything else above has.

## Additional Features Enabled by Available Data

Not in the original proposal, but directly supported by data found during sourcing
(see [Data Sources](../technical/data-sources.md)) and squarely on-mission for a
sensory/accessibility-focused app. Worth considering for scope, roughly in order of
how directly they serve the "not-only-you" premise:

- **Accessible route planning between buildings.** `pathways.geojson` (§6) has 13,817
  path segments tagged `wheelchair`/`surface`/`lit` — the network a step-free routing
  feature needs. mguide.app has this exact feature (`accessibleRouteMode`), so it's a
  proven concept, not a novel one.
- **Gender-inclusive & wheelchair-accessible restroom finder.** `restrooms.json` (§6,
  87 buildings, sourced from Refuge Restrooms) plus `fass-data`'s per-space
  `all_gender_restroom_on_floor` tag (§9). Directly serves the target audience.
- **Accessible parking finder.** The official `parking` type's `accessiblespace` flag
  (§8) — nothing else in the data covers getting to campus by car at all.
- **"How to get in" building access cards.** `rampAccess`/`elevatorAccess` free text
  (§8, official) surfaced as their own info panel per building, not just a filter
  toggle — genuinely useful prose ("a ramp is located at the north entrance near the
  Diag") that a boolean filter would throw away.
- **Interactive floor-plan viewer.** Display the raw MPrint PNG for a building/floor,
  zoomable/pannable, with each room clickable to attach or read a sensory review
  (noise, light, etc.) for that specific zone — like clicking a wing on a mall
  directory. This has a validated automated path (see
  [MPrint Room Extraction](../technical/mprint-extraction.md)): the zones only need to
  be clickable on the image itself, not placed on the outdoor map, so no
  georeferencing or clean polygon shapes are required — a plain zoomable image with no
  clickable zones is the fallback if the extraction isn't ready in time, not a
  separate feature to build twice.
- **Accessible-classroom/meeting-space finder.** `rooms.json`'s per-room equipment
  (§6) — `assistive-listening`, `wheelchair-instructor`, `tables-moveable` — could
  extend the app past informal lounges to help someone find a specific accessible
  room, not just a quiet spot.
- **Real photos on space/building cards.** `image.php?d={slug}` (§8) and `fass-data`'s
  `imageUrl` (§9) — lets a sensory-sensitive user see a space before traveling there,
  which a text description alone can't convey.
- **Building history/context card.** `history` (architect, year built, style, notable
  facts — §2&3) is free, low-effort polish content already sitting in the data; not
  core to the mission, but a nice-to-have.
- **Bus/transit directions to a space.** Two GTFS feeds (campus bus + TheRide, §6) —
  complements accessible routing for users who can't or prefer not to walk far.

---

Technical grounding for these features:
[Architecture](../technical/architecture.md),
[Data Model](../technical/data-model.md),
[Integrations](../technical/integrations.md),
[Data Sources](../technical/data-sources.md).
