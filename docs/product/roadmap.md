# Roadmap

Phases and milestones for EECS 497, Fall 2026. This is the source for the Gantt chart
(built as Linear projects and milestones). **What** gets built in each window is set
in [MVP Scope](mvp-scope.md); this file sets **when**.

## Calendar constraints

| Date | Course deadline | Project milestone |
|---|---|---|
| Wed Sep 30 | A2 Project Planning Document | **M1** Planning complete |
| Wed Oct 14 | A3 User Requirements Document (Quiz 2 due Oct 16) | **M2** User requirements |
| Fri Oct 16 | — (internal) | **M3** Lo-fi build complete (fall break Oct 17–20 follows) |
| Fri Oct 23 | Peer Review 2 (Lo-Fi Prototype) | **M4** Lo-fi peer review |
| Wed Oct 28 | A4a Lo-Fi Write-up + A4b Demo Video | **M5** Lo-fi deliverables |
| Fri Nov 13 | Peer Review 3 (Usability Testing), Quiz 3 due Nov 6 | **M6** Usability test |
| Wed Nov 18 | A5 Testing & Debugging Report | **M7** Testing report |
| Fri Dec 4 | — (internal; Quiz 4 due Dec 4) | **M8** Feature freeze |
| Wed Dec 9 | — (internal) | **M9** Code freeze |
| Fri Dec 11 | Final Project Demo | **M10** Final demo |

Low-capacity periods to plan around: fall break (Oct 17–20), Thanksgiving (Nov 25–29),
and quiz windows (Oct 14–16, Nov 4–6, Dec 2–4). Classes end Dec 14.

## Phases

### Phase 0: Planning (Sep 22 → Sep 30) → M1

- [x] Proposal, data-source research, MPrint room-extraction spike
- [ ] MVP scope and reach priorities agreed by the team ([MVP Scope](mvp-scope.md))
- [ ] Planning document submitted, with Gantt chart

### Phase 1: Requirements & design (Sep 30 → Oct 14) → M2

- [ ] User requirements: target-user personas, use cases, accessibility requirements
- [ ] Lo-fi wireframes: landing, map, list, detail panel, review flow, settings, floor view
- [ ] Review taxonomy finalized (dimensions, scales, chips)
- [ ] Design tokens (monochrome + one accent) in the Tailwind config

### Phase 2: Data foundation (Sep 30 → Oct 9, parallel with Phase 1)

- [ ] Commit UM Library `fass-data`/`fass-icon-map` as the primary `StudySpace` seed
- [ ] Commit the rest of the raw seed data (mguide.app `/data/*`, official
      `building`/`department`/`parking`, building photos)
- [ ] Reconcile the two building sets (official 265 vs. mguide 466)
- [ ] Supabase schema + migrations + RLS ([Data Model](../technical/data-model.md)),
      seeded
- [ ] Floor-plan pipeline run on the pilot building(s), plus a first cut of the
      alignment tool ([ADR 0005](../decisions/0005-manual-floor-plan-alignment-tool.md))
- [ ] Apply for our own Waitz API access ([ADR 0004](../decisions/0004-do-not-depend-on-mguide-waitz-proxy.md))
      as early as possible, since approval time is out of our control

### Phase 3: MVP build / lo-fi prototype (Oct 5 → Oct 16) → M3, M4, M5

The 9 MVP items in [MVP Scope](mvp-scope.md#mvp-lo-fi-prototype-working-build-by-fri-oct-16):
app shell and landing page, map view, detail panel, list view, filters, sign-in,
chip-based reviews, accessibility settings, and the floor-plan pilot. Oct 21–22 is
for fixes only, and Oct 23–28 goes to the write-up and demo video.

### Phase 4: Iterate & usability testing (Oct 28 → Nov 13) → M6

P1 reach features: WCAG audit pass + colorblind modes, floor plans for all 7 library
buildings, live Waitz occupancy (if the key has been granted), synced settings.
Run usability tests with target users.

### Phase 5: Testing & debugging (Nov 13 → Nov 18) → M7

Fix what usability testing found, write automated tests for the core flows, run an
accessibility regression pass, and write the report.

### Phase 6: Reach features & polish (Nov 18 → Dec 4) → M8

P2 reach features, in priority order: busyness-by-hour from reviews (seeded with
simulated data), classroom free-now, accessibility layer (entrances, ramp/elevator,
restrooms), floor plans beyond libraries, user photos (only if a moderation plan
exists). Thanksgiving takes a week out of this window, so plan roughly 1.5 working
weeks, not 2.5.

### Phase 7: Final demo prep (Dec 4 → Dec 11) → M9, M10

Bug fixes only after feature freeze. Seed the demo data, rehearse, and record a
backup video.

## Re-planning cadence

- Daily async status in the group chat, as agreed in the meeting.
- Weekly scope check: anything at risk of missing its milestone either gets cut to a
  fallback (each risky MVP item in [MVP Scope](mvp-scope.md) has one) or moves down
  the reach list. Milestone dates don't move.
- At each milestone (M2, M5, M7), re-rank the reach list based on what we've learned.
