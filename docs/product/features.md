# Features

Core UI features from the initial concept. The interface overall is designed for high
legibility, ease of navigation, and strict WCAG adherence.

## Interactive 2D Map Viewer

The central interface: an interactive campus map rendering GeoJSON building footprints
and MPrint interior layouts. Users pan and zoom across the map; study zones appear as
interactive, color-coded pins layered over the facilities.

## Multi-Attribute Filtering Panel

A faceted search menu that filters map pins by strict environmental criteria: baseline
noise level (quiet, moderate, social) and specific amenities (outlets, whiteboards,
group rooms). Fully keyboard-navigable and screen-reader optimized.

## WCAG-Compliant Display Controls

Built-in toggles for high-contrast viewing modes, scalable text, and reduced-motion
animations, to directly accommodate users with visual impairments or sensory
processing sensitivities.

## Real-Time Spot Detail Cards

Clicking a map pin opens an interactive detail modal showing community ratings,
verified amenities, maximum capacity, and live crowd density pulled from the Waitz
integration.

## Crowdsourced Contribution Flow

An accessible tagging form lets authenticated users drop new coordinate pins onto the
map to document dynamic physical barriers or submit new sensory ratings for unmarked
study spots — keeping the underlying data accurate over time.

---

Technical grounding for these features:
[Architecture](../technical/architecture.md),
[Data Model](../technical/data-model.md),
[Integrations](../technical/integrations.md).
