import assert from "node:assert/strict";
import test from "node:test";
import { floorPlanBeforeId } from "./layer-order.ts";

test("the dark basemap keeps the floor plan above its building footprint", () => {
  const layers = [
    { id: "water", type: "fill" },
    { id: "water_name", type: "symbol" },
    { id: "building", type: "fill" },
    { id: "highway_minor", type: "line" },
    { id: "highway_name_other", type: "symbol" },
    { id: "boundary_country_z5-", type: "line" },
    { id: "place_other", type: "symbol" },
  ];
  const before = floorPlanBeforeId(layers);
  assert.equal(before, "place_other");
  assert.ok(layers.findIndex((layer) => layer.id === before) > layers.findIndex((layer) => layer.id === "building"));
});

test("the light basemap still anchors the floor plan under its labels", () => {
  const layers = [
    { id: "building", type: "fill" },
    { id: "highway_minor", type: "line" },
    { id: "boundary_disputed", type: "line" },
    { id: "waterway_line_label", type: "symbol" },
    { id: "label_city", type: "symbol" },
  ];
  assert.equal(floorPlanBeforeId(layers), "waterway_line_label");
});

test("our own floor and selection layers do not move the anchor", () => {
  const layers = [
    { id: "building", type: "fill" },
    { id: "boundary_country_z5-", type: "line" },
    { id: "place_other", type: "symbol" },
    { id: "floor-plan-rooms", type: "fill" },
    { id: "building-selected-fill", type: "fill" },
    { id: "slot-overlays", type: "background" },
  ];
  assert.equal(floorPlanBeforeId(layers), "place_other");
});
