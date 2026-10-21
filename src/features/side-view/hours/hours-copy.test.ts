import assert from "node:assert/strict";
import test from "node:test";
import { SHAPIRO_TUESDAY_BUSYNESS } from "../../../components/ui/busyness.ts";
import { nextClose, openStatus, resolveOpeningHours, weekRows, type OpeningHourRow } from "../../../lib/data/opening-hours.ts";
import { busynessWord } from "../../../lib/data/popular-times.ts";
import { busySummary, chartValues, highlightHour } from "./busy-copy.ts";
import { hoursSourceNote, nextCloseLine, statusHeadline, weekDayLabel } from "./hours-copy.ts";

const SEMESTER = {
  label: "Fall and winter semester hours",
  validFrom: "2026-08-30",
  validUntil: "2027-05-08",
  source: "um_library",
  buildingSlug: "harold-t-and-vivian-b-shapiro-library",
  spaceId: null,
  access: "public",
};

// Shapiro's fall/winter week, from the library seed.
const SHAPIRO_HOURS: Record<number, [string, string]> = {
  0: ["10:00:00", "24:00:00"],
  1: ["00:00:00", "24:00:00"],
  2: ["00:00:00", "24:00:00"],
  3: ["00:00:00", "24:00:00"],
  4: ["00:00:00", "24:00:00"],
  5: ["00:00:00", "18:00:00"],
  6: ["10:00:00", "18:00:00"],
};

function shapiroRows(extra: OpeningHourRow[] = []): OpeningHourRow[] {
  const semester = Object.entries(SHAPIRO_HOURS).map(([weekday, [opens, closes]]) => ({
    ...SEMESTER,
    weekday: Number(weekday),
    opens,
    closes,
  }));
  return [...semester, ...extra];
}

test("Shapiro on a Tuesday matches the Hours board", () => {
  // Tuesday 20 Oct 2026, 8:00 PM Detroit (EDT).
  const now = new Date("2026-10-21T00:00:00Z");
  const hours = resolveOpeningHours(shapiroRows(), "2026-10-20");
  assert.equal(statusHeadline(openStatus(hours, now)), "Open 24 hours today");
  assert.equal(nextCloseLine(nextClose(hours, now)), "Next close: Friday 6 PM");
  assert.deepEqual(
    weekRows(hours).map((row) => [weekDayLabel(row.day, row.today), row.hours]),
    [
      ["Sunday", "10 AM – 12 AM"],
      ["Monday", "Open 24 hours"],
      ["Tuesday · today", "Open 24 hours"],
      ["Wednesday", "Open 24 hours"],
      ["Thursday", "Open 24 hours"],
      ["Friday", "12 AM – 6 PM"],
      ["Saturday", "10 AM – 6 PM"],
    ],
  );
  assert.equal(
    hoursSourceNote(hours?.periods ?? []),
    "Fall and winter semester hours, Aug 30 – May 8. From the U-M Library.",
  );
});

test("a week that crosses a break names each period, then the source", () => {
  const thanksgiving: OpeningHourRow[] = [3, 4, 5].map((weekday) => ({
    ...SEMESTER,
    label: "Thanksgiving break hours",
    validFrom: "2026-11-25",
    validUntil: "2026-11-27",
    weekday,
    opens: weekday === 3 ? "00:00:00" : null,
    closes: weekday === 3 ? "18:00:00" : null,
  }));
  const hours = resolveOpeningHours(shapiroRows(thanksgiving), "2026-11-24");
  assert.equal(
    hoursSourceNote(hours?.periods ?? []),
    "Fall and winter semester hours, Aug 30 – May 8. Thanksgiving break hours, Nov 25 – Nov 27. From the U-M Library.",
  );
});

test("Google hours omit the cache window, and a one-day range is a single date", () => {
  assert.equal(
    hoursSourceNote([
      { label: "Regular hours (Google Maps)", validFrom: "2026-10-09", validUntil: "2027-02-06", source: "google" },
    ]),
    "Regular hours (Google Maps). From Google Maps.",
  );
  assert.equal(
    hoursSourceNote([{ label: null, validFrom: "2026-08-30", validUntil: "2027-05-08", source: "um_library" }]),
    "Aug 30 – May 8. From the U-M Library.",
  );
  assert.equal(hoursSourceNote([]), null);
});

test("periods are named in date order, and a single day is not a range", () => {
  assert.equal(
    hoursSourceNote([
      { label: "Winter break hours", validFrom: "2026-12-25", validUntil: "2027-01-03", source: "um_library" },
      { label: "Fall and winter semester hours", validFrom: "2026-08-30", validUntil: "2027-05-08", source: "um_library" },
      { label: "Intersession", validFrom: "2026-12-24", validUntil: "2026-12-24", source: "um_library" },
    ]),
    "Fall and winter semester hours, Aug 30 – May 8. Intersession, Dec 24. Winter break hours, Dec 25 – Jan 3. From the U-M Library.",
  );
});

test("status lines keep the open-until wording and spell out the next close", () => {
  assert.equal(statusHeadline(null), "Hours not listed");
  assert.equal(statusHeadline("Open 24 hours"), "Open 24 hours today");
  assert.equal(statusHeadline("Open until 2 AM"), "Open until 2 AM");
  assert.equal(statusHeadline("Closed today"), "Closed today");
  assert.equal(statusHeadline("Opens at 8 AM"), "Opens at 8 AM");
  assert.equal(nextCloseLine(null), null);
  assert.equal(nextCloseLine("Closes Sun midnight"), "Next close: Sunday midnight");
  assert.equal(weekDayLabel("Friday", false), "Friday");
});

test("Tuesday at 8 PM is usually fairly busy, and busiest around 4 PM", () => {
  const day = [...SHAPIRO_TUESDAY_BUSYNESS];
  const word = busynessWord(day[20] ?? -1);
  assert.deepEqual(busySummary(day, 20, word), {
    usual: "Usually fairly busy at 8 PM.",
    peak: "Busiest around 4 PM.",
  });
  assert.equal(highlightHour(2, 2, 20), 20);
  assert.equal(highlightHour(3, 2, 20), undefined);
});

test("a missing hour drops the usual line, and a day with no rows has no chart", () => {
  const friday = Array.from({ length: 24 }, () => null as number | null);
  friday[14] = 80;
  assert.deepEqual(busySummary(friday, 20, null), { usual: null, peak: "Busiest around 2 PM." });
  assert.equal(chartValues(Array.from({ length: 24 }, () => null)), null);
  assert.deepEqual(busySummary(undefined, 20, null), { usual: null, peak: null });
});
