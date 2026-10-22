import assert from "node:assert/strict";
import test from "node:test";
import { monthlyStats, parseHistory, type HistoryPlace } from "./my-history.ts";

const now = new Date("2026-10-21T16:00:00Z");

function place(partial: Partial<HistoryPlace> & Pick<HistoryPlace, "targetId" | "checkInCount">): HistoryPlace {
  return {
    targetKind: "space",
    lastVisitedOn: "2026-09-01",
    ...partial,
  };
}

test("without visit dates, counts are all-time and weeks are hidden", () => {
  const stats = monthlyStats(
    [
      place({ targetId: "a", checkInCount: 5, lastVisitedOn: "2026-10-02" }),
      place({ targetId: "b", checkInCount: 4, lastVisitedOn: "2026-08-01" }),
    ],
    now,
  );
  assert.equal(stats.month, "October");
  assert.equal(stats.checkIns, 9);
  assert.equal(stats.spots, 2);
  assert.equal(stats.weeksInARow, null);
  assert.equal(stats.thisMonth, false);
});

test("with visit dates, the month is counted and the streak walks back by week", () => {
  // Oct 21 2026 is a Wednesday. Weeks are Sunday-start: Oct 18, Oct 11, Oct 4.
  // Sep 20 is the week before that run, so the streak stops at three.
  const history = [
    place({
      targetId: "a",
      checkInCount: 9,
      visitedOn: ["2026-10-21", "2026-10-19", "2026-10-12", "2026-10-05", "2026-09-20"],
    }),
    place({
      targetId: "b",
      checkInCount: 1,
      visitedOn: ["2026-10-06"],
    }),
    place({ targetId: "c", checkInCount: 2, visitedOn: [] }),
  ];
  const stats = monthlyStats(history, now);
  assert.equal(stats.checkIns, 5);
  assert.equal(stats.spots, 2);
  assert.equal(stats.weeksInARow, 3);
  assert.equal(stats.thisMonth, true);

  const gap = monthlyStats(
    [place({ targetId: "a", checkInCount: 2, visitedOn: ["2026-10-21", "2026-10-04"] })],
    now,
  );
  assert.equal(gap.weeksInARow, 1);
  assert.equal(gap.checkIns, 2);
});

test("an empty current week still continues last week's streak", () => {
  // Monday Oct 19 2026, no visit yet this week (Oct 18–24), visits the two weeks before.
  const monday = new Date("2026-10-19T14:00:00Z");
  const stats = monthlyStats(
    [place({ targetId: "a", checkInCount: 2, visitedOn: ["2026-10-12", "2026-10-05"] })],
    monday,
  );
  assert.equal(stats.weeksInARow, 2);
  assert.equal(stats.checkIns, 2);
});

test("history rows parse and keep future visit dates", () => {
  const places = parseHistory([
    { target_kind: "space", target_id: "a", check_in_count: "3", last_visited_on: "2026-10-02" },
    {
      target_kind: "room",
      target_id: "b",
      check_in_count: 1,
      last_visited_on: "2026-10-01",
      visited_on: ["2026-10-01", "nope"],
    },
    { target_kind: "building", target_id: "c", check_in_count: 1, last_visited_on: "2026-10-01" },
  ]);
  assert.equal(places.length, 2);
  assert.equal(places[0]?.checkInCount, 3);
  assert.equal(places[0]?.visitedOn, undefined);
  assert.deepEqual(places[1]?.visitedOn, ["2026-10-01"]);
  assert.equal(parseHistory(null).length, 0);
});
