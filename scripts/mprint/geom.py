"""Pixel contours, simplification, and the pixel-to-lng/lat homography.

Coordinates in a floor-plan image are pixels, origin at the top-left, x to
the right, y down. A ring traces the boundary of a mask with the mask on the
left, so an exterior ring has positive shoelace area in that y-down frame.
"""

import math

import numpy as np
from collections import defaultdict


def signed_area(ring: np.ndarray) -> float:
    x, y = ring[:-1, 0], ring[:-1, 1]
    x2, y2 = ring[1:, 0], ring[1:, 1]
    return 0.5 * float(np.sum(x * y2 - x2 * y))


def _cw(ax: float, ay: float, bx: float, by: float) -> float:
    """Clockwise angle from vector a to vector b, in y-down pixel space."""
    ang = math.atan2(ax * by - ay * bx, ax * bx + ay * by)
    return ang + 2 * math.pi if ang < 0 else ang


def rings_from_mask(mask: np.ndarray) -> list[np.ndarray]:
    """Closed rings around True pixels. Each ring repeats its first point.

    Exterior rings wind with the mask on the left (positive shoelace area
    when y points down). Holes wind the other way.
    """
    m = np.pad(np.asarray(mask, dtype=bool), 1)
    inside = m[1:-1, 1:-1]
    adj: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
    # (selector, start offset, end offset) relative to the padded pixel.
    specs = (
        (inside & ~m[:-2, 1:-1], 0, 0, 1, 0),  # top edge, walking east
        (inside & ~m[2:, 1:-1], 1, 1, 0, 1),  # bottom edge, walking west
        (inside & ~m[1:-1, :-2], 0, 1, 0, 0),  # left edge, walking north
        (inside & ~m[1:-1, 2:], 1, 0, 1, 1),  # right edge, walking south
    )
    for sel, x0, y0, x1, y1 in specs:
        ys, xs = np.nonzero(sel)
        for y, x in zip(ys.tolist(), xs.tolist()):
            adj[(x + 1 + x0, y + 1 + y0)].append((x + 1 + x1, y + 1 + y1))

    remaining = sum(len(v) for v in adj.values())
    n_edges = remaining
    rings = []
    keys = [k for k, v in adj.items() if v]
    si = 0
    while remaining:
        while si < len(keys) and not adj[keys[si]]:
            si += 1
        start = keys[si] if si < len(keys) else next(k for k, v in adj.items() if v)
        end = adj[start].pop()
        remaining -= 1
        ring = [start, end]
        prev, cur = start, end
        while cur != start:
            outs = adj[cur]
            if not outs:
                raise RuntimeError(f"contour broke at {cur}")
            cx, cy = cur
            ix, iy = cx - prev[0], cy - prev[1]
            bi = min(range(len(outs)), key=lambda i: _cw(ix, iy, outs[i][0] - cx, outs[i][1] - cy))
            nxt = outs.pop(bi)
            remaining -= 1
            prev, cur = cur, nxt
            ring.append(cur)
            if len(ring) > n_edges + 2:
                raise RuntimeError("contour did not close")
        rings.append(np.asarray(ring, dtype=np.float64) - 1.0)
    return rings


def _compress(ring: np.ndarray) -> np.ndarray | None:
    """Drop vertices that lie on the straight edge between their neighbors."""
    pts = ring[:-1] if np.allclose(ring[0], ring[-1]) else ring
    n = len(pts)
    if n < 3:
        return None
    keep = []
    for i in range(n):
        ax, ay = pts[(i - 1) % n]
        bx, by = pts[i]
        cx, cy = pts[(i + 1) % n]
        if (bx - ax) * (cy - by) - (by - ay) * (cx - bx) != 0:
            keep.append((bx, by))
    if len(keep) < 3:
        return None
    out = np.asarray(keep, dtype=np.float64)
    return np.vstack([out, out[0]])


def _rdp(pts: np.ndarray, epsilon: float) -> np.ndarray:
    """Douglas–Peucker. `pts` is an open polyline; endpoints stay."""
    n = len(pts)
    if n < 3 or epsilon <= 0:
        return pts
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = pts[i], pts[j]
        ab = b - a
        length = float(np.hypot(ab[0], ab[1]))
        seg = pts[i + 1 : j]
        if length == 0:
            dist = np.hypot(seg[:, 0] - a[0], seg[:, 1] - a[1])
        else:
            dist = np.abs((seg[:, 0] - a[0]) * ab[1] - (seg[:, 1] - a[1]) * ab[0]) / length
        k = int(np.argmax(dist))
        if dist[k] > epsilon:
            idx = i + 1 + k
            keep[idx] = True
            stack.append((i, idx))
            stack.append((idx, j))
    return pts[keep]


def simplify_ring(ring: np.ndarray, epsilon: float) -> np.ndarray | None:
    """Compress colinear runs, then Douglas–Peucker. Small rings stay tighter
    so room-number glyphs and column dots don't melt."""
    compressed = _compress(ring)
    if compressed is None:
        return None
    if epsilon <= 0 or len(compressed) <= 5:
        return compressed
    span = max(
        float(compressed[:, 0].max() - compressed[:, 0].min()),
        float(compressed[:, 1].max() - compressed[:, 1].min()),
    )
    eps = min(epsilon, 0.6) if span < 28 else epsilon
    pts = compressed[:-1]
    i0 = int(np.lexsort((pts[:, 1], pts[:, 0]))[0])
    d2 = (pts[:, 0] - pts[i0, 0]) ** 2 + (pts[:, 1] - pts[i0, 1]) ** 2
    i1 = int(np.argmax(d2))
    if i1 == i0:
        return compressed

    def chain(i: int, j: int) -> np.ndarray:
        if i <= j:
            return pts[i : j + 1]
        return np.vstack([pts[i:], pts[: j + 1]])

    left = _rdp(chain(i0, i1), eps)
    right = _rdp(chain(i1, i0), eps)
    return np.vstack([left[:-1], right])


def point_in_ring(point: np.ndarray, ring: np.ndarray) -> bool:
    x, y = float(point[0]), float(point[1])
    pts = ring[:-1]
    n = len(pts)
    inside = False
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xinter = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xinter > x:
                inside = not inside
    return inside


def _interior_point(ring: np.ndarray) -> np.ndarray:
    pts = ring[:-1]
    centroid = pts.mean(axis=0)
    if point_in_ring(centroid, ring):
        return centroid
    area = signed_area(ring)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        edge = b - a
        length = float(np.hypot(edge[0], edge[1]))
        if length == 0:
            continue
        left = np.array([-edge[1], edge[0]]) / length
        direction = left if area > 0 else -left
        mid = (a + b) / 2
        for step in (0.5, 1.0, 2.0):
            candidate = mid + direction * step
            if point_in_ring(candidate, ring):
                return candidate
    return centroid


def polygons_from_rings(rings: list[np.ndarray], min_area: float) -> list[tuple[np.ndarray, list[np.ndarray]]]:
    """Pair hole rings with the smallest exterior that contains them."""
    exteriors = []
    holes = []
    for ring in rings:
        area = signed_area(ring)
        if area >= min_area:
            exteriors.append(ring)
        elif area <= -min_area:
            holes.append(ring)
    exteriors.sort(key=signed_area)
    grouped: list[list[np.ndarray]] = [[] for _ in exteriors]
    for hole in holes:
        pt = _interior_point(hole)
        for i, exterior in enumerate(exteriors):
            if point_in_ring(pt, exterior):
                grouped[i].append(hole)
                break
    return list(zip(exteriors, grouped))


def mask_polygons(mask: np.ndarray, simplify: float, min_area: float = 0.5) -> list[tuple[np.ndarray, list[np.ndarray]]]:
    rings = []
    for ring in rings_from_mask(mask):
        simplified = simplify_ring(ring, simplify)
        if simplified is not None:
            rings.append(simplified)
    return polygons_from_rings(rings, min_area)


def homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """Map 4 source points onto 4 destination points. Hartley-normalized DLT."""
    src = np.asarray(src, dtype=float)
    dst = np.asarray(dst, dtype=float)

    def normalize(pts: np.ndarray) -> np.ndarray:
        center = pts.mean(axis=0)
        dist = float(np.mean(np.hypot(pts[:, 0] - center[0], pts[:, 1] - center[1])))
        s = math.sqrt(2) / dist if dist else 1.0
        return np.array([[s, 0, -s * center[0]], [0, s, -s * center[1]], [0, 0, 1.0]])

    def apply_t(transform: np.ndarray, pts: np.ndarray) -> np.ndarray:
        hom = np.c_[pts, np.ones(len(pts))] @ transform.T
        return hom[:, :2] / hom[:, 2:3]

    src_t, dst_t = normalize(src), normalize(dst)
    rows = []
    for (x, y), (u, v) in zip(apply_t(src_t, src), apply_t(dst_t, dst)):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.asarray(rows, dtype=float))
    normalized = vt[-1].reshape(3, 3)
    hom = np.linalg.inv(dst_t) @ normalized @ src_t
    return hom / hom[2, 2]


def apply_homography(hom: np.ndarray, pts: np.ndarray) -> np.ndarray:
    hom_pts = np.c_[np.asarray(pts, dtype=float), np.ones(len(pts))] @ hom.T
    return hom_pts[:, :2] / hom_pts[:, 2:3]


def pixel_corners(width: int, height: int) -> np.ndarray:
    """Top-left, top-right, bottom-right, bottom-left. Same order as floor_plans.corners."""
    return np.array([[0, 0], [width, 0], [width, height], [0, height]], dtype=float)


def lnglat_homography(width: int, height: int, corners: np.ndarray) -> np.ndarray:
    return homography(pixel_corners(width, height), np.asarray(corners, dtype=float))
