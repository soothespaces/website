import assert from "node:assert/strict";
import test from "node:test";
import { notStudyCrossImage } from "./not-study-pattern.ts";
import { studyColorExpression, studyCountsByRecord, studyStep } from "./study-building-counts.ts";

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

test("the not-a-study cross is an X that repeats every period", () => {
  const { width, data } = notStudyCrossImage("#171717");
  const pixel = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  assert.equal(pixel(0, 0), 200);
  assert.equal(pixel(0, 0), pixel(16, 0));
  assert.equal(pixel(3, 0), 0);
  assert.equal(pixel(0, 0), pixel(15, 15));
});
