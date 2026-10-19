import assert from "node:assert/strict";
import test from "node:test";
import { spaceTagWords } from "./space-tags.ts";

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
    spaceTagWords(
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
    spaceTagWords({
      features: ["whiteboards", "printing", "outlets", "computers"],
    }),
    ["Computers", "Outlets", "Whiteboards", "Printer"],
  );
});

test("adds Printer once when the floor has one and the space does too", () => {
  assert.deepEqual(spaceTagWords({ features: [] }, { printerOnFloor: true }), ["Printer"]);
  assert.deepEqual(spaceTagWords({ features: ["printing"] }, { printerOnFloor: true }), ["Printer"]);
});

test("includes moderate and bright, and open rooms", () => {
  assert.deepEqual(spaceTagWords({ enclosure: "open", light_level: "moderate" }), ["Open", "Moderate"]);
  assert.deepEqual(spaceTagWords({ light_level: "bright" }), ["Bright"]);
});

test("skips missing data and anything it does not know", () => {
  assert.deepEqual(spaceTagWords({}), []);
  assert.deepEqual(spaceTagWords({ light_level: null, features: null, enclosure: null }), []);
  assert.deepEqual(
    spaceTagWords({
      light_level: "Unknown",
      enclosure: "Unknown",
      features: ["Unknown", "natural_light", "bookable"],
    }),
    [],
  );
  const line = spaceTagWords({
    light_level: "dim",
    enclosure: "nope",
    features: ["computers", "not-a-feature"],
  }).join(" ");
  assert.equal(line.includes("Unknown"), false);
  assert.deepEqual(
    spaceTagWords({
      light_level: "dim",
      enclosure: "nope",
      features: ["computers", "not-a-feature"],
    }),
    ["Dim", "Computers"],
  );
});
