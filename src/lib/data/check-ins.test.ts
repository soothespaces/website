import assert from "node:assert/strict";
import test from "node:test";
import { overviewMap, parseCheckInSummary, parseOverviewRow, presentSummary } from "./check-ins.ts";

const sample = {
  count: 2,
  last_at: "2026-10-08T18:45:00+00:00",
  noise: { quiet: 2 },
  light: {},
  busyness: { half_full: 1 },
  natural_light: 0,
  ease_of_focus_median: 2,
  features: { outlets: 1, natural_light: 1 },
};

test("parses the summary jsonb and drops unknown answers", () => {
  const parsed = parseCheckInSummary({
    ...sample,
    noise: { quiet: 2, shouting: 4, loud: "1" },
    light: { dim: -1, bright: 3 },
    features: { outlets: 1, wifi: 9 },
    last_at: null,
  });
  assert.equal(parsed?.count, 2);
  assert.equal(parsed?.lastAt, null);
  assert.deepEqual(parsed?.noise, { quiet: 2, loud: 1 });
  assert.deepEqual(parsed?.light, { bright: 3 });
  assert.deepEqual(parsed?.busyness, { half_full: 1 });
  assert.equal(parsed?.naturalLight, 0);
  assert.equal(parsed?.easeOfFocusMedian, 2);
  assert.deepEqual(parsed?.features, { outlets: 1 });
});

test("a summary with no check-ins is null, and junk is null", () => {
  assert.equal(presentSummary(parseCheckInSummary({ ...sample, count: 0 })), null);
  assert.ok(presentSummary(parseCheckInSummary(sample)));
  assert.equal(parseCheckInSummary(null), null);
  assert.equal(parseCheckInSummary([]), null);
  assert.equal(parseCheckInSummary({ noise: {} }), null);
});

test("overview rows become a map keyed by target", () => {
  const byId = overviewMap([
    {
      target_id: "space-1",
      check_in_count: 3,
      last_at: "2026-10-08T18:45:00+00:00",
      typical_noise: "quiet",
      typical_light: "dim",
      ease_of_focus_median: 4,
    },
    { target_id: "space-2", check_in_count: 0, typical_noise: "loud", typical_light: null, ease_of_focus_median: null, last_at: null },
    { target_id: "space-1", check_in_count: "5", typical_noise: "nope", typical_light: "bright", ease_of_focus_median: null, last_at: null },
    { nope: true },
  ]);
  assert.equal(byId.size, 1);
  assert.equal(byId.get("space-1")?.checkInCount, 5);
  assert.equal(byId.get("space-1")?.typicalNoise, null);
  assert.equal(byId.get("space-1")?.typicalLight, "bright");
  assert.equal(parseOverviewRow(null), null);
  assert.equal(overviewMap(null).size, 0);
});
