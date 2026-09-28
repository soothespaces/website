# Roadmap

Phases, milestones, and capacity for EECS 497, Fall 2026, structured to match the
Project Planning Document's required phases and strategic milestones. This is the
source for the Gantt chart (Linear timeline; see [Gantt in Linear](#gantt-in-linear)).
**What** gets built is in [MVP Scope](mvp-scope.md). **Who** builds it is in
[Work Breakdown](work-breakdown.md).

## Strategic milestones

★ = one of the five milestones the assignment requires.

| Date | Milestone | Course deliverable |
|---|---|---|
| Wed Sep 30 | Planning complete | A2 Project Planning Document |
| Wed Oct 14 | ★ **User Requirements** | A3 User Requirements Document |
| Fri Oct 16 | ★ **Preliminary Solution** (lo-fi build: core flow working end to end) | — (fall break Oct 17–20 follows) |
| Fri Oct 23 | Lo-fi peer review | Peer Review 2 |
| Wed Oct 28 | Lo-fi deliverables | A4a write-up + A4b demo video |
| Fri Nov 6 | ★ **Minimum Requirement Deliverable** (every MVP item at full quality, WCAG audit passing) | — |
| Mon Nov 9 | ★ **First Day of Testing** of the MR deliverable | — |
| Fri Nov 13 | Usability testing complete | Peer Review 3 |
| Wed Nov 18 | Testing report | A5 Testing & Debugging Report |
| Fri Dec 4 | Feature complete | — |
| Tue Dec 8 | ★ **Project Freeze** (last day of development changes) | — |
| Fri Dec 11 | Final demo | Final Project Demo |

Quizzes (not project milestones, but they reduce capacity): Oct 14–16, Nov 4–6,
Dec 2–4. Classes end Dec 14.

## Working hours available

**Assumption, for the team to confirm:** 10 h/person/week, so 40 team-hours in a full
week. Reduced in weeks with quizzes (×0.75), fall break (×0.6), and Thanksgiving
(×0.5).

| Week of | Sep 28 | Oct 5 | Oct 12 | Oct 19 | Oct 26 | Nov 2 | Nov 9 | Nov 16 | Nov 23 | Nov 30 | Dec 7 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Team hours | 40 | 40 | 30 | 24 | 40 | 30 | 40 | 40 | 20 | 30 | 40 |
| Why reduced | | | Quiz 2 | Fall break | | Quiz 3 | | | Thanksgiving | Quiz 4 | |

That's about **375 team-hours** from Sep 28 to Dec 13. The phase estimates below add
up to that total, so if the real number is lower, scope comes out of Phase 8 first.

## Phases

The nine phases from the assignment's list. "Depends on" is a finish-to-start
dependency. Phases without one overlap on purpose.

| # | Phase | Dates | Effort | Depends on |
|---|---|---|---|---|
| 1 | Start-up, organization & self-education | Sep 22 → Oct 2 | ~35 h | — |
| 2 | Scope, deliverables & user requirements | Sep 28 → Oct 14 | ~30 h | — |
| 3 | User contextual design | Oct 1 → Oct 14 | ~30 h | — |
| 4 | Solution development (preliminary solution) | Oct 2 → Oct 16 | ~50 h | 1 |
| 5 | Subsystem development & completion | Oct 19 → Nov 1 | ~65 h | 4 |
| 6 | Systems integration | Nov 2 → Nov 6 | ~25 h | 5 |
| 7 | Testing & evaluation | Nov 9 → Nov 18 | ~40 h | 6 |
| 8 | Recommendations & redesign | Nov 19 → Dec 8 | ~75 h | 7 |
| 9 | Wrap-up & final reporting | Dec 9 → Dec 14 | ~25 h | 8 |

### 1. Start-up, organization & self-education (Sep 22 → Oct 2)

- [x] Proposal, data-source research, MPrint room-extraction spike
- [ ] Tool setup: GitHub, Linear, Supabase project, Vercel preview deploys
- [ ] A2 Project Planning Document with Gantt chart (Sep 30)
- [ ] Contracts meeting (Oct 1): shared IDs, component slots, token structure
      ([Work Breakdown](work-breakdown.md#contracts-agree-on-these-in-one-meeting-on-wed-oct-1))
- [ ] Self-education: MapLibre/react-map-gl, Supabase RLS, Next.js 16 changes, WCAG 2.2
      auditing
- [ ] Apply for our own Waitz API access, and ask the Library for LibCal API
      credentials. Approval time is out of our control, so start now

### 2. Scope, deliverables & user requirements (Sep 28 → Oct 14)

- [ ] MVP scope and reach priorities agreed by the team ([MVP Scope](mvp-scope.md))
- [ ] A3 User Requirements Document (Oct 14), built on phase 3's findings

### 3. User contextual design (Oct 1 → Oct 14)

- [ ] Contextual interviews/observation with target users (neurodivergent students,
      students with mobility needs), recruited through SSD and personal networks
- [ ] Personas and key use cases
- [ ] Lo-fi wireframes: landing, map, list, detail panel, check-in flow, settings,
      floor view
- [ ] Check-in form finalized (dimensions, scales, chips)

### 4. Solution development: preliminary solution (Oct 2 → Oct 16)

The lo-fi cut of the MVP ([MVP Scope](mvp-scope.md)) across WP1–WP5, in the order in
[Work Breakdown](work-breakdown.md#sequencing-to-the-lo-fi-build-oct-16). Includes:

- [ ] Seed data committed: UM Library `fass-data` (primary), mguide.app `/data/*`,
      official `building`/`department`/`parking`; the two building sets reconciled
- [ ] Supabase schema, migrations and RLS ([Data Model](../technical/data-model.md))
- [ ] Floor-plan pipeline run on the pilot building
- [ ] Integration of all packages (Oct 12–14)

### 5. Subsystem development & completion (Oct 19 → Nov 1)

- [ ] Every MVP item to full quality with real data (nothing mocked)
- [ ] Lo-fi peer review feedback (Oct 23) fixed
- [ ] WCAG audit passing on core pages
- [ ] A4a write-up and A4b demo video (Oct 28)

### 6. Systems integration (Nov 2 → Nov 6)

- [ ] All packages joined on production data, MR build deployed
- [ ] Usability test plan and tasks ready

### 7. Testing & evaluation (Nov 9 → Nov 18)

- [ ] Usability testing with target users (Nov 9–13), Peer Review 3
- [ ] Automated tests for core flows; accessibility regression pass
- [ ] A5 Testing & Debugging Report (Nov 18)

### 8. Recommendations & redesign (Nov 19 → Dec 8)

- [ ] Fix what testing found (highest severity first)
- [ ] P1 reach goals in priority order ([MVP Scope](mvp-scope.md#reach-goals)) until
      feature complete (Dec 4)
- [ ] Bug fixes only Dec 4–8; ★ freeze Dec 8

### 9. Wrap-up & final reporting (Dec 9 → Dec 14)

- [ ] Seed demo data, rehearse, record a backup video
- [ ] Final demo (Dec 11)
- [ ] Final documentation

## Gantt in Linear

Linear's timeline shows projects (not issues), with milestones as dated diamonds and
finish-to-start dependency lines. So the Gantt is built from projects in the
**Soothe Spaces** team, in two layers:

- **Phase projects** (9), named `1 · Start-up & self-education` … `9 · Wrap-up`, with
  the dates above and the effort estimate in the description. They carry the
  milestones (each attached to the phase it falls in) and the dependency lines.
  Lead: PM.
- **Task projects**, for phases where people work in parallel, one per owner-sized
  piece of work (e.g. `4 · WP3 Places & discovery`, `3 · Contextual interviews`,
  `7 · Usability testing`). The **lead is the individual owner**, which is how the
  chart shows who owns what. Issues live here, assigned to individuals.

**Page 1** of the submission is the timeline filtered to phase projects (the top-level
view: phases, milestones, dependencies). **Page 2** is the full timeline including
task projects, which shows the per-person breakdown and what runs in parallel.
Keep project names short so they stay readable at month zoom. Because it's live in
Linear, later status reports only need a fresh screenshot.

## Re-planning cadence

- Daily async status in the group chat.
- Weekly scope check (PM): update Linear dates and project health. Anything at risk
  either drops to its documented fallback or moves down the reach list.
  **Milestone dates don't move.**
- At each ★ milestone, re-rank the reach list and re-check hours against the
  capacity table.
