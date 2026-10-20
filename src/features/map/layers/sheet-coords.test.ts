import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Corners } from "@/features/floor-alignment/geometry.ts";
import { outerRing, pixelToLngLat, pointInRing } from "./sheet-coords.ts";

test("sheet corners and the center round-trip through the homography", () => {
  const index = JSON.parse(readFileSync("public/floor-plans/index.json", "utf8")) as {
    floors: { sheet: string; width: number; height: number; corners: Corners }[];
  };
  const floor = index.floors.find((entry) => entry.sheet === "ulib_2");
  assert.ok(floor);
  const { width, height, corners } = floor;
  for (const [x, y, corner] of [
    [0, 0, corners[0]],
    [width, 0, corners[1]],
    [width, height, corners[2]],
    [0, height, corners[3]],
  ] as const) {
    const [lng, lat] = pixelToLngLat(corners, width, height, x, y);
    assert.ok(Math.abs(lng - corner[0]) < 1e-8, `${x},${y} lng`);
    assert.ok(Math.abs(lat - corner[1]) < 1e-8, `${x},${y} lat`);
  }
  const [lng, lat] = pixelToLngLat(corners, width, height, width / 2, height / 2);
  const midLng = corners.reduce((sum, corner) => sum + corner[0], 0) / 4;
  const midLat = corners.reduce((sum, corner) => sum + corner[1], 0) / 4;
  assert.ok(Math.abs(lng - midLng) < 1e-5);
  assert.ok(Math.abs(lat - midLat) < 1e-5);
});

test("a point inside a square ring is inside, and a point outside is not", () => {
  const ring: [number, number][] = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ];
  assert.equal(pointInRing(1, 1, ring), true);
  assert.equal(pointInRing(3, 1, ring), false);
  assert.ok(outerRing({ type: "Polygon", coordinates: [ring] }));
});
