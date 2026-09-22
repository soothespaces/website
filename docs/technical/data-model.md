# Data Model

Status: not yet designed. Entities implied by the feature set (see
[Features](../product/features.md)), to be fleshed out with real fields and a chosen
data store:

- **Building** — GeoJSON footprint, MPrint interior layout reference.
- **StudySpace** — location (building + coordinates/floor), baseline noise level,
  amenities, capacity, accessibility attributes (step-free access, adaptive furniture,
  physical clearance).
- **OccupancyReading** — live crowd density for a space, sourced from Waitz (see
  [Integrations](integrations.md)).
- **Rating** — community rating/review tied to a StudySpace.
- **ContributedPin** — a crowdsourced submission (new space, updated barrier/sensory
  tag) tied to an authenticated User, pending or applied to a StudySpace.
- **User** — authentication identity for the crowdsourced contribution flow.

Fill in concrete schemas (fields, types, relationships) once the data store is chosen.
