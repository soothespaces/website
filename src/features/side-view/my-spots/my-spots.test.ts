import assert from "node:assert/strict";
import test from "node:test";
import type { Favorite } from "@/lib/data/favorites.ts";
import type { PopularTimes } from "@/lib/data/popular-times.ts";
import type { RoomSlot } from "@/lib/data/room-slots.ts";
import { weekdayOfDate, WEEKDAY_NAMES } from "@/lib/detroit.ts";
import { lastVisitedPhrase, monthCardModel, roomsFreeNow, rotationStatusLine, usualBusyness, visitedMeta } from "./copy.ts";
import { dropIndex, moveIds, rowShift, sortRotation } from "./order.ts";
import { visitRows, type ResolvedVisit } from "./visits.ts";

const october = new Date("2026-10-21T16:00:00Z");

function favorite(partial: Partial<Favorite> & Pick<Favorite, "id" | "position">): Favorite {
  return {
    spaceId: null,
    buildingSlug: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...partial,
  };
}

test("month card uses singular labels and hides a null streak", () => {
  const full = monthCardModel({ month: "October", checkIns: 9, spots: 4, weeksInARow: 3 });
  assert.equal(full.title, "October so far");
  assert.equal(full.empty, null);
  assert.deepEqual(
    full.stats.map((stat) => stat.label),
    ["check-ins", "spots", "weeks in a row"],
  );

  const one = monthCardModel({ month: "October", checkIns: 1, spots: 1, weeksInARow: 1 });
  assert.deepEqual(
    one.stats.map((stat) => `${stat.value} ${stat.label}`),
    ["1 check-in", "1 spot", "1 week in a row"],
  );

  const hidden = monthCardModel({ month: "October", checkIns: 2, spots: 1, weeksInARow: null });
  assert.equal(hidden.stats.length, 2);

  const none = monthCardModel({ month: "October", checkIns: 0, spots: 0, weeksInARow: null });
  assert.equal(none.empty, "No check-ins yet this month.");
  assert.deepEqual(none.stats, []);

  const zeroStreak = monthCardModel({ month: "October", checkIns: 2, spots: 1, weeksInARow: 0 });
  assert.equal(zeroStreak.stats[2]?.label, "weeks in a row");
  assert.equal(zeroStreak.stats[2]?.value, 0);
});

test("rotation status matches the board's phrases and drops a missing second clause", () => {
  assert.equal(
    rotationStatusLine({ openStatus: "Open until 11 PM", busyness: "usually quiet", roomsFree: null }),
    "Closes 11 PM · usually quiet",
  );
  assert.equal(
    rotationStatusLine({ openStatus: "Open 24 hours", busyness: "usually busy", roomsFree: null }),
    "Open 24 hours · usually busy",
  );
  assert.equal(
    rotationStatusLine({ openStatus: "Open until 11 PM", busyness: "usually busy", roomsFree: 4 }),
    "Closes 11 PM · 4 rooms free now",
  );
  assert.equal(
    rotationStatusLine({ openStatus: "Open until 11 PM", busyness: "usually busy", roomsFree: 1 }),
    "Closes 11 PM · 1 room free now",
  );
  assert.equal(
    rotationStatusLine({ openStatus: "Opens at 8 AM", busyness: "usually quiet", roomsFree: 3 }),
    "Closed now · opens 8 AM",
  );
  assert.equal(rotationStatusLine({ openStatus: "Closed today", busyness: null, roomsFree: null }), "Closed now");
  assert.equal(rotationStatusLine({ openStatus: "Open until Fri 6 PM", busyness: null, roomsFree: null }), "Closes Fri 6 PM");
  assert.equal(rotationStatusLine({ openStatus: null, busyness: "usually quiet", roomsFree: null }), "usually quiet");
});

test("usual busyness splits the four words into quiet and busy", () => {
  const times: PopularTimes = { busyness: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 10)) };
  // 16:00Z on Oct 21 2026 is noon in Detroit (EDT, UTC-4).
  assert.equal(usualBusyness(times, october), "usually quiet");
  times.busyness[3]![12] = 80;
  assert.equal(usualBusyness(times, october), "usually busy");
  times.busyness[3]![12] = null;
  assert.equal(usualBusyness(times, october), null);
});

test("rooms free now counts bookable rooms and ignores a missing feed", () => {
  const room = (partial: Partial<RoomSlot>): RoomSlot => ({
    id: "1",
    name: "Room",
    roomNumber: "1",
    floor: 1,
    capacity: 4,
    kind: "bookable",
    slots: ["free", "free", "free", "free", "free", "free", "free", "free"],
    status: "Free until 3 PM",
    ...partial,
  });
  assert.equal(roomsFreeNow([room({}), room({ id: "2", status: "Booked until 1 PM" })]), 1);
  assert.equal(roomsFreeNow([room({ kind: "classroom" })]), null);
  assert.equal(roomsFreeNow([room({ slots: null, status: "Availability unavailable" })]), null);
});

test("last visited phrases walk today, yesterday, a weekday, last week, then the month", () => {
  assert.equal(lastVisitedPhrase("2026-10-21", october), "today");
  assert.equal(lastVisitedPhrase("2026-10-22", october), "today");
  assert.equal(lastVisitedPhrase("2026-10-20", october), "yesterday");
  const within = "2026-10-15";
  assert.equal(lastVisitedPhrase(within, october), `last ${WEEKDAY_NAMES[weekdayOfDate(within)]}`);
  assert.equal(lastVisitedPhrase("2026-10-14", october), "last week");
  assert.equal(lastVisitedPhrase("2026-09-02", october), "in September");
  assert.equal(visitedMeta("Shapiro Library", 1, "last Tuesday"), "Shapiro Library · 1 check-in · last Tuesday");
  assert.equal(visitedMeta("Shapiro Library", 4, "last week"), "Shapiro Library · 4 check-ins · last week");
});

test("best now keeps closed spots last and my order follows position", () => {
  const items = [
    {
      favorite: favorite({ id: 1, position: 2, spaceId: "quiet-closed" }),
      closed: true,
      catalog: { id: "quiet-closed", name: "Quiet closed", noise: "quiet" as const, isOpenNow: true },
    },
    {
      favorite: favorite({ id: 2, position: 0, spaceId: "open" }),
      closed: false,
      catalog: { id: "open", name: "Open room", isOpenNow: false },
    },
    {
      favorite: favorite({ id: 3, position: 1, spaceId: "later" }),
      closed: false,
      catalog: { id: "later", name: "Later", isOpenNow: true },
    },
  ];
  const best = sortRotation(items, "best", { preferences: { noise: ["quiet"] } });
  assert.deepEqual(
    best.map((item) => item.catalog.id),
    ["later", "open", "quiet-closed"],
  );
  const mine = sortRotation(items, "mine");
  assert.deepEqual(
    mine.map((item) => item.favorite.id),
    [2, 3, 1],
  );
});

test("drag math moves an id and shifts the rows it passes", () => {
  assert.deepEqual(moveIds([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]);
  assert.deepEqual(moveIds([1, 2, 3, 4], 3, 1), [1, 4, 2, 3]);
  assert.equal(moveIds([1, 2], 0, 0), null);
  assert.equal(moveIds([1], 0, 1), null);

  const heights = [10, 20, 30];
  assert.equal(rowShift(0, 0, 2, heights), 50);
  assert.equal(rowShift(1, 0, 2, heights), -10);
  assert.equal(rowShift(2, 0, 2, heights), -10);
  assert.equal(rowShift(2, 2, 0, heights), -30);
  assert.equal(rowShift(0, 2, 0, heights), 30);
  assert.equal(dropIndex([10, 30, 60], 31), 1);
  assert.equal(dropIndex([10, 30, 60], 5), 0);
});

test("visited rows skip favorites, keep the busiest duplicate, and describe the last visit", () => {
  const visits: ResolvedVisit[] = [
    {
      key: "room",
      name: "Floor 2 Spaces",
      buildingName: "Shapiro Library",
      checkInCount: 2,
      lastVisitedOn: "2026-10-14",
      target: { kind: "space", spaceId: "floor-2" },
    },
    {
      key: "space",
      name: "Bert's Study Lounge",
      buildingName: "Shapiro Library",
      checkInCount: 4,
      lastVisitedOn: "2026-10-20",
      target: { kind: "space", spaceId: "berts" },
    },
    {
      key: "again",
      name: "Bert's other door",
      buildingName: "Shapiro Library",
      checkInCount: 1,
      lastVisitedOn: "2026-10-01",
      target: { kind: "space", spaceId: "berts" },
    },
    {
      key: "saved",
      name: "Reading Room",
      buildingName: "Shapiro Library",
      checkInCount: 9,
      lastVisitedOn: "2026-10-21",
      target: { kind: "space", spaceId: "reading" },
    },
  ];
  const rows = visitRows(visits, [favorite({ id: 1, position: 0, spaceId: "reading" })], october);
  assert.deepEqual(
    rows.map((row) => row.name),
    ["Bert's Study Lounge", "Floor 2 Spaces"],
  );
  assert.equal(rows[0]?.meta, "Shapiro Library · 4 check-ins · yesterday");
  assert.equal(rows[1]?.meta, "Shapiro Library · 2 check-ins · last week");
});
