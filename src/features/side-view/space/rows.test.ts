import assert from "node:assert/strict";
import test from "node:test";
import { SOURCE_LABELS, type AttributeSpace } from "@/lib/data/attributes.ts";
import type { CheckInSummary } from "@/lib/data/check-ins.ts";
import { countPrintersOnFloors, whatItsLikeRows, type LikeRow } from "./rows.ts";

function space(partial: Partial<AttributeSpace> = {}): AttributeSpace {
  return {
    noiseLevel: "quiet",
    lightLevel: null,
    features: ["natural_light", "wheelchair_accessible", "all_gender_restroom_on_floor"],
    capacity: null,
    source: "um_library",
    editedFields: [],
    ...partial,
  };
}

function summary(partial: Partial<CheckInSummary> = {}): CheckInSummary {
  return {
    count: 8,
    lastAt: null,
    noise: {},
    light: {},
    busyness: {},
    naturalLight: 0,
    easeOfFocusMedian: null,
    features: {},
    ...partial,
  };
}

function ids(rows: LikeRow[]) {
  return rows.map((row) => row.id);
}

test("shapiro-like data shows the light row and nothing unknown", () => {
  const rows = whatItsLikeRows({ attributes: space(), summary: null, printersOnFloors: 0, restroomOnFloor: false });
  assert.deepEqual(ids(rows), ["light"]);
  assert.equal(rows[0]?.value, "Natural light");
  assert.equal(rows[0]?.source, SOURCE_LABELS.library);
  for (const row of rows) {
    assert.doesNotMatch(row.value, /unknown/i);
    assert.doesNotMatch(row.source, /unknown/i);
  }
});

test("setting is seating text until open versus enclosed exists", () => {
  const seatsOnly = whatItsLikeRows({
    attributes: space({ capacity: 40, features: [] }),
    summary: null,
    printersOnFloors: 0,
    restroomOnFloor: false,
  });
  assert.deepEqual(ids(seatsOnly), ["setting"]);
  assert.equal(seatsOnly[0]?.value, "40 seats");
  assert.equal(seatsOnly[0]?.source, SOURCE_LABELS.library);

  const both = whatItsLikeRows({
    attributes: space({ capacity: 40, features: [], enclosed: false }),
    summary: null,
    printersOnFloors: 0,
    restroomOnFloor: false,
  });
  assert.deepEqual(ids(both), ["setting", "seating"]);
  assert.equal(both[0]?.value, "Open room");
  assert.equal(both[0]?.source, SOURCE_LABELS.floorPlan);
  assert.equal(both[1]?.value, "40 seats");
});

test("light names each source when daylight and brightness differ", () => {
  const rows = whatItsLikeRows({
    attributes: space({ lightLevel: "bright", features: ["natural_light"] }),
    summary: summary({ light: { dim: 5 }, naturalLight: 1 }),
    printersOnFloors: null,
    restroomOnFloor: false,
  });
  const light = rows.find((row) => row.id === "light");
  assert.equal(light?.value, "Dim lighting, natural light");
  assert.equal(light?.source, "Daylight: U-M Library · Brightness: check-ins");
  assert.equal(ids(rows).includes("entrance"), false);
});

test("nearby is the printer until restroom points exist", () => {
  const printer = whatItsLikeRows({
    attributes: space({ features: [] }),
    summary: null,
    printersOnFloors: 2,
    restroomOnFloor: false,
  });
  assert.deepEqual(ids(printer), ["nearby"]);
  assert.equal(printer[0]?.value, "Printer on this floor");
  assert.equal(printer[0]?.source, SOURCE_LABELS.floorPlan);

  const both = whatItsLikeRows({
    attributes: space({ features: ["printing", "all_gender_restroom_on_floor"] }),
    summary: null,
    printersOnFloors: 1,
    restroomOnFloor: true,
  });
  assert.equal(both.find((row) => row.id === "nearby")?.value, "Printer and restroom on this floor");
  assert.equal(both.find((row) => row.id === "nearby")?.source, SOURCE_LABELS.library);

  const none = whatItsLikeRows({
    attributes: space({ features: [] }),
    summary: null,
    printersOnFloors: 0,
    restroomOnFloor: false,
  });
  assert.equal(none.some((row) => row.id === "nearby"), false);
  assert.equal(none.some((row) => row.id === "entrance"), false);
});

test("power uses the outlets attribute and hides when it is missing", () => {
  const rows = whatItsLikeRows({
    attributes: space({ features: [] }),
    summary: summary({ features: { outlets: 4 } }),
    printersOnFloors: 0,
    restroomOnFloor: false,
  });
  const power = rows.find((row) => row.id === "power");
  assert.equal(power?.value, "Outlets");
  assert.equal(power?.source, SOURCE_LABELS.checkIns);
  assert.equal(
    whatItsLikeRows({ attributes: space({ features: [] }), summary: null, printersOnFloors: 0, restroomOnFloor: false }).some(
      (row) => row.id === "power",
    ),
    false,
  );
});

test("printers count only the floors this space is on", () => {
  const printers = [{ floor: 2 }, { floor: 2 }, { floor: 1 }, { floor: null }];
  assert.equal(countPrintersOnFloors(printers, [2]), 2);
  assert.equal(countPrintersOnFloors(printers, [1, 2]), 3);
  assert.equal(countPrintersOnFloors(printers, []), 0);
});
