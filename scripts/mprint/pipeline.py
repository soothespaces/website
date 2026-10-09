#!/usr/bin/env python3
"""
Run every sheet in sheets.json from MPrint PNG to map-ready GeoJSON.

For each sheet: download it (unless it is already in --sheets), fit it onto
its building footprint (alignments/<sheet>.json), and, when the fit is usable,
trace its rooms and ink into longitude/latitude
(public/floor-plans/<building>/<floor>.geojson). public/floor-plans/index.json
lists every floor with its corners, whether it is usable, and its GeoJSON.

Each floor's GeoJSON has two kinds of feature, told apart by `layer`:
`room` (one polygon per room, `roomNumber` when the floor is labeled) and
`structure` (one MultiPolygon of the drawing's ink: walls, doors, stairs,
columns, printed text). Draw rooms as a fill and structure as a dark fill on
top; both are plain GeoJSON sources in MapLibre.

Usage (from scripts/mprint):
    python3 pipeline.py --sheets sheets/ --previews out/
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

from fit_outline import fit_plan, render_preview as render_fit
from vectorize import render_preview, vectorize

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parent.parent / "public" / "floor-plans"
MPRINT = "https://mprint.umich.edu/assets/floorplans/{tag}/{sheet}.png"


def fetch(sheet: str, directory: Path) -> Path:
    path = directory / f"{sheet}.png"
    if not path.exists():
        directory.mkdir(parents=True, exist_ok=True)
        url = MPRINT.format(tag=sheet.rsplit("_", 1)[0], sheet=sheet)
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    return path


def map_features(collection: dict) -> list[dict]:
    """Keep what the map draws; pixel bookkeeping stays in the full export."""
    out = []
    for feature in collection["features"]:
        props = feature["properties"]
        keep = {"layer": props["layer"]}
        if props["layer"] == "room":
            keep["roomNumber"] = props["roomNumber"]
        out.append({"type": "Feature", "properties": keep, "geometry": feature["geometry"]})
    return out


def run(entry: dict, sheets: Path, previews: Path | None) -> dict:
    sheet = entry["sheet"]
    image = fetch(sheet, sheets)
    fit = fit_plan(str(image), str(HERE / entry["footprint"]), None, 200, 1.0,
                   entry.get("close", 0), entry.get("up", 0.0))
    preview = fit.pop("_preview")
    fit["footprint"] = entry["footprint"]
    alignment = HERE / "alignments" / f"{sheet}.json"
    alignment.write_text(json.dumps(fit, indent=1) + "\n")
    if previews:
        render_fit(preview["plan"], preview["footprint"], preview["dropped"], previews / f"{sheet}_fit.png")

    record = {
        "building": entry["building"],
        "floor": entry["floor"],
        "sheet": sheet,
        "sha256": fit["sha256"],
        "corners": fit["corners"],
        "usable": fit["usable"],
        "fitMedianMeters": fit["fit"]["medianMeters"],
        "labeled": "labels" in entry,
        "geojson": None,
    }
    if not fit["usable"]:
        return record

    labels = str(HERE / entry["labels"]) if "labels" in entry else None
    collection, rgb, gray, room_ids, records, spec = vectorize(str(image), labels, 1.0, str(alignment))
    dest = PUBLIC / entry["building"] / f"{entry['floor']}.geojson"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"type": "FeatureCollection", "features": map_features(collection)}, separators=(",", ":")))
    record["geojson"] = "/" + dest.relative_to(PUBLIC.parent).as_posix()
    record["rooms"] = sum(1 for f in collection["features"] if f["properties"]["layer"] == "room")
    if previews:
        render_preview(rgb, room_ids, records, gray < spec["wall"], 1.0, previews / f"{sheet}_vector.png")
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sheets", default="sheets", help="where downloaded PNGs live (downloads the missing ones)")
    parser.add_argument("--previews", help="write fit and vector preview PNGs here")
    parser.add_argument("--only", nargs="*", help="sheet names to run (default: all in sheets.json)")
    args = parser.parse_args()

    manifest = json.loads((HERE / "sheets.json").read_text())
    previews = Path(args.previews) if args.previews else None
    if previews:
        previews.mkdir(parents=True, exist_ok=True)
    index_path = PUBLIC / "index.json"
    index = {(f["building"], f["floor"]): f for f in json.loads(index_path.read_text())["floors"]} if index_path.exists() else {}
    for entry in manifest:
        if args.only and entry["sheet"] not in args.only:
            continue
        record = run(entry, Path(args.sheets), previews)
        index[(record["building"], record["floor"])] = record
        state = f"{record['rooms']} rooms -> {record['geojson']}" if record["geojson"] else "fit not usable, no GeoJSON"
        print(f"{entry['sheet']}: median {record['fitMedianMeters']} m, {state}", file=sys.stderr)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    floors = sorted(index.values(), key=lambda f: (f["building"], f["floor"]))
    index_path.write_text(json.dumps({"floors": floors}, indent=1) + "\n")


if __name__ == "__main__":
    main()
