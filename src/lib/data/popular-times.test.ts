import assert from "node:assert/strict";
import test from "node:test";
import { busynessWord, popularTimesFromRows, usualFor, USUAL_BAND, type PopularTimes } from "./popular-times.ts";

function grid(fill: (weekday: number, hour: number) => number | null): PopularTimes {
  return {
    busyness: Array.from({ length: 7 }, (_, weekday) => Array.from({ length: 24 }, (_, hour) => fill(weekday, hour))),
  };
}

test("busyness words split 0–100 into quarters", () => {
  assert.equal(busynessWord(0), "Not busy");
  assert.equal(busynessWord(25), "Not busy");
  assert.equal(busynessWord(26), "A little busy");
  assert.equal(busynessWord(50), "A little busy");
  assert.equal(busynessWord(51), "Fairly busy");
  assert.equal(busynessWord(75), "Fairly busy");
  assert.equal(busynessWord(76), "Very busy");
  assert.equal(busynessWord(100), "Very busy");
  assert.equal(busynessWord(-1), null);
  assert.equal(busynessWord(101), null);
  assert.equal(busynessWord(Number.NaN), null);
});

test("usualFor names the hour, and a live reading outside the band", () => {
  // Wednesday 8 PM EDT (UTC-4 in October).
  const now = new Date("2026-10-22T00:00:00Z");
  const times = grid((weekday, hour) => (weekday === 3 && hour === 20 ? 40 : 10));
  assert.equal(usualFor(times, now), "Usual for 8 PM");
  assert.equal(usualFor(times, now, 40 + USUAL_BAND), "Usual for 8 PM");
  assert.equal(usualFor(times, now, 40 + USUAL_BAND + 1), "Busier than usual");
  assert.equal(usualFor(times, now, 40 - USUAL_BAND - 1), "Quieter than usual");
  assert.equal(usualFor(times, now, null), "Usual for 8 PM");
});

test("a building with no rows, or no row for this hour, is null", () => {
  assert.equal(popularTimesFromRows([]), null);
  assert.equal(popularTimesFromRows([{ weekday: 9, hour: 0, busyness: 10 }]), null);
  const times = popularTimesFromRows([{ weekday: 3, hour: 15, busyness: 80 }]);
  assert.equal(times?.busyness[3]?.[15], 80);
  assert.equal(times?.busyness[3]?.[20], null);
  assert.equal(usualFor(times, new Date("2026-10-22T00:00:00Z")), null);
  assert.equal(usualFor(null, new Date()), null);
  assert.equal(busynessWord(times?.busyness[3]?.[15] ?? -1), "Very busy");
});
