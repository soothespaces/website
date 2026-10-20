import assert from "node:assert/strict";
import test from "node:test";
import {
  isOpenNow,
  nextClose,
  openStatus,
  resolveOpeningHours,
  weekRows,
  type OpeningHourRow,
  type OpeningHours,
} from "./opening-hours.ts";

const YEAR = { validFrom: "2026-01-01", validUntil: "2026-12-31" };

function row(partial: Partial<OpeningHourRow> & Pick<OpeningHourRow, "weekday" | "opens" | "closes">): OpeningHourRow {
  return {
    buildingSlug: "shapiro",
    spaceId: null,
    validFrom: YEAR.validFrom,
    validUntil: YEAR.validUntil,
    access: "public",
    label: null,
    source: "um_library",
    ...partial,
  };
}

function week(hours: { weekday: number; opens: string | null; closes: string | null }[], extra?: Partial<OpeningHourRow>): OpeningHourRow[] {
  return hours.map((day) => row({ ...day, ...extra }));
}

test("past-midnight close is open until 2 AM", () => {
  const hours = resolveOpeningHours(
    week([
      { weekday: 2, opens: "08:00:00", closes: "02:00:00" },
      { weekday: 3, opens: null, closes: null },
    ]),
    "2026-10-21",
  );
  // Wednesday 1:00 AM EDT, still inside Tuesday's 8 AM–2 AM interval.
  const now = new Date("2026-10-21T05:00:00Z");
  assert.equal(isOpenNow(hours, now), true);
  assert.equal(openStatus(hours, now), "Open until 2 AM");
  assert.equal(weekRows(hours).find((day) => day.weekday === 2)?.hours, "8 AM – 2 AM");
});

test("a 24-hour day reads Open 24 hours and closes when the stretch ends", () => {
  const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
    row({
      weekday,
      opens: weekday === 5 ? "00:00:00" : "00:00:00",
      closes: weekday === 5 ? "18:00:00" : "24:00:00",
    }),
  );
  const hours = resolveOpeningHours(rows, "2026-10-19");
  const mondayNoon = new Date("2026-10-19T16:00:00Z");
  assert.equal(openStatus(hours, mondayNoon), "Open 24 hours");
  assert.equal(isOpenNow(hours, mondayNoon), true);
  assert.equal(nextClose(hours, mondayNoon), "Closes Fri 6 PM");
  assert.equal(weekRows(hours)[0]?.hours, "Open 24 hours");
  assert.equal(weekRows(hours)[5]?.hours, "12 AM – 6 PM");
});

test("closed now can still open later today, or be closed for the day", () => {
  const hours = resolveOpeningHours([row({ weekday: 3, opens: "08:00:00", closes: "22:00:00" })], "2026-10-21");
  const before = new Date("2026-10-21T11:00:00Z");
  const after = new Date("2026-10-21T03:00:00Z");
  assert.equal(openStatus(hours, before), "Opens at 8 AM");
  assert.equal(isOpenNow(hours, before), false);
  assert.equal(openStatus(hours, new Date("2026-10-21T16:00:00Z")), "Open until 10 PM");
  // 11 PM EDT is 03:00 UTC the next calendar day in UTC, which is still Wednesday evening? 
  // 2026-10-22T03:00:00Z is Wednesday 11 PM EDT.
  assert.equal(openStatus(hours, new Date("2026-10-22T03:00:00Z")), "Closed today");
  assert.equal(nextClose(hours, after), null);
});

test("a space's hours replace the building's for that weekday only", () => {
  const rows: OpeningHourRow[] = [1, 3].map((weekday) => row({ weekday, opens: "08:00:00", closes: "22:00:00" }));
  rows.push(row({ spaceId: "space-1", buildingSlug: null, weekday: 1, opens: "09:00:00", closes: "17:00:00" }));
  const hours = resolveOpeningHours(rows, "2026-10-21");
  const listed = weekRows(hours);
  assert.equal(listed[1]?.hours, "9 AM – 5 PM");
  assert.equal(listed[3]?.hours, "8 AM – 10 PM");
  assert.equal(listed[0]?.day, "Sunday");
  assert.equal(listed[6]?.day, "Saturday");
  assert.equal(listed[3]?.today, true);
});

test("an expired space period falls back to the building", () => {
  const rows = [
    row({ weekday: 1, opens: "08:00:00", closes: "22:00:00" }),
    row({
      spaceId: "space-1",
      buildingSlug: null,
      weekday: 1,
      opens: "09:00:00",
      closes: "12:00:00",
      validFrom: "2026-09-01",
      validUntil: "2026-10-01",
    }),
  ];
  const hours = resolveOpeningHours(rows, "2026-10-21");
  assert.equal(weekRows(hours)[1]?.hours, "8 AM – 10 PM");
  assert.equal(resolveOpeningHours(rows, "2026-09-15") && weekRows(resolveOpeningHours(rows, "2026-09-15"))[1]?.hours, "9 AM – 12 PM");
});

test("the narrowest period wins, and a tie goes to the later start", () => {
  const rows = [
    row({ weekday: 1, opens: "08:00:00", closes: "22:00:00", validFrom: "2026-01-01", validUntil: "2026-12-31" }),
    row({ weekday: 1, opens: "10:00:00", closes: "16:00:00", validFrom: "2026-10-19", validUntil: "2026-10-25" }),
  ];
  // Oct 19 is the Monday inside the short period. The coming Monday after Oct 21 is Oct 26, outside it.
  assert.equal(weekRows(resolveOpeningHours(rows, "2026-10-19"))[1]?.hours, "10 AM – 4 PM");

  const tied = [
    row({ weekday: 1, opens: "08:00:00", closes: "17:00:00", validFrom: "2026-10-01", validUntil: "2026-10-10" }),
    row({ weekday: 1, opens: "09:00:00", closes: "18:00:00", validFrom: "2026-10-05", validUntil: "2026-10-14" }),
  ];
  assert.equal(weekRows(resolveOpeningHours(tied, "2026-10-05"))[1]?.hours, "9 AM – 6 PM");
});

test("no covering rows is null and reads as closed", () => {
  assert.equal(resolveOpeningHours([row({ weekday: 1, opens: "08:00:00", closes: "17:00:00", validUntil: "2026-01-02" })], "2026-10-21"), null);
  assert.equal(isOpenNow(null, new Date()), false);
  assert.equal(openStatus(null, new Date()), null);
  assert.equal(nextClose(null, new Date()), null);
  assert.deepEqual(weekRows(null), []);
});

test("week rows stay Sunday through Saturday for the coming week", () => {
  const hours: OpeningHours = {
    date: "2026-10-21",
    weekday: 3,
    byDate: [],
    periods: [],
  };
  assert.deepEqual(
    weekRows(hours).map((day) => day.day),
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  );
  assert.equal(weekRows(hours).find((day) => day.today)?.date, "2026-10-21");
  // Thursday's row is today; Sunday is the coming Sunday, Oct 25, not Oct 18.
  assert.equal(weekRows(hours)[0]?.date, "2026-10-25");
});

test("a period that starts mid-week does not inherit today's hours", () => {
  const semester = { validFrom: "2026-09-01", validUntil: "2026-11-24" };
  const thanksgiving = { validFrom: "2026-11-25", validUntil: "2026-11-29" };
  const rows: OpeningHourRow[] = [
    row({ ...semester, weekday: 2, opens: "00:00:00", closes: "24:00:00" }),
    row({ ...semester, weekday: 3, opens: "00:00:00", closes: "24:00:00" }),
    row({ ...semester, weekday: 4, opens: "00:00:00", closes: "24:00:00" }),
    row({ ...semester, weekday: 5, opens: "00:00:00", closes: "18:00:00" }),
    row({ ...thanksgiving, weekday: 3, opens: "10:00:00", closes: "18:00:00" }),
    row({ ...thanksgiving, weekday: 4, opens: null, closes: null }),
    row({ ...thanksgiving, weekday: 5, opens: "10:00:00", closes: "18:00:00" }),
  ];
  const hours = resolveOpeningHours(rows, "2026-11-24");
  const tuesdayNoon = new Date("2026-11-24T17:00:00Z");
  assert.equal(nextClose(hours, tuesdayNoon), "Closes Tue midnight");
  assert.equal(openStatus(hours, tuesdayNoon), "Open 24 hours");
  const listed = weekRows(hours);
  assert.equal(listed.find((day) => day.date === "2026-11-25")?.hours, "10 AM – 6 PM");
  assert.equal(listed.find((day) => day.date === "2026-11-26")?.hours, "Closed");
});

test("winter break replaces the semester on the dates it covers", () => {
  const semester = { validFrom: "2026-09-01", validUntil: "2026-12-24" };
  const winter = { validFrom: "2026-12-25", validUntil: "2027-01-04" };
  const rows: OpeningHourRow[] = [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => [
    row({
      ...semester,
      weekday,
      opens: weekday === 0 ? "10:00:00" : "00:00:00",
      closes: weekday === 5 ? "18:00:00" : "24:00:00",
    }),
    row({ ...winter, weekday, opens: null, closes: null }),
  ]);
  const hours = resolveOpeningHours(rows, "2026-12-24");
  const listed = weekRows(hours);
  assert.equal(listed.find((day) => day.date === "2026-12-25")?.hours, "Closed");
  assert.equal(listed.find((day) => day.date === "2026-12-27")?.hours, "Closed");
  assert.notEqual(listed.find((day) => day.weekday === 5)?.hours, "12 AM – 6 PM");
});

test("Sunday hours that run into a 24-hour Monday do not claim to close at midnight", () => {
  const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
    row({
      weekday,
      opens: weekday === 0 ? "10:00:00" : "00:00:00",
      closes: weekday === 5 ? "18:00:00" : "24:00:00",
      validFrom: "2026-10-01",
      validUntil: "2026-10-31",
    }),
  );
  const hours = resolveOpeningHours(rows, "2026-10-18");
  const sundayNoon = new Date("2026-10-18T16:00:00Z");
  assert.equal(openStatus(hours, sundayNoon), "Open until Fri 6 PM");
  assert.equal(nextClose(hours, sundayNoon), "Closes Fri 6 PM");
});

test("a midnight close is named for the day that is ending", () => {
  const rows = [row({ weekday: 0, opens: "10:00:00", closes: "24:00:00", validFrom: "2026-10-01", validUntil: "2026-10-31" })];
  const hours = resolveOpeningHours(rows, "2026-10-18");
  const sundayNoon = new Date("2026-10-18T16:00:00Z");
  assert.equal(nextClose(hours, sundayNoon), "Closes Sun midnight");
  assert.equal(openStatus(hours, sundayNoon), "Open until midnight");
});
