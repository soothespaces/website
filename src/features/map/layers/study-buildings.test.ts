import assert from "node:assert/strict";
import test from "node:test";
import { notStudyCrossImage } from "./not-study-pattern.ts";
import {
  notStudyFilter,
  notStudyRecords,
  studyColorExpression,
  studyCountsByRecord,
  studyFilter,
  studyStep,
} from "./study-building-counts.ts";

test("study space counts join to the building footprint id", () => {
  const buildings = new Map([
    ["shapiro", { recordNumber: "1000227" }],
    ["nowhere", { recordNumber: null }],
  ]);
  const counts = studyCountsByRecord(
    [
      { building: { slug: "shapiro" } },
      { building: { slug: "shapiro" } },
      { building: { slug: "nowhere" } },
      { building: null },
    ],
    buildings,
  );
  assert.equal(counts.get("1000227"), 2);
  assert.equal(counts.has("nowhere"), false);
  assert.equal(counts.size, 1);
});

test("the color steps follow how many study spaces a building has", () => {
  assert.equal(studyStep(0), null);
  assert.equal(studyStep(1), "study-1");
  assert.equal(studyStep(4), "study-2");
  assert.equal(studyStep(5), "study-5");
  assert.equal(studyStep(9), "study-5");
  assert.equal(studyStep(13), "study-10");
  const expression = studyColorExpression(new Map([["1000227", 11]]), {
    "study-1": "#111111",
    "study-2": "#222222",
    "study-5": "#555555",
    "study-10": "#aaaaaa",
  });
  assert.deepEqual(expression, ["match", ["get", "loc_ObjectNum"], "1000227", "#aaaaaa", "#111111"]);
});

test("the cross is only for hospitals, parking, and athletic buildings", () => {
  const buildings = new Map([
    ["angell-hall", { recordNumber: "1", category: "Academic" }],
    ["cccb", { recordNumber: "1005451", category: "Academic" }],
    ["hospital", { recordNumber: "1000316", category: "Medical" }],
    ["garage", { recordNumber: "1000257", category: "Parking" }],
    ["stadium", { recordNumber: "1000099", category: "Athletic" }],
    ["shapiro", { recordNumber: "1000227", category: "Library/Museum" }],
  ]);
  const crossed = notStudyRecords(buildings, new Set(["1000227"]));
  assert.deepEqual(crossed.sort(), ["1000099", "1000257", "1000316"]);
});

test("parking structures on the campus map are crossed even when they are missing from the buildings table", () => {
  const filter = notStudyFilter(["1000227"], ["1000316"]);
  assert.deepEqual(filter, [
    "all",
    ["!", ["in", ["get", "Building_Type"], ["literal", ["BLDGU", "PARKU"]]]],
    ["!", ["in", ["get", "loc_ObjectNum"], ["literal", ["1000227"]]]],
    [
      "any",
      ["in", ["get", "Building_Type"], ["literal", ["PARK"]]],
      ["in", ["get", "loc_ObjectNum"], ["literal", ["1000316"]]],
    ],
  ]);
});

test("underground footprints get neither the study color nor the cross", () => {
  // FO draws underground parts as an outline: the Palmer Dr. structure runs
  // under the Undergraduate Science Building, and the Law Library's addition
  // is under the Law Quad lawn.
  const footprints = [
    { loc_ObjectNum: "1000263", Building_Type: "PARK" },
    { loc_ObjectNum: "1000263", Building_Type: "PARKU" },
    { loc_ObjectNum: "1000184", Building_Type: "BLDG" },
    { loc_ObjectNum: "1000184", Building_Type: "BLDGU" },
    { loc_ObjectNum: "1005046", Building_Type: "BLDG" },
  ];
  const matches = (filter: unknown) => footprints.filter((properties) => evaluate(filter, properties)).map((f) => `${f.loc_ObjectNum}/${f.Building_Type}`);
  assert.deepEqual(matches(studyFilter(["1000184"])), ["1000184/BLDG"]);
  assert.deepEqual(matches(notStudyFilter(["1000184"], [])), ["1000263/PARK"]);
});

// Enough of MapLibre's expression language for the filters above.
function evaluate(expression: unknown, properties: Record<string, string>): unknown {
  if (!Array.isArray(expression)) return expression;
  const [op, ...args] = expression as [string, ...unknown[]];
  switch (op) {
    case "all":
      return args.every((arg) => evaluate(arg, properties));
    case "any":
      return args.some((arg) => evaluate(arg, properties));
    case "!":
      return !evaluate(args[0], properties);
    case "get":
      return properties[args[0] as string];
    case "literal":
      return args[0];
    case "in":
      return (evaluate(args[1], properties) as unknown[]).includes(evaluate(args[0], properties));
    default:
      throw new Error(`unexpected ${op}`);
  }
}

test("the not-a-study cross is an X that repeats every period", () => {
  const { width, data } = notStudyCrossImage("#171717");
  const pixel = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  assert.equal(pixel(0, 0), 200);
  assert.equal(pixel(0, 0), pixel(16, 0));
  assert.equal(pixel(3, 0), 0);
  assert.equal(pixel(0, 0), pixel(15, 15));
});
