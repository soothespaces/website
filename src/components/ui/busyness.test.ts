import assert from "node:assert/strict";
import test from "node:test";
import { SHAPIRO_TUESDAY_BUSYNESS, busiestSummary, busynessAxisLabel, formatHour } from "./busyness.ts";

test("Shapiro on Tuesday is busiest around 4 PM", () => {
  assert.equal(SHAPIRO_TUESDAY_BUSYNESS.length, 24);
  assert.equal(busiestSummary(SHAPIRO_TUESDAY_BUSYNESS), "Busiest around 4 PM");
  assert.equal(SHAPIRO_TUESDAY_BUSYNESS[16], 100);
});

test("breaks a tie by the earlier hour and stays quiet when every hour is empty", () => {
  const values = Array.from({ length: 24 }, () => 0);
  values[20] = 40;
  values[14] = 40;
  assert.equal(busiestSummary(values), "Busiest around 2 PM");
  assert.equal(busiestSummary(Array.from({ length: 24 }, () => 0)), "No typical busyness");
  assert.equal(busiestSummary([]), "No typical busyness");
});

test("labels the axis every three hours", () => {
  assert.equal(busynessAxisLabel(0), "12a");
  assert.equal(busynessAxisLabel(12), "12p");
  assert.equal(busynessAxisLabel(20), null);
  assert.equal(formatHour(0), "12 AM");
  assert.equal(formatHour(20), "8 PM");
});
