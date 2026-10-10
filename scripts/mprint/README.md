# MPrint room extraction

## Labeling rooms (current workflow)

`label_rooms.py` segments a plan into regions and has a reader (Claude or a
teammate) supply the room numbers, since OCR can't read small labels reliably.
Needs numpy, pillow and scipy (no Tesseract).

```bash
curl -o ulib_2.png https://mprint.umich.edu/assets/floorplans/ulib/ulib_2.png
python3 label_rooms.py sheet  ulib_2.png --out out/          # numbered-region tiles
# read the tiles, write labels/ulib_2.json (region ID -> room number)
python3 label_rooms.py verify ulib_2.png labels/ulib_2.json --out out/
python3 label_rooms.py export ulib_2.png labels/ulib_2.json --out out/  # mask + json
```

`labels/` holds the committed labels, one file per floor. The export outputs are
generated, so don't commit them.

## Vector plan on the footprint

`fit_outline.py` places the sheet on a building footprint (scale, rotation, and
shift) and writes the four image corners MapLibre needs. `vectorize.py` traces
the flood-fill rooms and the drawing's ink into GeoJSON. With `--corners`, that
GeoJSON is longitude/latitude in the same corner order as `floor_plans.corners`.

```bash
curl -o ulib_1.png https://mprint.umich.edu/assets/floorplans/ulib/ulib_1.png
python3 fit_outline.py ulib_1.png footprints/shapiro.json \
    --out alignments/ulib_1.json --preview out/ulib_1_fit.png
python3 vectorize.py ulib_2.png labels/ulib_2.json \
    --corners alignments/ulib_2.json --out out/ --preview out/ulib_2_vector.png
```

Two flags cover sheets that don't trace cleanly. `--close N` seals gaps in
the outer wall before the outside is flood-filled (Shapiro floor 3 needs 6;
at 50 it also bridges Duderstadt's ring of outer columns). `--up DEG` is a
rough bearing for the sheet's top when it isn't north (East Quad: 90).

### The pipeline

`pipeline.py` runs every sheet in `sheets.json` end to end: download, fit,
and, when the fit is usable, vectorize into
`public/floor-plans/<building slug>/<floor>.geojson`.
`public/floor-plans/index.json` lists every floor with its corners, whether
the fit is usable, and its GeoJSON path. Each GeoJSON has `layer: "room"`
polygons (with `roomNumber` when the floor has a labels file) and one
`layer: "structure"` MultiPolygon of the drawing's ink. In MapLibre, add it as
a GeoJSON source and draw rooms as a fill and structure as a dark fill above
it. Unlike the raster, it stays sharp at every zoom.

The `MPrint fit` workflow (`.github/workflows/mprint-fit.yml`) runs the
pipeline on a GitHub runner, because cloud dev sessions can't reach
mprint.umich.edu, and commits `alignments/` and `public/floor-plans/`. To add
a floor, add a line to `sheets.json` and push; don't commit a local run.

### Aligning a floor by hand

When the automatic fit misses (`usable: false`, as for East Quad and
Duderstadt), open `/admin/floors` on the site, pick the floor, and drag the
sheet onto the orange footprint (ADR 0005). Download the result and commit it
as `manual/<sheet>.json`; the pipeline then uses those corners instead of the
fit, marks the floor `aligned: "manual"`, and writes its GeoJSON. The fit's
own numbers stay in `alignments/<sheet>.json` under `fit`.

`alignments/` is the committed corner record (one file per sheet, with the
image sha256). A fit with `usable: false` did not land on the footprint; don't
drape that sheet from those corners. `footprints/shapiro.json` is FO's Shapiro
polygon, including the bridge to Hatcher; the fit drops that spur because it
is not drawn on the sheet. `footprints/duderstadt.json` and `footprints/east-quad.json`
are the same layer for those buildings. GeoJSON and preview PNGs are generated, same as the masks.

### Room numbers from printed labels

`read_rooms.py` labels a floor from the numbers printed on it: an agent reads
the labels from contact sheets into `readings/<sheet>.json`, and `grow` gives
each number the region it sits in and merges unnumbered pieces (furniture
splits) into the neighbor they share the most boundary with. When a
`sheets.json` entry names `readings`, the pipeline runs `grow` on the sheet it
just downloaded, so the labels always match the image. `rooms/known.json`
holds hand-kept room facts (Clark Commons is 3045); their names go on the map
as `roomName`. The step-by-step is the repo skill
[`.claude/skills/label-floor`](../../.claude/skills/label-floor/SKILL.md).

`room_names.py` classifies a printed number: plain room, lettered extension
(`2335A`), or a letter class (`2S` stair, `2C` corridor, `2E` elevator, `2V`
vestibule). Only plain rooms are matched to LibCal. `readings/dc_2.json` is
the visual read of Duderstadt floor 2 against that list.

## OCR prototype

See [`docs/technical/mprint-extraction.md`](../../docs/technical/mprint-extraction.md)
for the full writeup — what this does, what's been validated, and what's still
missing (georeferencing, OCR validation, broader building coverage).

### Setup

Requires the Tesseract OCR binary (not just the Python binding):

```bash
sudo apt-get install -y tesseract-ocr   # or the equivalent for your OS
pip install -r requirements.txt
```

### Usage

```bash
curl -o eq_1.png https://mprint.umich.edu/assets/floorplans/eq/eq_1.png
python3 extract_rooms.py eq_1.png --dilation 6 --out eq_1_rooms.json
```

Check stderr for a warning if any component is claimed by more than 2 distinct
room-number labels — that's a free signal the wall-closing dilation didn't fully
separate a corridor/open area from its neighbors at the radius given, and needs a
higher `--dilation` value or manual review, not blind trust.
