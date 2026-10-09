#!/usr/bin/env python3
"""Geometry, homography, and outline-fit checks. No floor-plan download required."""

import math
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from fit_outline import drop_spurs, fit_plan, load_footprint, local_frame
from geom import (
    apply_homography,
    homography,
    lnglat_homography,
    mask_polygons,
    pixel_corners,
    signed_area,
    simplify_ring,
)
from vectorize import vectorize


def _rotation(degrees: float) -> np.ndarray:
    theta = math.radians(degrees)
    c, s = math.cos(theta), math.sin(theta)
    return np.array([[c, -s], [s, c]])


class ContourTests(unittest.TestCase):
    def test_rectangle_is_four_corners(self):
        mask = np.zeros((8, 10), dtype=bool)
        mask[2:5, 3:7] = True
        polygons = mask_polygons(mask, simplify=0.5)
        self.assertEqual(len(polygons), 1)
        exterior, holes = polygons[0]
        self.assertEqual(holes, [])
        self.assertAlmostEqual(signed_area(exterior), 12.0)
        pts = {(int(x), int(y)) for x, y in exterior[:-1]}
        self.assertEqual(pts, {(3, 2), (7, 2), (7, 5), (3, 5)})

    def test_hole_is_kept(self):
        mask = np.zeros((12, 12), dtype=bool)
        mask[1:11, 1:11] = True
        mask[4:8, 4:8] = False
        polygons = mask_polygons(mask, simplify=0.5)
        self.assertEqual(len(polygons), 1)
        exterior, holes = polygons[0]
        self.assertEqual(len(holes), 1)
        self.assertAlmostEqual(signed_area(exterior), 100.0)
        self.assertAlmostEqual(signed_area(holes[0]), -16.0)

    def test_diagonal_staircase_becomes_a_line(self):
        stair = [(i // 2, (i + 1) // 2) for i in range(11)]
        ring = np.array(stair + [stair[0]], dtype=float)
        # A staircase is not closed usefully; simplify the open run via a
        # triangle that has the stair as one side.
        pts = np.array([(0, 0), (1, 0), (1, 1), (2, 1), (2, 2), (3, 2), (3, 3), (0, 4)], dtype=float)
        ring = np.vstack([pts, pts[0]])
        simplified = simplify_ring(ring, epsilon=0.8)
        # The stair from (0,0) to (3,3) collapses; the off-axis (0,4) stays.
        self.assertLess(len(simplified), len(ring))
        self.assertTrue(any(np.allclose(p, (0, 4)) for p in simplified[:-1]))
        self.assertTrue(any(np.allclose(p, (3, 3)) or np.allclose(p, (0, 0)) for p in simplified[:-1]))


class ProjectionTests(unittest.TestCase):
    def test_homography_maps_the_corners_and_the_center(self):
        src = pixel_corners(200, 100)
        # A similarity in a local meter frame, stored as lng/lat-like pairs.
        center = src.mean(axis=0)
        rotation = _rotation(1.5)
        scale = 0.05
        dst = scale * ((src - center) @ rotation.T) + np.array([-83.7, 42.27])
        hom = homography(src, dst)
        back = apply_homography(hom, src)
        np.testing.assert_allclose(back, dst, atol=1e-9)
        mid = apply_homography(hom, np.array([[100.0, 50.0]]))
        np.testing.assert_allclose(mid[0], dst.mean(axis=0), atol=1e-9)

    def test_map_corners_flip_y_and_keep_exterior_ccw(self):
        mask = np.zeros((40, 30), dtype=bool)
        mask[5:35, 4:26] = True
        # North at the top of the image: top edge has the greater latitude.
        corners = np.array([
            [-83.70, 42.280],
            [-83.69, 42.280],
            [-83.69, 42.270],
            [-83.70, 42.270],
        ])
        hom = lnglat_homography(30, 40, corners)
        exterior, _ = mask_polygons(mask, simplify=0.5)[0]
        projected = apply_homography(hom, exterior)
        # y-down positive area becomes negative once latitude increases north.
        self.assertGreater(signed_area(exterior), 0)
        self.assertLess(signed_area(projected), 0)


class FitTests(unittest.TestCase):
    def test_spur_drop_removes_a_long_spike_and_keeps_a_bay(self):
        ring = np.array([
            [0, 0], [10, 0], [10, 10], [0, 10],
            [0, 7], [-4, 7], [-4, 6], [0, 6],  # a 4 m bay, shallower than the cutoff
            [0, 4], [-20, 4], [-20, 3], [-18, 2], [0, 2],
        ], dtype=float)
        kept, dropped = drop_spurs(ring, neck=8, min_reach=10)
        self.assertIsNotNone(dropped)
        self.assertLess(kept[:, 0].min(), -3)  # the bay is still there
        self.assertGreater(kept[:, 0].min(), -5)
        self.assertLess(dropped[:, 0].min(), -19)

    def test_shapiro_footprint_drops_the_hatcher_bridge(self):
        path = Path(__file__).parent / "footprints" / "shapiro.json"
        _, ring = load_footprint(str(path), None)
        xy, *_ = local_frame(ring)
        kept, dropped = drop_spurs(xy)
        self.assertIsNotNone(dropped)
        self.assertLess(float(dropped[:, 0].min()), -30)  # the bridge, west of the arcade
        self.assertGreater(float(kept[:, 0].min()), -25)

    def test_similarity_fit_recovers_scale_rotation_and_corners(self):
        height, width = 140, 120
        gray = np.full((height, width), 255, dtype=np.uint8)
        gray[20:100, 15:65] = 0
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "plan.png"
            Image.fromarray(gray).save(image)
            # Outer edge of the filled block, in the y-up frame the fitter uses.
            edge = np.array([[15, 20], [65, 20], [65, 100], [15, 100]], dtype=float)
            plan = np.c_[edge[:, 0], -edge[:, 1]]
            centered = plan - plan.mean(axis=0)
            scale, degrees, shift = 0.05, 2.0, np.array([40.0, -15.0])
            xy = scale * (centered @ _rotation(degrees).T) + shift
            origin = np.array([-83.74, 42.276])
            m_lng = 111_320.0 * math.cos(math.radians(origin[1]))
            lnglat = np.c_[xy[:, 0] / m_lng + origin[0], xy[:, 1] / 111_320.0 + origin[1]]
            footprint = {
                "type": "Feature",
                "properties": {"ObjectName": "Test"},
                "geometry": {"type": "Polygon", "coordinates": [np.vstack([lnglat, lnglat[0]]).tolist()]},
            }
            foot_path = Path(tmp) / "foot.json"
            foot_path.write_text(__import__("json").dumps(footprint))
            result = fit_plan(str(image), str(foot_path), None, wall=200, simplify=0.5)
        # image-up bearing is measured clockwise from north, so the +2°
        # rotation used to build the footprint is reported as -2°.
        self.assertAlmostEqual(result["metersPerPixel"], scale, delta=0.0005)
        self.assertAlmostEqual(result["imageUpDegreesFromNorth"], -degrees, delta=0.05)
        self.assertGreater(result["fit"]["iou"], 0.98)
        self.assertLess(result["fit"]["medianMeters"], 0.02)

    def test_vectorize_splits_two_rooms_and_projects_inside_the_footprint(self):
        # Two rooms split by a vertical wall, inside an outer wall.
        height, width = 80, 90
        gray = np.full((height, width), 255, dtype=np.uint8)
        gray[8:72, 10:80] = 0
        gray[10:70, 12:78] = 255
        gray[10:70, 44:46] = 0
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "rooms.png"
            Image.fromarray(gray).save(image)
            collection, _, _, room_ids, records, _ = vectorize(str(image), None, 0.75, None)
        rooms = [f for f in collection["features"] if f["properties"]["layer"] == "room"]
        self.assertEqual(len(rooms), 2)
        self.assertTrue(any(f["properties"]["layer"] == "structure" for f in collection["features"]))
        self.assertEqual(collection["mprint"]["crs"], "pixel")
        self.assertGreater(int((room_ids > 0).sum()), 1000)
        self.assertEqual(len(records), 2)


if __name__ == "__main__":
    unittest.main()
