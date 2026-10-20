import assert from "node:assert/strict";
import test from "node:test";
import { buildRoomSlots, mergeBookings, minutesFrom, statusAt, type BookableRoomInput, type ClassroomRoomInput } from "./room-slots.ts";

const from = new Date("2026-10-22T00:10:00Z");

const room: BookableRoomInput = {
  instance: "umich.libcal.com",
  libcalItemId: 27511,
  name: "2nd Floor - 2122 - Study Room",
  roomNumber: "2122",
  floor: 2,
  capacity: 5,
  bookingUrl: "https://umich.libcal.com/space/27511",
};

test("a booking that straddles a half hour marks both slots and stops at an exact boundary", () => {
  const slots = buildRoomSlots({
    from,
    bookable: [room],
    availability: {
      items: [
        {
          libcalItemId: 27511,
          booked: [{ start: "2026-10-21 20:15:00", end: "2026-10-21 20:45:00" }],
        },
      ],
    },
    classrooms: [],
  });
  assert.deepEqual(slots[0]?.slots, ["booked", "booked", "free", "free", "free", "free", "free", "free"]);
  assert.equal(slots[0]?.status, "Free until 8:15 PM");
  assert.equal(JSON.stringify(slots).includes("bookings"), false);

  const ending = buildRoomSlots({
    from,
    bookable: [room],
    availability: { items: [{ libcalItemId: 27511, booked: [{ start: "2026-10-21 19:00:00", end: "2026-10-21 20:30:00" }] }] },
    classrooms: [],
  });
  assert.deepEqual(ending[0]?.slots?.slice(0, 2), ["booked", "free"]);
  assert.equal(statusAt([{ start: minutesFrom("20:00:00", "2026-10-21")!, end: minutesFrom("21:00:00", "2026-10-21")! }], minutesFrom("20:00:00", "2026-10-21")!), "Booked until 9 PM");
  assert.equal(statusAt([], minutesFrom("20:00:00", "2026-10-21")!), "Free for the rest of the day");
});

test("LibCal failure hides slots, and a class meeting books its own room", () => {
  const classroom: ClassroomRoomInput = {
    roomCode: "UG-2122",
    roomNumber: "2122",
    floor: 2,
    capacity: 20,
    meetings: [{ starts: "20:00:00", ends: "21:00:00" }],
  };
  const down = buildRoomSlots({
    from,
    bookable: [room],
    availability: { status: "unavailable" },
    classrooms: [classroom, { ...classroom, roomCode: "UG-1400", roomNumber: "1400", meetings: [] }],
  });
  const bookable = down.find((item) => item.kind === "bookable");
  assert.equal(bookable?.slots, null);
  assert.equal(bookable?.status, "Availability unavailable");
  const other = down.find((item) => item.roomNumber === "1400");
  assert.equal(other?.kind, "classroom");
  assert.equal(other?.status, "Free for the rest of the day");
  assert.equal(other?.name, "Room 1400");

  const merged = buildRoomSlots({
    from,
    bookable: [room],
    availability: { items: [{ libcalItemId: 27511, booked: [] }] },
    classrooms: [classroom],
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.kind, "bookable");
  assert.equal(merged[0]?.status, "Booked until 9 PM");
  assert.deepEqual(merged[0]?.slots?.slice(0, 2), ["booked", "booked"]);
  assert.equal(merged[0]?.bookingUrl, room.bookingUrl);
  for (const item of merged) {
    assert.equal(/\bavailable\b/i.test(item.status), false);
  }
});

test("touching LibCal cells and a following class are one booked stretch", () => {
  const atEight = new Date("2026-10-22T00:00:00Z");
  const slots = buildRoomSlots({
    from: atEight,
    bookable: [room],
    availability: {
      items: [
        {
          libcalItemId: 27511,
          booked: [
            { start: "2026-10-21 20:00:00", end: "2026-10-21 20:30:00" },
            { start: "2026-10-21 20:30:00", end: "2026-10-21 21:00:00" },
          ],
        },
      ],
    },
    classrooms: [{ roomCode: "UG-2122", roomNumber: "2122", floor: 2, capacity: 20, meetings: [{ starts: "21:00:00", ends: "22:00:00" }] }],
  });
  assert.equal(slots[0]?.status, "Booked until 10 PM");
  assert.deepEqual(mergeBookings([
    { start: 20 * 60, end: 20 * 60 + 30 },
    { start: 20 * 60 + 30, end: 21 * 60 },
  ]), [{ start: 20 * 60, end: 21 * 60 }]);
});

test("a classroom keeps the course in session and the next course today", () => {
  const classroom: ClassroomRoomInput = {
    roomCode: "AH-1400",
    roomNumber: "1400",
    floor: 1,
    capacity: 30,
    meetings: [
      { starts: "20:00:00", ends: "21:00:00", course: "EECS 281" },
      { starts: "21:30:00", ends: "22:30:00", course: "EECS 370" },
    ],
  };
  const inClass = buildRoomSlots({
    from,
    bookable: [],
    availability: { items: [] },
    classrooms: [classroom],
  });
  assert.equal(inClass[0]?.status, "Booked until 9 PM");
  assert.equal(inClass[0]?.currentCourse, "EECS 281");
  assert.equal(inClass[0]?.nextCourse, "EECS 370");

  const after = buildRoomSlots({
    from: new Date("2026-10-22T01:10:00Z"),
    bookable: [],
    availability: { items: [] },
    classrooms: [classroom],
  });
  assert.equal(after[0]?.status, "Free until 9:30 PM");
  assert.equal(after[0]?.currentCourse, undefined);
  assert.equal(after[0]?.nextCourse, "EECS 370");
  assert.equal(JSON.stringify(after).includes("bookings"), false);
});

test("status uses the current minute, not the start of the half hour", () => {
  const at820 = new Date("2026-10-22T00:20:00Z");
  const slots = buildRoomSlots({
    from: at820,
    bookable: [room],
    availability: { items: [{ libcalItemId: 27511, booked: [{ start: "2026-10-21 20:00:00", end: "2026-10-21 20:15:00" }] }] },
    classrooms: [],
  });
  assert.equal(slots[0]?.status, "Free for the rest of the day");
  assert.equal(statusAt([{ start: 20 * 60, end: 20 * 60 + 15 }], 20 * 60 + 20), "Free for the rest of the day");
});
