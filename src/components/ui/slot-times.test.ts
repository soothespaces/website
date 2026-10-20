import assert from "node:assert/strict";
import test from "node:test";
import { formatClock, hourTicks, summarizeSlots } from "./slot-times.ts";

const eight = 20 * 60;

test("summarizes a mixed evening the way the rooms board reads", () => {
  assert.equal(
    summarizeSlots(eight, ["free", "free", "booked", "booked", "free", "free", "free", "free"]),
    "Free 8 to 9 PM, booked 9 to 10 PM, free after 10 PM",
  );
});

test("names a fully free or fully booked window, including across noon", () => {
  assert.equal(summarizeSlots(eight, ["free", "free", "free", "free", "free", "free", "free", "free"]), "Free 8 PM to 12 AM");
  assert.equal(summarizeSlots(eight, ["booked", "booked"]), "Booked 8 to 9 PM");
  assert.equal(summarizeSlots(11 * 60, ["free", "free", "free", "free"]), "Free 11 AM to 1 PM");
});

test("keeps a booked block at the end and half-hour edges", () => {
  assert.equal(
    summarizeSlots(eight, ["booked", "booked", "free", "free", "booked", "booked"]),
    "Booked 8 to 9 PM, free 9 to 10 PM, booked 10 to 11 PM",
  );
  assert.equal(summarizeSlots(eight + 30, ["booked"]), "Booked 8:30 to 9 PM");
});

test("does not invent a summary when the window is empty or the start is unusable", () => {
  assert.equal(summarizeSlots(eight, []), "No times in this window");
  assert.equal(summarizeSlots(Number.NaN, ["free"]), "Availability unavailable");
});

test("places hour ticks on block edges", () => {
  assert.deepEqual(hourTicks(eight, 8, 30), [eight, eight + 60, eight + 120, eight + 180, eight + 240]);
  assert.equal(formatClock(eight + 240), "12 AM");
  assert.deepEqual(hourTicks(eight + 15, 4, 30), []);
});
