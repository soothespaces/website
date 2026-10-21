import assert from "node:assert/strict";
import test from "node:test";
import { detroitSlots, roomAccessibleName, roomFooter, roomTitle, seatPhrase, windowLabel } from "./room-copy.ts";

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

test("slots are real half hours, including across the spring-forward gap", () => {
  // 8:10 PM EDT on Oct 21. The first slot is 8:00–8:30 PM.
  const evening = detroitSlots(new Date("2026-10-22T00:10:00Z"), 3);
  assert.equal(evening[0]?.startsAt, "2026-10-22T00:00:00.000Z");
  assert.equal(evening[0]?.endsAt, "2026-10-22T00:30:00.000Z");
  assert.equal(evening[2]?.startsAt, "2026-10-22T01:00:00.000Z");

  // 1:10 AM EST on March 8, 2026. Clocks jump from 2:00 AM to 3:00 AM, so the
  // 1:30 slot ends at 3:00 AM rather than a 2:00 AM that does not exist.
  const jump = detroitSlots(new Date("2026-03-08T06:10:00Z"), 2);
  assert.equal(jump[0]?.startsAt, "2026-03-08T06:00:00.000Z");
  assert.equal(jump[0]?.endsAt, "2026-03-08T06:30:00.000Z");
  assert.equal(jump[1]?.startsAt, "2026-03-08T06:30:00.000Z");
  assert.equal(jump[1]?.endsAt, "2026-03-08T07:00:00.000Z");
});

test("the window label follows the time of day", () => {
  assert.equal(windowLabel(8 * 60), "Today");
  assert.equal(windowLabel(14 * 60), "This afternoon");
  assert.equal(windowLabel(20 * 60), "Tonight");
  assert.equal(windowLabel(1 * 60), "Tonight");
});
