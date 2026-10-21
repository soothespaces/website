import assert from "node:assert/strict";
import test from "node:test";
import { roomAccessibleName, roomFooter, roomTitle, seatPhrase, slotRange, windowLabel } from "./room-copy.ts";

test("room labels use the number, and the footer keeps the status", () => {
  const room = {
    name: "2nd Floor - 2124 - Study Room (Capacity 9)",
    roomNumber: "2124",
    capacity: 9,
    status: "Free until 10 PM",
  };
  assert.equal(roomTitle(room), "Room 2124");
  assert.equal(roomTitle({ name: "1st Floor - BOOTH1 - Individual Soundproof Booth", roomNumber: null }), "Booth 1");
  assert.equal(seatPhrase(1), "1 seat");
  assert.equal(seatPhrase(9), "9 seats");
  assert.equal(seatPhrase(null), null);
  assert.equal(roomFooter(room), "Room 2124 · 9 seats · Free until 10 PM");
  assert.equal(roomAccessibleName(room), "Room 2124, Free until 10 PM");
  assert.equal(roomFooter({ ...room, capacity: null }), "Room 2124 · Free until 10 PM");
});

test("a tapped slot is that half hour, not the whole evening", () => {
  // 8:10 PM EDT on Oct 21. Slot 0 is 8:00–8:30 PM. Slot 2 is 9:00–9:30 PM.
  const from = new Date("2026-10-22T00:10:00Z");
  assert.deepEqual(slotRange(from, 0), {
    start: "2026-10-22T00:00:00.000Z",
    end: "2026-10-22T00:30:00.000Z",
  });
  assert.deepEqual(slotRange(from, 2), {
    start: "2026-10-22T01:00:00.000Z",
    end: "2026-10-22T01:30:00.000Z",
  });
});

test("the window label follows the time of day", () => {
  assert.equal(windowLabel(8 * 60), "Today");
  assert.equal(windowLabel(14 * 60), "This afternoon");
  assert.equal(windowLabel(20 * 60), "Tonight");
  assert.equal(windowLabel(1 * 60), "Tonight");
});
