import assert from "node:assert/strict";
import test from "node:test";
import { campusDetailBeforeId, floorPlanBeforeId } from "./layer-order.ts";

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

test("our own layers do not move the anchor", () => {
  // The order once the map is up: campus detail under the first label, our
  // fills in the floor-plan band, and the hit area, outline, and curb ramps
  // under the overlays slot. All of ours read GeoJSON.
  const ours = (id: string, type: string) => ({ id, type, sourceType: "geojson" });
  const layers = [
    { id: "water", type: "fill", sourceType: "vector" },
    ours("fo-9-fill", "fill"),
    { id: "slot-campus-detail", type: "background" },
    { id: "water_name", type: "symbol", sourceType: "vector" },
    { id: "building", type: "fill", sourceType: "vector" },
    { id: "boundary_country_z5-", type: "line", sourceType: "vector" },
    ours("study-buildings", "fill"),
    ours("not-study-buildings", "fill"),
    ours("floor-plan-rooms", "fill"),
    { id: "slot-floor-plans", type: "background" },
    { id: "place_other", type: "symbol", sourceType: "vector" },
    ours("buildings-hit", "fill"),
    ours("building-selected-fill", "fill"),
    ours("building-selected-outline", "line"),
    ours("floor-plan-labels", "symbol"),
    ours("curb-ramps", "line"),
    ours("accessible-entrances", "circle"),
    { id: "slot-overlays", type: "background" },
  ];
  assert.equal(floorPlanBeforeId(layers), "place_other");
});

test("campus detail stays under the first basemap label, not under our noise glyphs", () => {
  const layers = [
    { id: "building", type: "fill", sourceType: "vector" },
    { id: "fo-9-fill", type: "fill", sourceType: "geojson" },
    { id: "slot-campus-detail", type: "background" },
    { id: "floor-plan-rooms", type: "fill", sourceType: "geojson" },
    { id: "floor-noise-glyph", type: "symbol", sourceType: "geojson" },
    { id: "slot-floor-plans", type: "background" },
    { id: "waterway_line_label", type: "symbol", sourceType: "vector" },
    { id: "floor-plan-labels", type: "symbol", sourceType: "geojson" },
  ];
  assert.equal(campusDetailBeforeId(layers), "waterway_line_label");
  assert.equal(floorPlanBeforeId(layers), "waterway_line_label");
});
