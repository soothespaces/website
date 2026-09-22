# MPrint Room Extraction — Prototype Findings

Status: **validated spike, not production-ready.** A real, working pipeline exists
(`scripts/mprint/extract_rooms.py`) and produces good results on the one building
tested in depth, but needs more validation across buildings before being trusted at
scale. This document records what was tried, what worked, what didn't, and why —
treat every number here as evidence from a specific test, not a general guarantee.

## The idea, and why it's plausible

MPrint floor plans (see [Data Sources § 5](data-sources.md#5-mprint-interior-floor-plans-confirmed-separate-source))
are consistently-formatted CAD-style drawings: solid black lines for physical walls,
dashed/dotted lines for non-physical boundaries (an open lounge edge, a partition),
small square glyphs for fixtures, and a room number printed roughly centered in each
room. That consistency is what makes automated extraction plausible at all — this
isn't scanned/photographed paper, it's a rasterized vector drawing with clean, high-
contrast line work.

The proposed pipeline:

1. **OCR** the image for room-number text and its pixel position.
2. **Binarize** into wall-pixels vs. background, then **dilate the wall mask** by a
   few pixels — this closes small gaps that would otherwise let a flood fill leak
   through: door openings (a real gap in a real wall) and, importantly, the gaps
   *between* the dashes of a dotted/non-physical boundary.
3. **Label connected regions** of the resulting closed-wall mask — each region is a
   candidate room polygon.
4. **Assign** each OCR'd room number to the component it falls in (see caveat below —
   the text itself is drawn in wall-colored ink, so this needs a "nearest room pixel"
   fallback, not a direct lookup).
5. **Cross-reference** the resulting room numbers against `rooms.json` (Registrar
   data — see [Data Sources § 6](data-sources.md#6-additional-mguideapp-static-data-confirmed-live-not-yet-pulled-in))
   for classroom type/schedule metadata where it exists.
6. **Manual override entries** for rooms `rooms.json` doesn't cover at all — informal
   lounges, e.g. East Quad's Greene Lounge, which is room **1808** (confirmed by OCR
   position + the photo) but isn't in `rooms.json` since it's not a Registrar-
   scheduled classroom. This is not a fallback for failure; it's the correct, expected
   path for any space that was never going to be in scheduling data.

## What was actually tested

Ran on two real MPrint images, using `pytesseract` (Tesseract 5) for OCR and
`scipy.ndimage` for binary dilation + connected-component labeling — see
`scripts/mprint/extract_rooms.py` for the runnable version.

### East Quad, floor 1 (`eq_1.png`, 4014×2059px)

- **OCR**: 200 numeric/alphanumeric labels detected in one pass, most at 85–95%
  confidence, including exact matches for every room number checked by hand (1801,
  1807, 1808, 1813, 1815, ...).
- **Segmentation**, dilation radius 6px: 591 connected components. The specific case
  the idea needed to prove out — **room 1808 (Greene Lounge), which has a dotted
  rather than solid boundary on one side** — separated cleanly from the corridor
  above it and from its solid-walled neighbors (1800, 1812, 1816), just like the
  fully solid-walled rooms (1801, 1807, 1813) did. A visual overlay confirmed this by
  eye, not just by coordinate lookup — each room rendered as its own distinct region.
  At radius 0 (no dilation), by contrast, 85% of the entire floor collapses into one
  connected blob via door gaps — so the dilation step is doing real, necessary work,
  not a no-op.
- 182 of the 200 OCR'd labels mapped to a room; 1 component was flagged as "claimed
  by more than 2 distinct room numbers" (see heuristic below) — plausibly a real
  connected corridor loop, not inspected further.

### UM Library, floor 3 (`ulib_3.png`, 2200×3400px, a different building)

- Sanity-checked to see if the same fixed dilation radius generalizes to a different
  drawing. Result is mixed, and worth reading carefully:
  - 59 room labels were extracted and 0 components were flagged by the multi-label
    heuristic.
  - A quick debug visualization (random RGB color per component) made one area — a
    cluster of rooms named `3020`/`3020A`–`3020E` — *look* like one big merged blob.
    **This turned out to be a false impression from the visualization, not a real
    segmentation failure**: directly sampling the underlying component-ID array
    across that region found 18 distinct component IDs, not one. The random color
    generator just happened to assign visually-similar shades to adjacent
    components. Lesson: don't trust a quick random-color debug view for QA; use a
    colormap with guaranteed contrast between adjacent regions (e.g. a fixed
    high-contrast palette cycled with a large stride) before drawing conclusions by
    eye.
  - Separately, real OCR errors showed up on this image: `3020A`, `3020B`, `3020C`
    were misread as `30200`, `30206`, `30208` (digit/letter confusion at this image's
    text size). This is a genuine limitation, not a visualization artifact — it means
    room numbers pulled from OCR need validation (e.g. against the set of plausible
    room numbers for that building from `rooms.json`) before being trusted, not
    accepted as-is.
  - Whether 18 components in the `3020` region is *correctly* fine-grained or
    *over*-segmented (splitting one real room into pieces) was not checked further —
    flagged as an open question, not a confirmed result either way.

## A useful free heuristic: multi-label components

If more than ~2 distinct OCR'd room numbers land in the same connected component,
that's a strong, nearly-free signal that the component is under-closed (a corridor or
open area that swallowed several nominally distinct rooms), not a real single large
room — real single large rooms (an atrium, a big open commons) generally have exactly
one room-number label, not several. `extract_rooms.py` surfaces this automatically as
`componentsNeedingReview`. It caught a real case in the East Quad test; it's a cheap
sanity check worth keeping regardless of how the rest of the pipeline evolves.

## What this does NOT do yet

- **No georeferencing.** Extracted polygons exist only in the image's own pixel
  coordinate space. Turning that into real lat/lng for map placement needs a
  per-building calibration (at least 2–3 known reference points, e.g. matched against
  the building's footprint polygon or entrance coordinates) that hasn't been
  attempted.
- **No auto-calibrated dilation radius.** 6px worked for the East Quad test; whether
  that's right for every building depends on that drawing's line weight and door-gap
  size at whatever resolution it was rendered at. A real pipeline should measure
  typical wall-line thickness per image (e.g. via a distance transform) and derive
  the dilation radius from that, rather than hardcoding a constant.
- **No OCR validation/correction.** Misreads (like `3020A` → `30200`) need to be
  caught — cross-checking against the known room-number list in `rooms.json` for that
  building (where available) is the obvious first pass.
- **Not run across more than 2 buildings.** Two data points is a spike, not coverage.
  Before relying on this for real content, run it across the buildings that actually
  matter first (the libraries from [Data Sources § 9](data-sources.md#9-um-librarys-own-find-study-space-tool-best-source-yet-purpose-built),
  and whichever dorms/buildings end up prioritized for coverage) and spot-check
  results against the source images by eye.

## Recommendation

Worth pursuing as the real approach to MPrint digitization — the core mechanism
(OCR + dilated flood fill) is validated, not just theoretical, and correctly handles
the specific hard case (dashed/non-physical boundaries) that seemed likely to break
it going in. Treat its output as a first draft that needs the manual-override layer
(for rooms outside `rooms.json`, like named lounges) and spot-checking, not as
ground truth to ingest blindly. See [Data Sources § Next Steps](data-sources.md#next-steps)
and [Roadmap](../product/roadmap.md) for where this fits in sequencing.
