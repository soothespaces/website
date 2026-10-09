#!/usr/bin/env python3
"""
Fit an MPrint floor plan onto a building footprint and write map corners.

The plan is a raster. The footprint (FO's campus map, for Shapiro) is a
polygon in longitude/latitude. This estimates the one transform the drawing
actually has — scale, rotation, and shift, no shear — and records the
lng/lat of the image's four corners in the order `floor_plans.corners` uses
(top-left, top-right, bottom-right, bottom-left).

Parts of a footprint that are not on the sheet are left out of the score.
Shapiro's footprint includes the bridge west to Hatcher; that spur sticks
out and comes back. The fit runs with and without the spur and keeps the one
with more overlap, so a real wing that happens to look like a spur stays.

Usage:
    python3 fit_outline.py ulib_1.png footprints/shapiro.json --out alignments/ulib_1.json
"""

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from geom import pixel_corners, rings_from_mask, signed_area, simplify_ring
from label_rooms import load_plan, sha256

M_PER_DEG_LAT = 111_320.0


def silhouette(gray: np.ndarray, wall: int, close: int = 0) -> np.ndarray:
    """Filled building: everything that is not white space connected to the border.

    `close` seals gaps in the outer wall up to about twice that many pixels
    (window bands drawn as thin parallel lines on Shapiro floor 3), so the
    outside does not leak into the floor. A large value also bridges a ring
    of free-standing columns, which is where FO draws Duderstadt's edge."""
    ink = gray < wall
    if close:
        ink = ndimage.binary_closing(ink, structure=np.ones((3, 3), dtype=bool), iterations=close)
    labels, _ = ndimage.label(~ink)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    exterior_ids = [int(i) for i in border if i]
    exterior = np.isin(labels, exterior_ids) if exterior_ids else np.zeros(gray.shape, dtype=bool)
    building = ~exterior
    parts, count = ndimage.label(building)
    if count == 0:
        raise RuntimeError("no building silhouette; the sheet may be blank or the wall threshold is off")
    sizes = ndimage.sum(building, parts, range(1, count + 1))
    return parts == int(np.argmax(sizes)) + 1


def outer_ring(gray: np.ndarray, wall: int, simplify: float, close: int = 0) -> np.ndarray:
    mask = silhouette(gray, wall, close)
    rings = rings_from_mask(mask)
    ring = max(rings, key=lambda r: abs(signed_area(r)))
    simplified = simplify_ring(ring, simplify)
    if simplified is None:
        raise RuntimeError("outer ring simplified away")
    return simplified


def load_footprint(path: str, name: str | None) -> tuple[dict, np.ndarray]:
    data = json.loads(Path(path).read_text())
    if data.get("type") == "Feature":
        features = [data]
    elif data.get("type") == "FeatureCollection":
        features = data["features"]
    else:
        sys.exit(f"{path} is not a GeoJSON Feature or FeatureCollection")
    if name:
        features = [f for f in features if name == (f.get("properties") or {}).get("ObjectName") or name == (f.get("properties") or {}).get("name")]
    if len(features) != 1:
        names = [(f.get("properties") or {}).get("ObjectName") or (f.get("properties") or {}).get("name") for f in features[:12]]
        sys.exit(f"expected one footprint feature, found {len(features)} ({names}). Pass --name.")
    geom = features[0]["geometry"]
    if geom["type"] == "Polygon":
        candidates = [geom["coordinates"][0]]
    elif geom["type"] == "MultiPolygon":
        candidates = [poly[0] for poly in geom["coordinates"]]
    else:
        sys.exit(f"footprint geometry is {geom['type']}; expected a Polygon or MultiPolygon")
    # A building can be more than one ring (Duderstadt has a small second part).
    # The sheet is one outline, so fit the largest ring.
    def ring_area(coords) -> float:
        pts = np.asarray(coords, dtype=float)[:, :2]
        return abs(float(np.sum(pts[:, 0] * np.roll(pts[:, 1], -1) - np.roll(pts[:, 0], -1) * pts[:, 1])))

    ring = np.asarray(max(candidates, key=ring_area), dtype=float)[:, :2]
    if len(ring) >= 2 and np.allclose(ring[0], ring[-1]):
        ring = ring[:-1]
    return features[0], ring


def _chain(pts: np.ndarray, i: int, length: int) -> np.ndarray:
    j = (i + length) % len(pts)
    if i < j:
        return pts[i : j + 1]
    return np.vstack([pts[i:], pts[: j + 1]])


def _chord_distance(chain: np.ndarray) -> float:
    a, b = chain[0], chain[-1]
    ab = b - a
    length = float(np.hypot(ab[0], ab[1]))
    if length == 0:
        return float(np.max(np.hypot(chain[:, 0] - a[0], chain[:, 1] - a[1])))
    return float(np.max(np.abs((chain[:, 0] - a[0]) * ab[1] - (chain[:, 1] - a[1]) * ab[0]) / length))


def drop_spurs(ring: np.ndarray, neck: float = 8.0, min_reach: float = 10.0) -> tuple[np.ndarray, np.ndarray | None]:
    """Remove one chain that leaves the body and returns within `neck` meters
    while reaching at least `min_reach` meters out. That is the Hatcher bridge
    on Shapiro, and it is not a column bay (those are only a few meters deep)."""
    pts = np.asarray(ring, dtype=float)
    n = len(pts)
    best = None
    for i in range(n):
        for length in range(2, n // 2):
            end = pts[(i + length) % n]
            if float(np.hypot(*(pts[i] - end))) > neck:
                continue
            reach = _chord_distance(_chain(pts, i, length))
            if reach >= min_reach and (best is None or reach > best[0]):
                best = (reach, i, length)
    if best is None:
        return pts, None
    _, i, length = best
    j = (i + length) % n
    dropped = _chain(pts, i, length)
    if i < j:
        kept = np.vstack([pts[: i + 1], pts[j:]])
    else:
        kept = pts[j : i + 1]
    return kept, dropped


def resample_closed(poly: np.ndarray, step: float) -> np.ndarray:
    pts = poly if np.allclose(poly[0], poly[-1]) else np.vstack([poly, poly[0]])
    seg = np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1]))
    total = float(seg.sum())
    if total == 0:
        return pts[:1]
    count = max(int(round(total / step)), 8)
    targets = np.linspace(0, total, count, endpoint=False)
    cumulative = np.concatenate([[0.0], np.cumsum(seg)])
    out = []
    j = 0
    for target in targets:
        while j < len(seg) - 1 and cumulative[j + 1] < target:
            j += 1
        span = cumulative[j + 1] - cumulative[j]
        frac = 0.0 if span == 0 else (target - cumulative[j]) / span
        out.append(pts[j] * (1 - frac) + pts[j + 1] * frac)
    return np.asarray(out)


def umeyama(src: np.ndarray, dst: np.ndarray) -> tuple[float, np.ndarray, np.ndarray]:
    """Similarity (scale, rotation, shift) from matched points. No reflection."""
    mu_s, mu_d = src.mean(axis=0), dst.mean(axis=0)
    ss, dd = src - mu_s, dst - mu_d
    cov = (dd.T @ ss) / len(src)
    u, singular, vt = np.linalg.svd(cov)
    rotation = u @ vt
    if np.linalg.det(rotation) < 0:
        u = u.copy()
        u[:, -1] *= -1
        rotation = u @ vt
        singular = singular.copy()
        singular[-1] *= -1
    variance = float((ss ** 2).sum() / len(src))
    scale = float(singular.sum() / variance) if variance else 1.0
    shift = mu_d - scale * (rotation @ mu_s)
    return scale, rotation, shift


def apply_similarity(scale: float, rotation: np.ndarray, shift: np.ndarray, pts: np.ndarray) -> np.ndarray:
    return scale * (np.asarray(pts, dtype=float) @ rotation.T) + shift


def closest_on_ring(points: np.ndarray, poly: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Closest point on a closed polyline, and the distance to it.

    Correspondences land on the segments themselves, not on a sample of them,
    so a corner is not pulled inward toward a nearby sample.
    """
    ring = poly if np.allclose(poly[0], poly[-1]) else np.vstack([poly, poly[0]])
    a, b = ring[:-1], ring[1:]
    ab = b - a
    length2 = np.sum(ab * ab, axis=1)
    length2[length2 == 0] = 1e-12
    nearest = np.empty_like(points, dtype=float)
    distance = np.empty(len(points))
    for start in range(0, len(points), 400):
        query = points[start : start + 400]
        rel = query[:, None, :] - a[None, :, :]
        t = np.clip(np.sum(rel * ab[None, :, :], axis=2) / length2, 0, 1)
        proj = a[None, :, :] + t[:, :, None] * ab[None, :, :]
        delta = query[:, None, :] - proj
        dist = np.hypot(delta[:, :, 0], delta[:, :, 1])
        pick = dist.argmin(axis=1)
        rows = np.arange(len(query))
        nearest[start : start + len(query)] = proj[rows, pick]
        distance[start : start + len(query)] = dist[rows, pick]
    return nearest, distance


def segment_distance(points: np.ndarray, poly: np.ndarray) -> np.ndarray:
    """Distance from each point to the closest place on a closed polyline."""
    _, distance = closest_on_ring(points, poly)
    return distance


def local_frame(lnglat: np.ndarray) -> tuple[np.ndarray, np.ndarray, float, float]:
    origin = lnglat.mean(axis=0)
    m_lng = M_PER_DEG_LAT * math.cos(math.radians(float(origin[1])))
    xy = np.c_[(lnglat[:, 0] - origin[0]) * m_lng, (lnglat[:, 1] - origin[1]) * M_PER_DEG_LAT]
    return xy, origin, m_lng, M_PER_DEG_LAT


def xy_to_lnglat(xy: np.ndarray, origin: np.ndarray, m_lng: float) -> np.ndarray:
    return np.c_[xy[:, 0] / m_lng + origin[0], xy[:, 1] / M_PER_DEG_LAT + origin[1]]


def _rotation(degrees: float) -> np.ndarray:
    theta = math.radians(degrees)
    c, s = math.cos(theta), math.sin(theta)
    return np.array([[c, -s], [s, c]])


def area_centroid(poly: np.ndarray) -> np.ndarray:
    """Centroid of the enclosed area. A vertex mean leans toward whichever
    stretch of edge happens to have the most vertices, and FO's footprints
    are drawn with very uneven vertex density."""
    x, y = poly[:, 0], poly[:, 1]
    xn, yn = np.roll(x, -1), np.roll(y, -1)
    cross = x * yn - xn * y
    area = float(cross.sum()) / 2
    if abs(area) < 1e-12:
        return poly.mean(axis=0)
    return np.array([float(((x + xn) * cross).sum()), float(((y + yn) * cross).sum())]) / (6 * area)


def fit_similarity(plan_xy: np.ndarray, footprint_xy: np.ndarray, up: float = 0.0) -> tuple[float, np.ndarray, np.ndarray, np.ndarray]:
    """ICP. `plan_xy` is in a y-up pixel frame (x right, y = -row), centered on its vertex mean.

    `up` is a rough bearing for the top of the sheet, clockwise from north;
    the search covers 6° either side of it.

    Returns scale (meters per pixel), rotation, shift, and the fitted plan points.
    """
    centered = plan_xy - plan_xy.mean(axis=0)
    plan_span = plan_xy.max(axis=0) - plan_xy.min(axis=0)
    foot_span = footprint_xy.max(axis=0) - footprint_xy.min(axis=0)
    scale0 = float(np.mean(foot_span / np.maximum(plan_span, 1e-6)))
    step = max(1, len(centered) // 250)
    probe = centered[::step]
    # The coarse search pins the plan's area centroid on the footprint's.
    offset = area_centroid(centered)
    center = area_centroid(footprint_xy)

    best = None
    for degrees in np.linspace(-up - 6, -up + 6, 25):
        rotation = _rotation(float(degrees))
        for scale in np.linspace(scale0 * 0.92, scale0 * 1.08, 9):
            placed = ((probe - offset) * scale) @ rotation.T + center
            _, dist = closest_on_ring(placed, footprint_xy)
            median = float(np.median(dist))
            if best is None or median < best[0]:
                best = (median, float(scale), float(degrees))
    scale, rotation = best[1], _rotation(best[2])
    # ICP starts from the pose the search picked: `offset` lands on `center`.
    shift = center - scale * (rotation @ offset)
    # A few hundred vertices are enough to pin down four degrees of freedom,
    # and the real outlines have thousands.
    icp_step = max(1, len(centered) // 400)
    src = centered[::icp_step]
    placed = apply_similarity(scale, rotation, shift, src)
    for iteration in range(20):
        proj, dist = closest_on_ring(placed, footprint_xy)
        limit = 6.0 if iteration < 3 else 3.0
        ok = dist < limit
        if ok.mean() < 0.5:
            ok = dist < 8.0
        scale, rotation, shift = umeyama(src[ok], proj[ok])
        placed = apply_similarity(scale, rotation, shift, src)
    return scale, rotation, shift, apply_similarity(scale, rotation, shift, centered)


def raster_iou(a_xy: np.ndarray, b_xy: np.ndarray, resolution: float = 0.2) -> tuple[float, float, float]:
    both = np.vstack([a_xy, b_xy])
    min_xy = both.min(axis=0) - 1
    max_xy = both.max(axis=0) + 1
    width = int((max_xy[0] - min_xy[0]) / resolution) + 1
    height = int((max_xy[1] - min_xy[1]) / resolution) + 1

    def paint(poly: np.ndarray) -> np.ndarray:
        img = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(img)
        pts = [((x - min_xy[0]) / resolution, (max_xy[1] - y) / resolution) for x, y in poly]
        draw.polygon(pts, fill=1)
        return np.asarray(img, dtype=bool)

    aa, bb = paint(a_xy), paint(b_xy)
    inter = int((aa & bb).sum())
    union = int((aa | bb).sum())
    iou = inter / union if union else 0.0
    plan_in_foot = inter / int(aa.sum()) if aa.any() else 0.0
    foot_in_plan = inter / int(bb.sum()) if bb.any() else 0.0
    return iou, plan_in_foot, foot_in_plan


def render_preview(plan_xy: np.ndarray, footprint_xy: np.ndarray, dropped_xy: np.ndarray | None, out: Path) -> None:
    both = [plan_xy, footprint_xy]
    if dropped_xy is not None:
        both.append(dropped_xy)
    pts = np.vstack(both)
    min_xy, max_xy = pts.min(axis=0) - 3, pts.max(axis=0) + 3
    scale = 8  # px per meter
    width = int((max_xy[0] - min_xy[0]) * scale) + 1
    height = int((max_xy[1] - min_xy[1]) * scale) + 1
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    def line(poly, fill, width_px=2):
        ring = poly if np.allclose(poly[0], poly[-1]) else np.vstack([poly, poly[0]])
        seq = [((x - min_xy[0]) * scale, (max_xy[1] - y) * scale) for x, y in ring]
        draw.line(seq, fill=fill, width=width_px)

    if dropped_xy is not None:
        line(dropped_xy, (180, 180, 180), 3)
    line(footprint_xy, (200, 30, 30), 3)
    line(plan_xy, (20, 70, 200), 2)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)


def fit_plan(image: str, footprint_path: str, name: str | None, wall: int, simplify: float, close: int = 0, up: float = 0.0) -> dict:
    _, gray = load_plan(image)
    ring = outer_ring(gray, wall, simplify, close)
    # y-up so north stays north once the drawing is rotated onto the footprint.
    plan = np.c_[ring[:-1, 0], -ring[:-1, 1]]
    _, footprint_ll = load_footprint(footprint_path, name)
    footprint_xy, origin, m_lng, _ = local_frame(footprint_ll)
    # A spur is only left out when the fit agrees: Shapiro's bridge is not on
    # the sheet, but the narrow west end of Duderstadt's footprint is.
    kept_xy, spur = drop_spurs(footprint_xy)
    candidates = [(footprint_xy, None)] + ([(kept_xy, spur)] if spur is not None else [])
    best = None
    for candidate_xy, candidate_spur in candidates:
        scale, rotation, shift, placed = fit_similarity(plan, candidate_xy, up)
        overlap = raster_iou(placed, candidate_xy)
        if best is None or overlap[0] > best[0][0]:
            best = (overlap, candidate_xy, candidate_spur, scale, rotation, shift, placed)
    (iou, plan_in_foot, foot_in_plan), footprint_xy, dropped, scale, rotation, shift, placed = best

    samples = resample_closed(placed, 0.5)
    distance = segment_distance(samples, footprint_xy)
    top = rotation @ np.array([0.0, 1.0])
    degrees = math.degrees(math.atan2(float(top[0]), float(top[1])))

    height, width = gray.shape
    corners_px = pixel_corners(width, height)
    corners_plan = np.c_[corners_px[:, 0], -corners_px[:, 1]] - plan.mean(axis=0)
    corners_xy = apply_similarity(scale, rotation, shift, corners_plan)
    corners_ll = xy_to_lnglat(corners_xy, origin, m_lng)

    east = samples[:, 0] >= float(np.median(samples[:, 0]))
    west = ~east

    def side(mask: np.ndarray) -> float | None:
        return None if not mask.any() else round(float(np.median(distance[mask])), 3)

    return {
        "image": Path(image).name,
        "sha256": sha256(image),
        "width": int(width),
        "height": int(height),
        "wall": wall,
        "close": close,
        "upHint": up,
        "footprint": str(footprint_path),
        "spurDropped": dropped is not None,
        "transform": "similarity",
        "metersPerPixel": round(scale, 6),
        "cmPerPixel": round(scale * 100, 3),
        "imageUpDegreesFromNorth": round(degrees, 3),
        "fit": {
            "medianMeters": round(float(np.median(distance)), 3),
            "p90Meters": round(float(np.percentile(distance, 90)), 3),
            "fractionWithin1m": round(float((distance < 1).mean()), 3),
            "fractionWithin0_5m": round(float((distance < 0.5).mean()), 3),
            "iou": round(iou, 3),
            "planCoveredByFootprint": round(plan_in_foot, 3),
            "footprintCoveredByPlan": round(foot_in_plan, 3),
            "medianMetersEastHalf": side(east),
            "medianMetersWestHalf": side(west),
        },
        # Shapiro's ground floor lands near 0.3 m and 0.97 overlap. A fit this
        # loose means the footprint is not the wall line on the sheet.
        "usable": bool(float(np.median(distance)) <= 1.0 and iou >= 0.9),
        "corners": [[round(float(lng), 7), round(float(lat), 7)] for lng, lat in corners_ll],
        "_preview": {"plan": placed, "footprint": footprint_xy, "dropped": dropped},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("image")
    parser.add_argument("footprint", help="GeoJSON Polygon, or a FeatureCollection plus --name")
    parser.add_argument("--name", help="ObjectName to pick out of a FeatureCollection")
    parser.add_argument("--wall", type=int, default=200)
    parser.add_argument("--simplify", type=float, default=1.0, help="px tolerance on the outer edge before fitting")
    parser.add_argument("--close", type=int, default=0, help="seal outer-wall gaps up to about 2x this many px")
    parser.add_argument("--up", type=float, default=0.0, help="rough bearing of the sheet's top, degrees clockwise from north")
    parser.add_argument("--out", help="write the corners JSON here")
    parser.add_argument("--preview", help="write a red-footprint / blue-plan overlay PNG")
    args = parser.parse_args()

    result = fit_plan(args.image, args.footprint, args.name, args.wall, args.simplify, args.close, args.up)
    preview = result.pop("_preview")
    if args.preview:
        render_preview(preview["plan"], preview["footprint"], preview["dropped"], Path(args.preview))
        print(args.preview)
    text = json.dumps(result, indent=1)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text + "\n")
        print(path)
    else:
        print(text)
    fit = result["fit"]
    print(
        f"{result['cmPerPixel']} cm/px, image up {result['imageUpDegreesFromNorth']}° from north, "
        f"median {fit['medianMeters']} m, {fit['fractionWithin1m']:.0%} of the edge within 1 m, IoU {fit['iou']}"
        + ("" if result["usable"] else " — not tight enough to use as map corners"),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
