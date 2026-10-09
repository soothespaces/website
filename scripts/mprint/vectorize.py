#!/usr/bin/env python3
"""
Turn an MPrint floor plan into GeoJSON that can sit on the campus map.

Room regions come from the same dilated flood fill as label_rooms.py. This
traces those regions, and the ink of the drawing, into simplified polygons.
Pass an alignment JSON from fit_outline.py and the polygons are written in
longitude/latitude through the same four image corners MapLibre uses to
drape the raster, so the vectors land on the footprint.

Usage:
    python3 vectorize.py ulib_2.png labels/ulib_2.json \\
        --corners alignments/ulib_2.json --out out/ --preview out/ulib_2_vector.png
"""

import argparse
import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

from geom import apply_homography, lnglat_homography, mask_polygons, signed_area
from label_rooms import load_plan, segment, sha256

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _font(size: int):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def alignment_corners(path: str, image: str, width: int, height: int) -> list:
    spec = json.loads(Path(path).read_text())
    if spec.get("sha256") and spec["sha256"] != sha256(image):
        sys.exit(f"{image} does not match the image {path} was fitted to (sha256). Re-run fit_outline.py.")
    if spec.get("width") and spec.get("height") and (spec["width"], spec["height"]) != (width, height):
        sys.exit(f"{path} is for a {spec['width']}×{spec['height']} image; this one is {width}×{height}.")
    corners = spec["corners"]
    if len(corners) != 4 or any(len(pair) != 2 for pair in corners):
        sys.exit(f"{path} corners must be 4 [lng, lat] pairs")
    return corners


def _claim_band(band: np.ndarray, room_ids: np.ndarray, labels: np.ndarray, dilation: int) -> np.ndarray:
    """Return dilation-band pixels on the room side of a wall, labeled by the nearest room.

    The band exists on both sides of every wall. The outside of the exterior
    wall is seeded from white space that touches the image border and is not
    given to a room, so the fill does not grow a halo around the building.
    """
    out = np.zeros(room_ids.shape, dtype=np.int32)
    if dilation <= 0 or not band.any():
        return out
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    exterior_ids = [int(i) for i in border if i]
    exterior = np.isin(labels, exterior_ids) if exterior_ids else np.zeros(labels.shape, dtype=bool)
    kernel = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=bool)
    markers = np.zeros(band.shape, dtype=np.uint8)
    markers[ndimage.binary_dilation(room_ids > 0, structure=kernel) & band] = 1
    markers[ndimage.binary_dilation(exterior, structure=kernel) & band & (markers == 0)] = 2
    for _ in range(dilation + 1):
        markers[ndimage.binary_dilation(markers == 1, structure=kernel) & band & (markers == 0)] = 1
        markers[ndimage.binary_dilation(markers == 2, structure=kernel) & band & (markers == 0)] = 2
    claim = (markers == 1) & (room_ids == 0)
    if not claim.any():
        return out
    _, (iy, ix) = ndimage.distance_transform_edt(room_ids == 0, return_indices=True)
    out[claim] = room_ids[iy[claim], ix[claim]]
    return out


def room_id_mask(gray: np.ndarray, labels: np.ndarray, spec: dict) -> tuple[np.ndarray, list[dict]]:
    """Rooms grown back to the ink. Atriums that contain another region stay holes.

    Printed numbers and columns are holes of ink only. Those are filled here;
    the structure layer redraws the ink on top. A null label (open-to-below,
    a canopy) is not a room, and a hole that contains one is left open.
    """
    wall = int(spec["wall"])
    dilation = int(spec["dilation"])
    ink = gray < wall
    groups: dict[str, list[int]] = {}
    for cid, number in spec["labels"].items():
        if number:
            groups.setdefault(str(number), []).append(int(cid))
    lookup = np.zeros(int(labels.max()) + 1, dtype=np.int32)
    records = []
    for index, number in enumerate(sorted(groups), start=1):
        lookup[groups[number]] = index
        records.append({
            "id": index,
            "roomNumber": None if spec.get("_anonymous") else number,
            "componentIds": groups[number],
        })
    room_ids = lookup[labels]

    closed = ndimage.binary_dilation(ink, iterations=dilation) if dilation else ink
    band = closed & ~ink & (room_ids == 0)
    claimed = _claim_band(band, room_ids, labels, dilation)
    room_ids[claimed > 0] = claimed[claimed > 0]

    blocked_lookup = np.zeros(int(labels.max()) + 1, dtype=bool)
    blocked_lookup[[int(cid) for cid, number in spec["labels"].items() if not number]] = True
    blocked = blocked_lookup[labels]
    # A hole the room encloses lies inside the room's bounding box, so each
    # room is processed on that crop.
    boxes = ndimage.find_objects(room_ids, max_label=len(records))
    for record, box in zip(records, boxes):
        if box is None:
            record["pixelArea"], record["centroid"] = 0, None
            continue
        ids, block = room_ids[box], blocked[box]
        mask = ids == record["id"]
        holes, count = ndimage.label(ndimage.binary_fill_holes(mask) & ~mask)
        for hole_id in range(1, count + 1):
            hole = holes == hole_id
            if (hole & block).any() or np.any((ids[hole] != 0) & (ids[hole] != record["id"])):
                continue
            ids[hole] = record["id"]
        mask = ids == record["id"]
        record["pixelArea"] = int(mask.sum())
        ys, xs = np.nonzero(mask)
        record["centroid"] = None if len(xs) == 0 else [
            int(round(float((xs + box[1].start).mean()))),
            int(round(float((ys + box[0].start).mean()))),
        ]
    return room_ids, records


def _ring_coords(ring: np.ndarray, hom: np.ndarray | None, geographic: bool) -> list[list[float]]:
    pts = apply_homography(hom, ring) if hom is not None else np.asarray(ring, dtype=float)
    closed = pts if np.allclose(pts[0], pts[-1]) else np.vstack([pts, pts[0]])
    if geographic:
        # Source exterior rings are positive in y-down pixels. On the map,
        # exteriors are counter-clockwise in lng/lat and holes are clockwise.
        source_exterior = signed_area(ring) > 0
        if (signed_area(closed) > 0) != source_exterior:
            closed = closed[::-1]
    digits = 7 if geographic else 2

    def num(value: float):
        rounded = round(float(value), digits)
        return int(round(rounded)) if abs(rounded - round(rounded)) < 10 ** (-digits) else rounded

    coords = [[num(x), num(y)] for x, y in closed]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    # Drop consecutive duplicates left behind by rounding.
    deduped = [coords[0]]
    for point in coords[1:]:
        if point != deduped[-1]:
            deduped.append(point)
    if deduped[0] != deduped[-1]:
        deduped.append(deduped[0])
    return deduped


def _geometry(polygons, hom, geographic) -> dict | None:
    coordinates = []
    for exterior, holes in polygons:
        rings = [_ring_coords(exterior, hom, geographic)]
        rings.extend(_ring_coords(hole, hom, geographic) for hole in holes)
        if len(rings[0]) >= 4:
            coordinates.append(rings)
    if not coordinates:
        return None
    if len(coordinates) == 1:
        return {"type": "Polygon", "coordinates": coordinates[0]}
    return {"type": "MultiPolygon", "coordinates": coordinates}


def vectorize(image: str, labels_path: str | None, simplify: float, corners_path: str | None):
    rgb, gray = load_plan(image)
    height, width = gray.shape
    anonymous = labels_path is None
    if anonymous:
        labels, keep = segment(gray, 8, 200)
        spec = {"wall": 200, "dilation": 8, "labels": {str(i): str(i) for i in keep}, "_anonymous": True}
    else:
        spec = json.loads(Path(labels_path).read_text())
        if spec["sha256"] != sha256(image):
            sys.exit(f"{image} differs from the image {labels_path} was labeled on. Re-run label_rooms.py sheet.")
        labels, keep = segment(gray, spec["dilation"], spec["wall"])
        # A labels file from read_rooms.py may name regions under segment()'s
        # size cutoff (a numbered closet); those only have to exist.
        unknown = sorted({k for k in spec["labels"] if not 0 < int(k) <= int(labels.max())}, key=int)
        unlabeled = sorted({str(i) for i in keep} - set(spec["labels"]), key=int)
        if unknown or unlabeled:
            sys.exit(f"labels don't match the segmentation: unknown {unknown}, unlabeled {unlabeled}")

    room_ids, records = room_id_mask(gray, labels, spec)
    corners = alignment_corners(corners_path, image, width, height) if corners_path else None
    hom = lnglat_homography(width, height, np.asarray(corners, dtype=float)) if corners is not None else None
    geographic = hom is not None

    features = []
    for record in records:
        geometry = _geometry(mask_polygons(room_ids == record["id"], simplify), hom, geographic)
        if geometry is None or record["centroid"] is None:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "layer": "room",
                "roomNumber": record["roomNumber"],
                "componentIds": record["componentIds"],
                "pixelArea": record["pixelArea"],
                "centroid": record["centroid"],
            },
            "geometry": geometry,
        })
    structure = _geometry(mask_polygons(gray < spec["wall"], simplify, min_area=1.0), hom, geographic)
    if structure is not None:
        features.append({"type": "Feature", "properties": {"layer": "structure"}, "geometry": structure})

    collection = {
        "type": "FeatureCollection",
        "mprint": {
            "image": Path(image).name,
            "sha256": sha256(image),
            "width": int(width),
            "height": int(height),
            "simplifyPx": simplify,
            "crs": "EPSG:4326" if geographic else "pixel",
            "origin": "top-left",
            "yAxis": "north" if geographic else "down",
            "corners": corners,
        },
        "features": features,
    }
    return collection, rgb, gray, room_ids, records, spec


def render_preview(rgb: Image.Image, room_ids: np.ndarray, records: list[dict], ink: np.ndarray, simplify: float, out: Path) -> None:
    height, width = room_ids.shape
    vector = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(vector)
    for record in sorted(records, key=lambda r: r["pixelArea"], reverse=True):
        hue = (record["id"] * 0.61803398875) % 1.0
        r, g, b = colorsys.hsv_to_rgb(hue, 0.42, 1.0)
        color = (int(r * 255), int(g * 255), int(b * 255))
        for exterior, holes in mask_polygons(room_ids == record["id"], simplify):
            draw.polygon([tuple(p) for p in exterior[:-1]], fill=color)
            for hole in holes:
                draw.polygon([tuple(p) for p in hole[:-1]], fill="white")
    # A wall ring's hole is the whole room interior. Punching that hole on a
    # shared canvas would erase columns and door swings drawn earlier, so each
    # polygon is rasterized on its own and OR-ed in.
    # Each polygon is drawn on a crop of its own bounding box; a full-sheet
    # canvas per polygon took minutes on a 2200×3400 sheet.
    ink_acc = np.zeros((height, width), dtype=bool)
    for exterior, holes in mask_polygons(ink, simplify, min_area=1.0):
        x0, y0 = np.floor(exterior.min(axis=0)).astype(int)
        x1, y1 = np.ceil(exterior.max(axis=0)).astype(int) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, width), min(y1, height)
        if x1 <= x0 or y1 <= y0:
            continue
        scratch = Image.new("L", (x1 - x0, y1 - y0), 0)
        scratch_draw = ImageDraw.Draw(scratch)
        offset = np.array([x0, y0])
        scratch_draw.polygon([tuple(p) for p in exterior[:-1] - offset], fill=255)
        for hole in holes:
            scratch_draw.polygon([tuple(p) for p in hole[:-1] - offset], fill=0)
        ink_acc[y0:y1, x0:x1] |= np.asarray(scratch) > 0
    arr = np.array(vector)
    arr[ink_acc] = (25, 25, 25)
    vector = Image.fromarray(arr)
    label = ImageDraw.Draw(vector)
    font = _font(12)
    for record in records:
        if not record["roomNumber"] or not record["centroid"]:
            continue
        x, y = record["centroid"]
        text = str(record["roomNumber"])
        box = label.textbbox((x, y), text, font=font, anchor="mm")
        label.rectangle([box[0] - 2, box[1] - 1, box[2] + 2, box[3] + 1], fill=(255, 255, 255))
        label.text((x, y), text, fill=(0, 45, 150), font=font, anchor="mm")
    sheet = Image.new("RGB", (width * 2 + 8, height), "white")
    sheet.paste(rgb.convert("RGB"), (0, 0))
    sheet.paste(vector, (width + 8, 0))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("image")
    parser.add_argument("labels", nargs="?", help="labels JSON from label_rooms.py; omit for one polygon per region")
    parser.add_argument("--corners", help="alignment JSON from fit_outline.py; output is EPSG:4326")
    parser.add_argument("--simplify", type=float, default=1.0, help="Douglas–Peucker tolerance in pixels")
    parser.add_argument("--out", help="directory for <stem>_vector.geojson")
    parser.add_argument("--preview", help="side-by-side PNG of the source plan and the vectors")
    args = parser.parse_args()

    collection, rgb, gray, room_ids, records, spec = vectorize(args.image, args.labels, args.simplify, args.corners)
    out_dir = Path(args.out or ".")
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / f"{Path(args.image).stem}_vector.geojson"
    dest.write_text(json.dumps(collection))
    rooms = sum(1 for f in collection["features"] if f["properties"]["layer"] == "room")
    print(f"{rooms} rooms, {collection['mprint']['crs']} -> {dest}")
    if args.preview:
        render_preview(rgb, room_ids, records, gray < spec["wall"], args.simplify, Path(args.preview))
        print(args.preview)


if __name__ == "__main__":
    main()
