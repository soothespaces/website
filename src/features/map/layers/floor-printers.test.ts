import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Corners } from "@/features/floor-alignment/geometry.ts";
import type { Printer } from "@/lib/data/printers.ts";
import { outerRing, pointInRing, ringCentroid } from "./sheet-coords.ts";
import {
  printerAccessibleName,
  printerFacts,
  printerMarkerImage,
  printerPosition,
  spreadPrinters,
} from "./floor-printer-points.ts";

function printer(partial: Partial<Printer> & Pick<Printer, "id" | "displayName">): Printer {
  return {
    buildingSlug: "harold-t-and-vivian-b-shapiro-library",
    floor: 2,
    floorLabel: "2",
    roomNumber: "2000",
    color: false,
    cardReader: true,
    floorMap: "images/maps/ulib/ulib_2.png",
    floorMapX: null,
    floorMapY: null,
    ...partial,
  };
}

test("Shapiro room 2000 printers land in that room, and (0, 0) uses the centroid", () => {
  const index = JSON.parse(readFileSync("public/floor-plans/index.json", "utf8")) as {
    floors: { sheet: string; width: number; height: number; corners: Corners }[];
  };
  const sheet = index.floors.find((entry) => entry.sheet === "ulib_2");
  assert.ok(sheet);
  const plan = JSON.parse(readFileSync("public/floor-plans/harold-t-and-vivian-b-shapiro-library/2.geojson", "utf8")) as {
    features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
  };
  const room = plan.features.find((feature) => feature.properties.roomNumber === "2000");
  assert.ok(room);
  const ring = outerRing(room.geometry);
  assert.ok(ring);
  const [clng, clat] = ringCentroid(ring);
  const placement = { sheet: sheet.sheet, width: sheet.width, height: sheet.height, corners: sheet.corners };
  const centroids = new Map([["2000", { lng: clng, lat: clat }]]);

  const placed = printerPosition(printer({ id: 1, displayName: "Multi", floorMapX: 700, floorMapY: 784 }), placement, centroids);
  assert.ok(placed);
  assert.equal(pointInRing(placed.lng, placed.lat, ring), true);

  const missing = printerPosition(printer({ id: 2, displayName: "Unset", floorMapX: 0, floorMapY: 0 }), placement, centroids);
  assert.deepEqual(missing, { lng: clng, lat: clat });

  const otherSheet = printerPosition(
    printer({ id: 3, displayName: "Other", floorMap: "images/maps/ulib/ulib_1.png", floorMapX: 812, floorMapY: 1170 }),
    placement,
    centroids,
  );
  assert.deepEqual(otherSheet, { lng: clng, lat: clat });

  const longerSheet = printerPosition(
    printer({ id: 4, displayName: "Ten", floorMap: "images/maps/ulib/ulib_10.png", floorMapX: 10, floorMapY: 10 }),
    placement,
    centroids,
  );
  assert.deepEqual(longerSheet, { lng: clng, lat: clat });
});

test("printer copy and overlapping markers", () => {
  assert.equal(printerAccessibleName(printer({ id: 1, displayName: "Ignored", roomNumber: "2001" })), "Printer, Room 2001");
  assert.equal(printerAccessibleName(printer({ id: 1, displayName: "Lobby printer", roomNumber: null })), "Printer, Lobby printer");
  assert.deepEqual(printerFacts(printer({ id: 1, displayName: "Color", color: true, cardReader: false })), [
    "Color",
    "No card reader",
  ]);
  const image = printerMarkerImage(32);
  assert.equal(image.data[(16 * 32 + 16) * 4 + 3], 255);
  assert.equal(image.data[3], 0);
  const spread = spreadPrinters([
    { printer: printer({ id: 1, displayName: "A" }), lng: 1, lat: 2 },
    { printer: printer({ id: 2, displayName: "B" }), lng: 1, lat: 2 },
  ]);
  assert.equal(spread[0].lng, 1);
  assert.notEqual(spread[1].lng, spread[0].lng);
});

test("a floor on two sheets places each printer with its own sheet's corners (QA-017)", () => {
  const corners = (x: number): Corners => [
    [x, 1],
    [x + 1, 1],
    [x + 1, 0],
    [x, 0],
  ];
  const north = { sheet: "hatcher_north_2", width: 100, height: 100, corners: corners(0) };
  const south = { sheet: "hatcher_south_2", width: 100, height: 100, corners: corners(10) };
  const centroids = new Map([["200", { lng: 5, lat: 0.5 }]]);
  const onSouth = printerPosition(
    printer({ id: 1, displayName: "S", roomNumber: "200", floorMap: "x/hatcher_south_2.png", floorMapX: 50, floorMapY: 50 }),
    [north, south],
    centroids,
  );
  assert.ok(onSouth && onSouth.lng > 10 && onSouth.lng < 11);
  const unknownSheet = printerPosition(
    printer({ id: 2, displayName: "U", roomNumber: "200", floorMap: null, floorMapX: 50, floorMapY: 50 }),
    [north, south],
    centroids,
  );
  assert.deepEqual(unknownSheet, { lng: 5, lat: 0.5 });
});
