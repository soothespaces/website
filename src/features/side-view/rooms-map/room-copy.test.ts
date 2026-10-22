import assert from "node:assert/strict";
import test from "node:test";
import { detroitParts, formatClock } from "@/lib/detroit.ts";
import { buildRoomSlots, slotWindowStart } from "@/lib/data/room-slots.ts";
import { bookingRoomNumber, detroitSlots, roomAccessibleName, roomFooter, roomTitle, seatPhrase, windowLabel } from "./room-copy.ts";

test("room labels use the number, and the footer keeps the status", () => {
  const room = {
    name: "2nd Floor - 2124 - Study Room (Capacity 9)",
    roomNumber: "2124",
    capacity: 9,
    status: "Free until 10 PM",
  };
  assert.equal(roomTitle(room), "Room 2124");
  assert.equal(roomTitle({ name: "1st Floor - BOOTH1 - Individual Soundproof Booth", roomNumber: null }), "Booth 1");
  assert.equal(bookingRoomNumber({ name: "1st Floor - BOOTH1 - Individual Soundproof Booth", roomNumber: null }), "BOOTH1");
  assert.equal(bookingRoomNumber({ name: "Room", roomNumber: "2124" }), "2124");
  assert.equal(seatPhrase(1), "1 seat");
  assert.equal(seatPhrase(9), "9 seats");
  assert.equal(seatPhrase(null), null);
  assert.equal(roomFooter(room), "Room 2124 · 9 seats · Free until 10 PM");
  assert.equal(roomAccessibleName(room), "Room 2124, Free until 10 PM");
  assert.equal(roomFooter({ ...room, capacity: null }), "Room 2124 · Free until 10 PM");
});

function bookedLabels(from: Date, booked: { start: string; end: string }[]) {
  const rooms = buildRoomSlots({
    from,
    bookable: [
      {
        instance: "umich.libcal.com",
        libcalItemId: 1,
        name: "2nd Floor - 2124 - Study Room",
        roomNumber: "2124",
        floor: 2,
        capacity: 4,
        bookingUrl: "https://umich.libcal.com/space/1",
      },
    ],
    availability: { items: [{ libcalItemId: 1, booked }] },
    classrooms: [],
  });
  const slots = rooms[0]?.slots ?? [];
  return detroitSlots(from, slots.length)
    .filter((_, index) => slots[index] === "booked")
    .map((slot) => formatClock(detroitParts(new Date(slot.startsAt)).minutes));
}

test("slot instants follow the wall-clock half hours the room slots use", () => {
  const evening = detroitSlots(new Date("2026-10-22T00:10:00Z"), 3);
  assert.equal(evening[0]?.startsAt, "2026-10-22T00:00:00.000Z");
  assert.equal(evening[0]?.endsAt, "2026-10-22T00:30:00.000Z");
  assert.equal(evening[2]?.startsAt, "2026-10-22T01:00:00.000Z");

  // Fall back, 12:40 AM, booking 2:00–3:00. The 2:00 cells stay booked.
  assert.deepEqual(
    bookedLabels(new Date("2026-11-01T04:40:00Z"), [{ start: "2026-11-01 02:00:00", end: "2026-11-01 03:00:00" }]),
    ["2 AM", "2:30 AM"],
  );
  // Spring forward, 1:40 AM, booking 3:00–4:00. The 3:00 cells stay booked.
  assert.deepEqual(
    bookedLabels(new Date("2027-03-14T06:40:00Z"), [{ start: "2027-03-14 03:00:00", end: "2027-03-14 04:00:00" }]),
    ["3 AM", "3:30 AM"],
  );
});

test("spring forward disables the half hours the clocks skip", () => {
  // 1:10 AM EST on 2027-03-14, before the jump from 2:00 AM to 3:00 AM.
  const from = new Date("2027-03-14T06:10:00Z");
  const slots = detroitSlots(from, 8);
  const start = slotWindowStart(from);
  const labels = slots.map((_, index) => formatClock(start + index * 30));
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(slots[labels.indexOf("2 AM")]?.startsAt, null);
  assert.equal(slots[labels.indexOf("2:30 AM")]?.startsAt, null);
  const saved = slots.filter((slot) => slot.startsAt && slot.endsAt);
  assert.equal(new Set(saved.map((slot) => slot.startsAt)).size, saved.length);
  for (const slot of saved) {
    assert.ok(Date.parse(slot.endsAt!) > Date.parse(slot.startsAt!));
  }
});

test("the window label follows the time of day", () => {
  assert.equal(windowLabel(8 * 60), "Today");
  assert.equal(windowLabel(14 * 60), "This afternoon");
  assert.equal(windowLabel(20 * 60), "Tonight");
  assert.equal(windowLabel(1 * 60), "Tonight");
});
