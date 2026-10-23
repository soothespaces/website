import assert from "node:assert/strict";
import test from "node:test";
import { plansByBuilding } from "./floor-plan-index.ts";

const record = (sheet: string, floor: number, extra: Partial<{ usable: boolean; geojson: string | null; labeled: boolean; rooms: number }> = {}) => ({
  building: "harlan-h-hatcher-graduate-library",
  floor,
  sheet,
  usable: true,
  geojson: `/floor-plans/harlan-h-hatcher-graduate-library/${floor}.geojson`,
  labeled: false,
  ...extra,
});

test("a floor drawn on two sheets is one plan, and unusable sheets are left out", () => {
  const plans = plansByBuilding([
    record("glibs_3", 3, { labeled: true, rooms: 120 }),
    record("glibn_2", 2, { rooms: 40 }),
    record("glibs_2", 2, { labeled: true, rooms: 30 }),
    record("glibn_b", 0, { usable: false, geojson: null }),
    record("glibn_3", 3, { rooms: 50 }),
  ]).get("harlan-h-hatcher-graduate-library");
  assert.ok(plans);
  assert.deepEqual(
    plans.map((plan) => [plan.floor, plan.sheet, plan.labeled, plan.rooms]),
    [
      [2, "glibn_2", true, 70],
      [3, "glibs_3", true, 170],
    ],
  );
});
