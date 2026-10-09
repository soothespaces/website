# MPrint Room Extraction — Prototype Findings

Status: **segmentation validated; labeling is done by reading, not OCR.** The
flood-fill segmentation (`scripts/mprint/extract_rooms.py`, now
`scripts/mprint/label_rooms.py`) works on the buildings tested. OCR of room numbers
does not hold up on low-resolution plans, so numbers are read visually from
numbered-region tiles instead (see
[Labeling by reading instead of OCR](#labeling-by-reading-instead-of-ocr)). We need
fewer than 30 floors, so this is cheaper than making OCR reliable. This document records what was tried, what worked, what didn't, and why —
treat every number here as evidence from a specific test, not a general guarantee.

## The actual use case — simpler than it first sounds, with one caveat

The goal: a seamless drill-down from the outdoor map into a building's floor level —
zoom into a building on the map, and (if the user wants that fine-grained view) it
opens onto the MPrint floor plan showing individual rooms. Every room a floodfill
segment identifies is a clickable zone that user-generated content (reviews, photos —
whatever) attaches to directly, as the primary unit, not a side effect of a coarser
`StudySpace` record. That reframes what "good enough" means, with two distinct levels
of georeferencing that are easy to conflate but very different in cost:

- **Per-room polygon georeferencing: still not needed.** A room zone's shape only
  needs to exist in the *floor plan image's own pixel space* — clicking on the
  displayed image and hit-testing a label mask works regardless of where that image
  sits in the real world. **The segmentation doesn't need to be pixel-perfect either**
  — it needs to divide the floor into zones that roughly match what a person looking
  at the image would call "a room," not survive a CAD audit. A click target does
  not need a polygon: the label mask (which pixel belongs to which room) is
  directly usable as a small raster, hit-tested by pixel lookup. Polygons are a
  separate step, for drawing the plan on the map. See
  [Vector plans, fitted to the footprint](#vector-plans-fitted-to-the-footprint).
- **Whole-image anchoring: needed for the seamless part, and much cheaper than
  per-room georeferencing.** For the map→floor transition to feel continuous rather
  than a jarring cut to an unrelated modal, the floor-plan image as a *single unit*
  needs to be placed at the building's real-world position — a map library like
  MapLibre GL (which mguide.app already uses) supports exactly this via an image
  source anchored to a handful of real-world corner coordinates. That's **one
  calibration per floor image** (matching its corners/orientation against the
  building's known footprint), not one per room — meaningfully cheaper than what "MPrint
  digitization" first sounded like, but a real, not-yet-attempted step, unlike the
  per-room case above.

This is still a meaningfully smaller lift than "digitize the interior map" first
sounded like — most of the work (OCR, segmentation) is already validated and stays in
pixel space regardless. The one piece of geography that *is* required (anchoring the
whole image, once per floor) hasn't been attempted yet.

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

### Shapiro Library, floor 3 (`ulib_3.png`, 2200×3400px, a different building)

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

## Labeling by reading instead of OCR

Tested on Shapiro floor 2 (`ulib_2.png`, 1185×1854px) on 2026-09-28. Room numbers there
are about 7px tall. Tesseract read **2 of the 12** LibCal-bookable rooms (`2122`–`2144`)
with whole-page OCR, and did no better per room, per word, or upscaled. Reading the
same plan by eye gets all of them. So the work is split: code does the geometry, and a
reader (Claude, or a teammate) supplies the numbers.

`scripts/mprint/label_rooms.py`:

1. **`sheet`** flood-fills the plan and renders zoomed tiles (2×, about 600px of
   plan per tile) with each region tinted and its ID in red, placed off-centre so it
   doesn't cover the room's own label.
2. **Read** the tiles and write `scripts/mprint/labels/<image>.json`, mapping region
   ID → room number, or `null` for exterior canopies, open-to-below and vestibules.
   Several regions can share a number when a dashed line or a stair splits a room.
   Context helps the reader: floor 2 numbers start with 2, and neighbouring rooms
   step through the numbers in order (`2122`, `2124`, `2126`, …).
3. **`verify`** redraws the plan with the assigned numbers in blue beside the plan's
   own black labels, which catches ID transcription mistakes. It also refuses to run
   if any region is unlabeled or any label names a region that doesn't exist.
4. **`export`** writes the hit-test mask (`<stem>_rooms.png`, pixel value = room
   index) and `<stem>_rooms.json` (room number, region IDs, centroid, bbox). It fills
   the holes each room's own printed number leaves, and grows rooms back over the
   wall band that dilation removed, so a click on the number or next to a wall still
   lands in the room.

Region IDs depend on the exact image and parameters, so the labels file records the
image's sha256, `dilation` and `wall`, and every step checks them.

**Parameters.** `--wall 200` (not 128) is needed on Shapiro: some interior walls are
drawn in grey, and at 128, rooms `2122` and `2124` merged. `--dilation 8` closes the
study-room doorways onto the open floor. At 4 and 6, several rooms leaked into the
`2000` hall and out through the entrance. The cost is that closets under about
150px after dilation (`2054A`, `2026B`) drop out, and `2170A` merges into `2170B`.
That's fine for study spaces. Re-run `sheet` with a smaller dilation if a small
room matters.

**Result on Shapiro floor 2:** 64 regions → 49 rooms. All 12 LibCal rooms are in
their own region, and spot-check clicks on printed labels and near walls resolve to
the right room. It took about 6 tile reads plus one verify pass.

## Vector plans, fitted to the footprint

Click targets can stay in the image. Drawing the floor inside the building on
the map cannot: MapLibre needs polygons in longitude/latitude, and it needs the
sheet's four corners. Two scripts sit on top of the flood fill
(`scripts/mprint/fit_outline.py`, `scripts/mprint/vectorize.py`).

`fit_outline.py` traces the outer edge of the sheet (white space connected to
the border is outside; everything else is the building) and fits that edge to a
footprint polygon. The only transform is scale, rotation, and shift. It writes
`floor_plans.corners`: top-left, top-right, bottom-right, bottom-left. A spur
that leaves the footprint and comes back within 8 m, while reaching 10 m or
more, is dropped when the fit without it overlaps better. On Shapiro that spur is the bridge west to
Hatcher, which is not drawn on the MPrint sheet. Column bays are only a few
meters deep, so they stay.

`vectorize.py` traces each flood-fill room, grown back to the ink but not out
through the exterior wall, and traces the ink itself (walls, stairs, columns,
the printed numbers). Douglas–Peucker at 1 px straightens the staircase a
raster makes of a diagonal line; rings smaller than about 28 px stay at 0.6 px
so a column ring does not collapse. With `--corners` the same four corners are
a homography, which for this similarity is the mapping MapLibre's image source
would use. Room numbers come from the labels file. Without one, each region is
its own polygon and `roomNumber` is null.

The footprint used below is FO's Shapiro building polygon
(`scripts/mprint/footprints/shapiro.json`), from the campus-map snapshot.

### Shapiro floor 1 (`ulib_1.png`, 1167×2001), 2026-10-09

- **5.041 cm/pixel.** The top of the sheet points **0.89° west of north**.
- The plan's edge sits on FO's line with median distance **0.32 m**, **98%**
  of the edge within 1 m, area overlap (intersection over union) **0.97**.
- Corners: `[[-83.7375563, 42.276071], [-83.7368422, 42.2760792],
  [-83.7368231, 42.2751732], [-83.7375372, 42.275165]]`.
- An earlier fit of a 1166×2000 render of this same sheet reported 5.06 cm per
  pixel, 1.4° off north, a 0.22 m median, and 97% of the edge within 1 m, and
  gave corners about half a meter from these. Half a meter is the size of the
  residual, and the two images are not the same pixel grid. The script's
  overlay (blue plan, red FO, gray bridge left out) shows the same agreement
  that fit described: both north arches and the stepped south end line up, and
  FO's column bays are a little shallower than the plan's, mostly on the west
  side.

### Shapiro floor 2 (`ulib_2.png`, 1185×1854, the labeled plan)

Same footprint, same kind of fit: **5.046 cm/pixel**, **1.29° west of north**,
intersection over union **0.948**. The edge match is looser: median **0.347 m**,
only **89%** within 1 m, 90th percentile **1.38 m**. This sheet does not trace
the ground-floor arcade, so the fit is enough to park the floor on the
building and not enough to trust a doorway against FO's line. Putting every
floor through the same footprint, instead of aligning the images by their
top-left pixels, is what puts them on one lat/lng grid.

`vectorize.py` on the labeled plan wrote **49** room polygons (2,491 vertices)
and one ink MultiPolygon (about 15,000 vertices, 676 rings) in EPSG:4326.
Study rooms along the west side keep the numbers from `labels/ulib_2.json`.
A column in the 2000 hall stays a ring rather than a filled dot. Open-to-below
stays a hole, because its label is null. The GeoJSON is about 480 KB and is
generated, not committed.

### Duderstadt floor 2 (`dc_2.png`, 4134×2370), 2026-10-09

The outline step still works. The red trace on the sheet follows the outer
wall, including the west wing out to the octagon and the round room on the
southeast. The fit to FO's footprint does not. That polygon is a simplified
shell, a large rectangle plus a west bar, not the wall line. Spans are almost
the same (about 154 m by 89 m on the sheet at 5 cm/pixel, 155 m by 90 m on the
footprint), but the shapes are not: median distance **12.6 m**, only **9%** of
the edge within 1 m, overlap **0.49**. A wider rotation search (±30°) did not
find a better pose. `alignments/dc_2.json` records that fit with `usable:
false`. Those corners should not be used to drape the plan on the map.

**That miss was at least partly the fitter, not the footprint.** Drawing
Duderstadt's own footprint as a sheet and fitting it back also failed (2.3 m
median, 0.78 overlap). Two things caused it. The spur rule cut off the narrow
west end of the footprint, which is on the sheet. And ICP started from the
footprint's vertex mean instead of the pose the coarse search picked; once the
west end was gone, that start sat about 16 m off. The fitter now starts ICP
from the searched pose (area centroids, not vertex means) and fits with and
without a spur, keeping the higher overlap. The same synthetic check now
lands at 0.02 m, and a drawn Shapiro outline without the bridge comes back
at 0.9° instead of 2.1°. The re-run is below.

### Re-fit of six sheets, 2026-10-09

The `MPrint fit` workflow fits every sheet from MPrint's own PNGs and commits
`alignments/`. "Edge" is the median distance from the plan's outer edge to
FO's line; "overlap" is intersection over union.

| Sheet | Flags | cm/px | Top of sheet | Edge | Within 1 m | Overlap | Usable |
| :-- | :-- | --: | --: | --: | --: | --: | :-- |
| Shapiro 1 (`ulib_1`) | | 5.041 | 0.86° W of N | 0.32 m | 98% | 0.97 | yes |
| Shapiro 2 (`ulib_2`) | | 5.050 | 1.26° W of N | 0.34 m | 89% | 0.95 | yes |
| Shapiro 3 (`ulib_3`) | `--close 6` | 3.797 | 1.31° W of N | 0.33 m | 92% | 0.96 | yes |
| Duderstadt 1 (`dc_1`) | `--close 50` | 5.233 | 0.56° E of N | 1.86 m | 35% | 0.79 | no |
| Duderstadt 2 (`dc_2`) | | 5.479 | 0.61° E of N | 1.99 m | 32% | 0.86 | no |
| East Quad 1 (`eq_1`) | `--up 90` | 4.872 | 92.9° E of N | 3.37 m | 14% | 0.62 | no |

**Shapiro** is unchanged on floors 1 and 2, within a few centimeters, so the
fitter fix didn't move the fits that already worked. Floor 3 draws its window
bands as thin parallel lines with gaps, so the outside leaked into the floor
and the first fit was 0.25 overlap. `--close 6` seals those gaps before the
flood fill. Floor 3 also draws the bridge to Hatcher, and the fit keeps
FO's spur for it. All three floors now agree on the bearing to within half a
degree. Floor 3 is a larger render (3.8 cm per pixel, not 5.0), which is fine:
each sheet gets its own corners.

**Duderstadt** went from a 12.6 m miss to about 2 m, and the overlay shows
why it stops there. FO's footprint is the roof line, a chamfered rectangle
through the ring of diamond columns outside the building. The walls inside it
are an octagon. On floor 1 the west wing lands on FO's line, and the columns
sit on FO's north, east and south edges, so the pose looks right by eye. The
edge statistics still can't pass, because most of the wall is meters inside
the roof line by design. `--close 50` bridges the columns on floor 1; it also
pulls in the cooling-tower enclosure south of the west wing, which costs some
overlap. These corners are `usable: false` until someone checks them against
a second reference (the manual tool, or satellite imagery).

**East Quad** doesn't fit. The sheet has east at the top, and FO's polygon is
a quad to the north and an H to the south, while the sheet's wings don't line
up with either at any scale the search tries. It may be that FO splits East
Quad differently from the floor plan, or that floor 1 doesn't cover all of
FO's outline. It needs the manual corner tool.

Room segmentation is mixed, at dilation 12 and wall 200 (116 regions kept).
Fully walled rooms come apart: the 2356A–E row and the 2335 lettered rooms are
each their own region. The LibCal study rooms that open onto a wide corridor
do not. 2360, 2364, 2368, 2372 and 2376 stay one region, and the 2378–2388
stack falls out of the kept set because the doorway never closes. Raising
dilation to 28 still leaves that stack inside one component, and it drops the
region count from 116 to 35.

**Names.** `room_names.py` encodes the scheme on this sheet and on Shapiro.
A plain number (`2384`) is a room and can match LibCal. A trailing letter
(`2335A`, `2356E`, `2321K`) is an extension of that room. A floor digit, a
letter, and two digits is not a room: `2C` corridor, `2S` stair, `2E`
elevator, `2V` vestibule, and the same shape for `2L` and `2F`. `ROOF`, `UP`,
`DN`, and "first floor below" are open.

Duderstadt's LibCal location (`umich-nc.libcal.com`, lid 11261, from the
snapshot on pull request 14) has 12 study rooms. Eleven are printed on this
floor: 2340, 2344, 2348, 2352, 2360, 2364, 2368, 2372, 2380, 2382, 2384.
**2374 is not.** The run of rooms is 2360, 2364, 2368, 2372, **2376**. 2378,
2386 and 2388 sit beside the LibCal ones and are not bookable there. The
reading is in `readings/dc_2.json`.

**OCR.** Tesseract at 4×, page segmentation mode 11, read the axis-aligned
tags 2380, 2382 and 2384 at 96% confidence, missed 2378, and read `2C38` as
`2038`. A rotation sweep of the 2340–2352 column, whose numbers are drawn at
an angle, returned nothing. On this sheet the numbers still have to be read
by eye. The classifier is what makes that reading useful: drop the letter
classes and the extensions, then join the plain numbers to LibCal.

## What this does NOT do yet

- **The vectors are not on the map, and the corners are not in `floor_plans`.**
  The files are the prototype. A MapLibre fill for `layer == "room"` and a fill
  for `layer == "structure"` consume the GeoJSON directly. The raster mask is
  still what `label_rooms.py export` produces for a click test in image space.
- **The fit needs an outline that is the footprint.** Shapiro's ground floor
  has that. Floor 2 is close but softer. A sheet that doesn't show the outer
  wall, or a footprint we can't match, still wants the manual corner tool in
  [ADR 0005](../decisions/0005-manual-floor-plan-alignment-tool.md).
- **No auto-calibrated dilation radius.** 6px worked for the East Quad test; whether
  that's right for every building depends on that drawing's line weight and door-gap
  size at whatever resolution it was rendered at. A real pipeline should measure
  typical wall-line thickness per image (e.g. via a distance transform) and derive
  the dilation radius from that, rather than hardcoding a constant.
- **OCR is no longer on the critical path.** Misreads like `3020A` → `30200` are why
  numbers are now read by eye. `extract_rooms.py`'s OCR is kept as a cross-check
  only.
- **Not run across more than 2 buildings.** Two data points is a spike, not coverage.
  Before relying on this for real content, run it across the buildings that actually
  matter first (the libraries from [Data Sources § 9](data-sources.md#9-um-librarys-own-find-study-space-tool-best-source-yet-purpose-built),
  and whichever dorms/buildings end up prioritized for coverage) and spot-check
  results against the source images by eye.

## Recommendation

Worth pursuing as the real approach to interactive floor plans — the core mechanism
(dilated flood fill, labeled by reading) is validated, not just theoretical, and correctly handles
the specific hard case (dashed/non-physical boundaries) that seemed likely to break
it going in. Click targets on the image still don't need a vector. Drawing the plan
inside the building does, and the Shapiro prototype above is that step: corners from
the footprint fit, room and ink polygons in longitude/latitude. What's left is
labeling the other floors, running the fit where the outline actually matches, and
loading the GeoJSON as map layers. Treat the output as a first draft that needs
the manual-override layer (for rooms `rooms.json` doesn't cover at all, like named
lounges) and spot-checking, not as ground truth to ingest blindly. See
[Data Sources § Next Steps](data-sources.md#next-steps) and
[Roadmap](../product/roadmap.md) for where this fits in sequencing.
