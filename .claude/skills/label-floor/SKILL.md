---
name: label-floor
description: Put room numbers on an MPrint floor plan for the campus map. Use when asked to label, read or number the rooms of a floor in scripts/mprint/sheets.json.
---

# Label a floor's rooms

The map draws each floor from `public/floor-plans/<building>/<floor>.geojson`,
which `scripts/mprint/pipeline.py` builds from the MPrint sheet. Room numbers
come from a readings file you write by looking at the sheet. Every room worth
naming has its number printed inside it, so you read the numbers and the code
grows each room out from its number, absorbing the pieces that furniture lines
cut off.

You are the reader. There is no OCR step and no API key: look at the contact
sheets yourself and use what is known about the building to read them right.

Work from `scripts/mprint`. Install `numpy pillow scipy` if they are missing.

## 1. Get the sheet

The sheet is `https://mprint.umich.edu/assets/floorplans/<tag>/<sheet>.png`
(`ulib_3` is tag `ulib`). Cloud sessions get a 403 from mprint.umich.edu; if
you do, ask the user to upload the sheet. An upload with the same pixel size
works, because readings are pixel positions. Put it at `sheets/<sheet>.png`
(git-ignored).

If the floor is not in `sheets.json` yet, add it with its building slug,
floor, footprint, and the `libcal` and `cms` names the building uses in the
seed data (see the Shapiro entries).

## 2. Read what is already known

```bash
python3 read_rooms.py context <sheet>
```

This lists the room numbers LibCal, the Library CMS and `rooms/known.json`
expect on this floor. LibCal and CMS come from the seed snapshot in
`scripts/seed/raw` (set `SEED_RAW` if it lives elsewhere); without it you only
get `known.json`. Keep this list in mind while reading: a smudged `3O45` next
to an expected `3045` is `3045`.

## 3. Find and read the printed labels

```bash
python3 read_rooms.py candidates sheets/<sheet>.png --out out/
```

This writes numbered contact sheets of every glyph cluster that looks like a
label, an overview with each candidate boxed, and `out/<sheet>_candidates.json`
with each candidate's pixel center. Look at every contact sheet and the
overview. Write `readings/<sheet>.json`:

```json
{
 "image": "<sheet>.png",
 "source": "<MPrint URL>",
 "width": 2200, "height": 3400,
 "dilation": 5, "wall": 200,
 "readBy": "<who>, <date>",
 "skipped": "<candidates that are not room labels, and why>",
 "readings": [{"text": "3045", "x": 1163.5, "y": 1733}]
}
```

- `width` and `height` are the sheet's pixel size; `grow` refuses a sheet of
  another size.
- Take `x`, `y` from the candidate's center. For a label the finder missed
  (usually text touching a wall), place a point inside the room by hand from
  the overview.
- Write the text exactly as printed, letter classes included: `3C07`
  corridor, `3S01` stair, `3E02` elevator, `3V04` vestibule or shaft,
  `3020A` extension. Write `OPEN TO BELOW` and similar as is; those regions
  are dropped from the map.
- Skip notes that are not rooms ("To Building 1000185", "RAMP", "DN", "UP").
- `dilation` 5 suits Shapiro. Raise it only if rooms leak into each other
  through doorways; higher values swallow small rooms.

## 4. Grow rooms and check

```bash
python3 read_rooms.py grow sheets/<sheet>.png readings/<sheet>.json \
    --labels-out out/<sheet>_labels.json --report out/<sheet>_report.md
python3 vectorize.py sheets/<sheet>.png out/<sheet>_labels.json --out out/ --preview out/<sheet>_vector.png
```

Read the report and look at the right half of the preview (rooms colored,
your numbers in blue). Fix what you can by editing the readings and running
`grow` again:

- **Expected but not read**: find it on the sheet. If it is not printed, say
  so to the user; don't invent a position.
- **One region holds two numbers**: usually a doorway with no door drawn. The
  number nearest the region's middle wins. Tell the user which room lost.
- **Readings that landed in no region**: the point is inside a wall or
  outside the building. Move it into the room.
- **Weak merges**: an unnumbered piece joined a neighbor without a clear
  winner. Check it in the preview.
- A room split by furniture should come out as one color. A piece that went
  to the corridor instead of its room shows as corridor color inside the
  room's dashed outline.

When you learn a room's name or number from the user or a page, add it to
`rooms/known.json` under the building slug, with where it came from. Names
there go on the map as `roomName`.

## 5. Hand off

Add `"readings": "readings/<sheet>.json"` to the sheet's entry in
`sheets.json`, run `python3 test_vectorize.py`, and push the readings,
`sheets.json` and any `known.json` change. Don't commit `out/` or a local
pipeline run. The `MPrint fit` workflow downloads the sheet, re-runs `grow`,
and commits the numbered GeoJSON; its preview artifact includes the report.

Then give the user the report's "Needs a person" list and the preview, and
ask them to check the flagged rooms. A person always reviews a floor before
it is called done.
