import assert from "node:assert/strict";
import test from "node:test";
import { spaceTags } from "./space-tags.ts";

const everyFeature = [
  "natural_light",
  "wheelchair_accessible",
  "bookable",
  "outlets",
  "whiteboards",
  "computers",
  "external_monitors",
  "printing",
  "scanners",
  "group_rooms",
  "all_gender_restroom_on_floor",
];

test("orders setting, brightness, then features, and caps at four", () => {
  assert.deepEqual(
    spaceTags(
      {
        enclosure: "enclosed",
        light_level: "dim",
        features: everyFeature,
      },
      { printerOnFloor: true },
    ),
    ["Enclosed", "Dim", "Computers", "Monitors"],
  );
});

test("keeps feature order even when the space lists them differently", () => {
  assert.deepEqual(
    spaceTags({
      features: ["whiteboards", "printing", "outlets", "computers"],
    }),
    ["Computers", "Outlets", "Whiteboards", "Printer"],
  );
});

test("adds Printer once when the floor has one and the space does too", () => {
  assert.deepEqual(spaceTags({ features: [] }, { printerOnFloor: true }), ["Printer"]);
  assert.deepEqual(spaceTags({ features: ["printing"] }, { printerOnFloor: true }), ["Printer"]);
});

test("includes moderate and bright, and open rooms", () => {
  assert.deepEqual(spaceTags({ enclosure: "open", light_level: "moderate" }), ["Open", "Moderate"]);
  assert.deepEqual(spaceTags({ light_level: "bright" }), ["Bright"]);
});

test("skips missing data and anything it does not know", () => {
  assert.deepEqual(spaceTags({}), []);
  assert.deepEqual(spaceTags({ light_level: null, features: null, enclosure: null }), []);
  assert.deepEqual(
    spaceTags({
      light_level: "Unknown",
      enclosure: "Unknown",
      features: ["Unknown", "natural_light", "bookable"],
    }),
    [],
  );
  const line = spaceTags({
    light_level: "dim",
    enclosure: "nope",
    features: ["computers", "not-a-feature"],
  }).join(" ");
  assert.equal(line.includes("Unknown"), false);
  assert.deepEqual(
    spaceTags({
      light_level: "dim",
      enclosure: "nope",
      features: ["computers", "not-a-feature"],
    }),
    ["Dim", "Computers"],
  );
});
