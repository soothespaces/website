import assert from "node:assert/strict";
import test from "node:test";
import { resolveAttributes, SOURCE_LABELS, type AttributeSpace } from "./attributes.ts";
import type { CheckInSummary } from "./check-ins.ts";

function space(partial: Partial<AttributeSpace> = {}): AttributeSpace {
  return {
    noiseLevel: "loud",
    lightLevel: "bright",
    features: ["natural_light"],
    capacity: 40,
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

const cases: { name: string; space: AttributeSpace; summary: CheckInSummary | null; noise: string | null; label: string | null }[] = [
  {
    name: "admin edit wins over check-ins and the listing",
    space: space({ noiseLevel: "quiet", editedFields: ["noise_level"] }),
    summary: summary({ noise: { conversational: 6 } }),
    noise: "Quiet",
    label: SOURCE_LABELS.edited,
  },
  {
    name: "clearing a value in the editor hides it",
    space: space({ noiseLevel: null, editedFields: ["noise_level"] }),
    summary: summary({ noise: { quiet: 6 } }),
    noise: null,
    label: null,
  },
  {
    name: "three agreeing check-ins beat the listing",
    space: space(),
    summary: summary({ noise: { quiet: 3, loud: 1 } }),
    noise: "Quiet",
    label: SOURCE_LABELS.checkIns,
  },
  {
    name: "a tie, or fewer than three, falls through to the listing",
    space: space(),
    summary: summary({ noise: { quiet: 3, loud: 3 } }),
    noise: "Loud",
    label: SOURCE_LABELS.library,
  },
  {
    name: "check-ins that match the listing are confirmed",
    space: space({ noiseLevel: "quiet" }),
    summary: summary({ noise: { quiet: 4 } }),
    noise: "Quiet",
    label: SOURCE_LABELS.confirmedLibrary,
  },
  {
    name: "a manual space is not treated as a library listing",
    space: space({ source: "manual", noiseLevel: "quiet", editedFields: [] }),
    summary: null,
    noise: "Quiet",
    label: SOURCE_LABELS.edited,
  },
];

test("noise follows admin, then check-ins, then the listing", () => {
  for (const item of cases) {
    const resolved = resolveAttributes(item.space, item.summary);
    assert.equal(resolved.noise?.value ?? null, item.noise, item.name);
    assert.equal(resolved.noise?.sourceLabel ?? null, item.label, item.name);
  }
  const thin = resolveAttributes(space(), summary({ noise: { quiet: 2 } }));
  assert.equal(thin.noise?.value, "Loud");
  assert.equal(thin.noise?.sourceLabel, SOURCE_LABELS.library);
});

test("lighting can name a different source for daylight and brightness", () => {
  const resolved = resolveAttributes(
    space({ lightLevel: "bright", features: ["natural_light", "outlets"] }),
    summary({ light: { dim: 5 }, naturalLight: 1, features: { outlets: 4 } }),
  );
  assert.equal(resolved.brightness?.value, "Dim");
  assert.equal(resolved.brightness?.sourceLabel, SOURCE_LABELS.checkIns);
  assert.equal(resolved.daylight?.value, "Natural light");
  assert.equal(resolved.daylight?.sourceLabel, SOURCE_LABELS.library);
  assert.equal(resolved.lightingLabel, "Daylight: U-M Library · Brightness: check-ins");
  assert.equal(resolved.outlets?.value, "Outlets");
  assert.equal(resolved.outlets?.sourceLabel, SOURCE_LABELS.confirmedLibrary);
  assert.equal(resolved.features.computers, null);
  assert.equal(resolved.seating?.value, "40 seats");
  assert.equal(resolved.seating?.sourceLabel, SOURCE_LABELS.library);
});

test("a daylight yes-count of three counts when the listing never tagged it", () => {
  const resolved = resolveAttributes(space({ features: [] }), summary({ naturalLight: 3 }));
  assert.equal(resolved.daylight?.value, "Natural light");
  assert.equal(resolved.daylight?.sourceLabel, SOURCE_LABELS.checkIns);
  assert.equal(resolveAttributes(space({ features: [] }), summary({ naturalLight: 2 })).daylight, null);
});

test("a floor-plan outline sets the setting, and missing attributes stay null", () => {
  const resolved = resolveAttributes(space({ enclosed: true, capacity: null, lightLevel: null, features: [] }), null);
  assert.equal(resolved.setting?.value, "Enclosed");
  assert.equal(resolved.setting?.sourceLabel, SOURCE_LABELS.floorPlan);
  assert.equal(resolved.seating, null);
  assert.equal(resolved.brightness, null);
  assert.equal(resolved.daylight, null);
  assert.equal(resolved.lightingLabel, null);
  assert.equal(resolveAttributes(space({ enclosed: false }), null).setting?.value, "Open");
  assert.equal(resolveAttributes(space({ source: "mguide", noiseLevel: "quiet" }), null).noise?.sourceLabel, SOURCE_LABELS.mguide);
});
