#!/usr/bin/env python3
"""
Label a floor's rooms from the numbers printed on the sheet.

Every room worth naming has its number printed inside it, so this starts from
the numbers and grows rooms out of them, instead of naming flood-fill regions
one by one. An agent (or a person) does the reading; the code does the rest.

  1. context     What we already know about the floor: LibCal rooms, Library
                 CMS rooms, and hand-kept facts in rooms/known.json. Read this
                 first; it tells the reader which numbers to expect.
  2. candidates  Find printed labels on the sheet (small glyph clusters) and
                 render them as numbered contact sheets, plus an overview with
                 every candidate boxed so misses are easy to spot.
  3. (read)      Write readings/<sheet>.json: the text of each label and its
                 pixel position. Candidates give exact positions; labels the
                 finder missed (text touching a wall) get a hand-placed point.
  4. grow        Each reading claims the region it sits in. Unnumbered regions
                 join the numbered neighbor they share the most boundary with
                 (furniture drawn inside a room splits it into pieces; this
                 puts them back). Writes the labels file vectorize.py uses and
                 a report of what needs a person: expected rooms not found,
                 numbers in no source, regions with two numbers, and merges.

Usage (from scripts/mprint):
    python3 read_rooms.py context ulib_3
    python3 read_rooms.py candidates sheets/ulib_3.png --out out/
    python3 read_rooms.py grow sheets/ulib_3.png readings/ulib_3.json --report out/ulib_3_report.md
"""

import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from label_rooms import font, load_plan, segment, sha256
from room_names import classify

HERE = Path(__file__).resolve().parent
# The seed snapshot (pull request 14). SEED_RAW points elsewhere when it is not checked out here.
SEED_RAW = Path(os.environ.get("SEED_RAW", HERE.parent / "seed" / "raw"))
ORDINAL = {1: "1st", 2: "2nd", 3: "3rd"}


def sheet_entry(sheet: str) -> dict:
    for entry in json.loads((HERE / "sheets.json").read_text()):
        if entry["sheet"] == sheet:
            return entry
    sys.exit(f"{sheet} is not in sheets.json")


def expected_rooms(entry: dict, seed_raw: Path = SEED_RAW) -> dict:
    """Room number -> what each source says about it, for one building floor."""
    floor = entry["floor"]
    rooms: dict[str, dict] = {}

    def note(number: str, source: str, value) -> None:
        rooms.setdefault(number, {})[source] = value

    libcal_path = seed_raw / "libcal-items.json"
    if entry.get("libcal") and libcal_path.exists():
        prefix = f"{ORDINAL.get(floor, f'{floor}th')} Floor - "
        for location in json.loads(libcal_path.read_text()):
            if entry["libcal"] not in location["location"] or location["kind"] != "spaces":
                continue
            for item in location["items"]:
                title = item["title"]
                match = re.match(rf"{re.escape(prefix)}(\w+) - (.+)", title)
                if match and re.fullmatch(r"\d{3,4}[A-Z]?", match.group(1)):
                    note(match.group(1), "libcal", match.group(2))
    cms_path = seed_raw / "umich-library-cms.json"
    if entry.get("cms") and cms_path.exists():
        cms = json.loads(cms_path.read_text())
        buildings = {b["id"]: b["title"] for b in cms["buildings"]["places"]}
        floors = {f["id"]: f["name"] for f in cms["floors"]}
        for room in cms["rooms"]:
            if buildings.get(room["building"]) != entry["cms"]:
                continue
            if not str(floors.get(room["floor"], "")).startswith(f"{floor} "):
                continue
            note(room["field_room_number"], "cms", room["field_room_name"] or f"capacity {room['field_capacity']}")
    known = json.loads((HERE / "rooms" / "known.json").read_text()).get(entry["building"], {})
    for number, name in known.items():
        if number[:1] == str(floor):
            note(number, "known", name)
    return dict(sorted(rooms.items()))


def find_candidates(gray: np.ndarray, wall: int = 200) -> list[list[int]]:
    """Bounding boxes of clusters of small glyphs: [x0, y0, x1, y1]."""
    ink = gray < wall
    parts, _ = ndimage.label(ink, structure=np.ones((3, 3)))
    glyphs = np.zeros_like(ink)
    for index, box in enumerate(ndimage.find_objects(parts), start=1):
        size = (box[0].stop - box[0].start, box[1].stop - box[1].start)
        if 4 <= max(size) <= 14:
            glyphs[box] |= parts[box] == index
    groups, _ = ndimage.label(ndimage.binary_dilation(glyphs, iterations=2), structure=np.ones((3, 3)))
    boxes = []
    for index, box in enumerate(ndimage.find_objects(groups), start=1):
        h, w = box[0].stop - box[0].start, box[1].stop - box[1].start
        members = len(np.unique(parts[box][(groups[box] == index) & glyphs[box]]))
        if members >= 3 and 10 <= max(h, w) <= 90 and min(h, w) >= 6:
            boxes.append([box[1].start, box[0].start, box[1].stop, box[0].stop])
    return sorted(boxes, key=lambda b: (b[1] // 40, b[0]))


def render_candidates(rgb: Image.Image, boxes: list[list[int]], out: Path, stem: str) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    label_font = font(16)
    per, cols, cell_w, cell_h = 48, 6, 190, 70
    written = []
    for start in range(0, len(boxes), per):
        chunk = boxes[start : start + per]
        sheet = Image.new("RGB", (cols * cell_w, ((len(chunk) + cols - 1) // cols) * cell_h), "white")
        draw = ImageDraw.Draw(sheet)
        for k, (x0, y0, x1, y1) in enumerate(chunk):
            crop = rgb.crop((x0 - 4, y0 - 4, x1 + 4, y1 + 4))
            scale = min(3, 140 / crop.width, 50 / crop.height)
            crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.LANCZOS)
            cx, cy = (k % cols) * cell_w, (k // cols) * cell_h
            draw.rectangle([cx, cy, cx + cell_w - 1, cy + cell_h - 1], outline=(200, 200, 200))
            draw.text((cx + 2, cy + 2), str(start + k), fill=(200, 0, 0), font=label_font)
            sheet.paste(crop, (cx + 45, cy + 10))
        path = out / f"{stem}_candidates_{start // per:02d}.png"
        sheet.save(path)
        written.append(path)
    overview = rgb.convert("RGB").copy()
    draw = ImageDraw.Draw(overview)
    for k, (x0, y0, x1, y1) in enumerate(boxes):
        draw.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], outline=(220, 0, 0), width=2)
        draw.text((x1 + 3, y0 - 4), str(k), fill=(220, 0, 0), font=font(12))
    path = out / f"{stem}_candidates_overview.png"
    overview.save(path)
    written.append(path)
    return written


def _region_at(labels: np.ndarray, keep: set[int], x: float, y: float, radius: int) -> int | None:
    """The kept region nearest a point. Printed text is ink, so the point itself
    usually sits inside the dilated walls, not in a region."""
    h, w = labels.shape
    xi, yi = int(round(x)), int(round(y))
    y0, y1, x0, x1 = max(yi - radius, 0), min(yi + radius + 1, h), max(xi - radius, 0), min(xi + radius + 1, w)
    window = labels[y0:y1, x0:x1]
    mask = np.isin(window, list(keep))
    if not mask.any():
        return None
    ys, xs = np.nonzero(mask)
    d2 = (ys + y0 - y) ** 2 + (xs + x0 - x) ** 2
    pick = int(np.argmin(d2))
    return int(window[ys[pick], xs[pick]])


def _contacts(labels: np.ndarray, region: int, reach: int) -> Counter:
    box = ndimage.find_objects((labels == region).astype(np.int8))[0]
    pad = reach + 1
    sl = (slice(max(box[0].start - pad, 0), box[0].stop + pad), slice(max(box[1].start - pad, 0), box[1].stop + pad))
    sub = labels[sl]
    ring = ndimage.binary_dilation(sub == region, iterations=reach) & (sub != region) & (sub > 0)
    return Counter(sub[ring].tolist())


def grow(image: str, readings_path: str, dilation: int | None = None, wall: int | None = None) -> tuple[dict, dict]:
    rgb, gray = load_plan(image)
    spec = json.loads(Path(readings_path).read_text())
    height, width = gray.shape
    if (spec["width"], spec["height"]) != (width, height):
        sys.exit(f"{readings_path} was read on a {spec['width']}×{spec['height']} sheet; this one is {width}×{height}")
    dilation = dilation or spec.get("dilation", 8)
    wall = wall or spec.get("wall", 200)
    labels, keep_list = segment(gray, dilation, wall)
    # Any enclosed region can take a number, even one under segment()'s size
    # cutoff: a printed number means a closet or shaft is a real room.
    edges = np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    interior = set(range(1, int(labels.max()) + 1)) - set(np.unique(edges).tolist())
    keep = set(keep_list)

    claims: dict[int, list[dict]] = {}
    blocked: set[int] = set()
    unplaced = []
    for reading in spec["readings"]:
        info = classify(reading["text"])
        region = _region_at(labels, interior, reading["x"], reading["y"], dilation + 8)
        if region is None:
            unplaced.append(reading["text"])
        elif info["kind"] == "open":
            blocked.add(region)
        else:
            claims.setdefault(region, []).append(reading)

    keep_list = sorted(keep | set(claims) | blocked)
    keep = set(keep_list)
    assigned: dict[int, str] = {}
    shared = []
    for region, found in claims.items():
        if len(found) > 1:
            ys, xs = np.nonzero(labels == region)
            cx, cy = xs.mean(), ys.mean()
            found = sorted(found, key=lambda r: (r["x"] - cx) ** 2 + (r["y"] - cy) ** 2)
            shared.append({"region": region, "numbers": [r["text"] for r in found]})
        assigned[region] = found[0]["text"]

    # Unnumbered regions join the numbered neighbor with the longest shared
    # boundary, smallest regions first, until nothing changes.
    merges = []
    sizes = dict(zip(keep_list, ndimage.sum(np.ones_like(labels), labels, keep_list)))
    pending = sorted((r for r in keep if r not in assigned and r not in blocked), key=lambda r: sizes[r])
    changed = True
    while changed and pending:
        changed = False
        for region in list(pending):
            contacts = _contacts(labels, region, dilation * 2 + 4)
            numbered = {r: n for r, n in contacts.items() if r in assigned}
            if not numbered:
                continue
            # A piece cut off by furniture usually borders its room along the
            # furniture and a corridor along the room's dashed edge, at similar
            # lengths. Rooms win those ties: corridor contact counts half.
            weight = {r: n * (0.5 if classify(assigned[r])["kind"] == "corridor" else 1.0) for r, n in numbered.items()}
            target = max(weight, key=weight.get)
            share = numbered[target] / max(sum(n for r, n in contacts.items() if r in keep), 1)
            assigned[region] = assigned[target]
            merges.append({"region": region, "into": assigned[target], "px": int(sizes[region]), "share": round(share, 2)})
            pending.remove(region)
            changed = True

    result = {
        "image": Path(image).name,
        "sha256": sha256(image),
        "width": width,
        "height": height,
        "dilation": dilation,
        "wall": wall,
        "labeledBy": f"read_rooms.py grow from {Path(readings_path).name}",
        "labels": {str(r): assigned.get(r) for r in keep_list},
    }
    report = {
        "readings": len(spec["readings"]),
        "unplaced": unplaced,
        "shared": shared,
        "merges": merges,
        "unlabeled": sorted(int(r) for r in pending),
        "open": sorted(int(r) for r in blocked),
        "numbers": sorted({n for n in assigned.values() if n}),
    }
    return result, report


def write_report(report: dict, expected: dict, path: Path, sheet: str) -> None:
    seen = set(report["numbers"])
    lines = [f"# {sheet}: room reading report", ""]
    missing = [n for n in expected if n not in seen]
    lines.append(f"{report['readings']} readings, {len(seen)} numbers placed, {len(report['merges'])} regions merged, "
                 f"{len(report['unlabeled'])} left unlabeled.")
    lines += ["", "## Needs a person", ""]
    if missing:
        lines.append("Expected on this floor but not read on the sheet:")
        lines += [f"- {n}: {', '.join(f'{k} says {v}' for k, v in expected[n].items())}" for n in missing]
    if report["shared"]:
        lines.append("One region holds two or more numbers (an open doorway, or a room drawn without a wall):")
        lines += [f"- region {s['region']}: {', '.join(s['numbers'])} (labeled {s['numbers'][0]})" for s in report["shared"]]
    if report["unplaced"]:
        lines.append(f"Readings that landed in no region: {', '.join(report['unplaced'])}")
    weak = [m for m in report["merges"] if m["share"] < 0.6]
    if weak:
        lines.append("Merges where the neighbor was not a clear winner (check these):")
        lines += [f"- region {m['region']} ({m['px']} px) into {m['into']}, {m['share']:.0%} of its boundary" for m in weak]
    if not (missing or report["shared"] or report["unplaced"] or weak):
        lines.append("Nothing flagged.")
    rooms = sorted(n for n in seen if classify(n)["kind"] == "room")
    unknown = [n for n in rooms if n not in expected]
    lines += ["", "## Matched", ""]
    lines += [f"- {n}: {', '.join(f'{k}: {v}' for k, v in expected[n].items())}" for n in expected if n in seen]
    lines += ["", f"Plain room numbers on the sheet that no source mentions ({len(unknown)}): {', '.join(unknown) or 'none'}", ""]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("context")
    p.add_argument("sheet")
    p = sub.add_parser("candidates")
    p.add_argument("image")
    p.add_argument("--out", default="out")
    p = sub.add_parser("grow")
    p.add_argument("image")
    p.add_argument("readings")
    p.add_argument("--labels-out", help="write the labels file here (default: print a summary only)")
    p.add_argument("--report", help="write a Markdown report here")
    args = parser.parse_args()

    if args.cmd == "context":
        print(json.dumps(expected_rooms(sheet_entry(args.sheet)), indent=1))
    elif args.cmd == "candidates":
        rgb, gray = load_plan(args.image)
        boxes = find_candidates(gray)
        stem = Path(args.image).stem
        out = Path(args.out)
        (out / f"{stem}_candidates.json").parent.mkdir(parents=True, exist_ok=True)
        (out / f"{stem}_candidates.json").write_text(json.dumps(
            [{"index": k, "x": (b[0] + b[2]) / 2, "y": (b[1] + b[3]) / 2, "box": b} for k, b in enumerate(boxes)], indent=1))
        for path in render_candidates(rgb, boxes, out, stem):
            print(path)
        print(f"{len(boxes)} candidates", file=sys.stderr)
    else:
        result, report = grow(args.image, args.readings)
        if args.labels_out:
            Path(args.labels_out).write_text(json.dumps(result, indent=1) + "\n")
        if args.report:
            sheet = Path(args.image).stem
            write_report(report, expected_rooms(sheet_entry(sheet)), Path(args.report), sheet)
        print(f"{len(report['numbers'])} numbers, {len(report['merges'])} merges, {len(report['shared'])} shared, "
              f"{len(report['unlabeled'])} unlabeled", file=sys.stderr)


if __name__ == "__main__":
    main()
