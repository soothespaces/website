import assert from "node:assert/strict";
import test from "node:test";
import type { RoomSlot } from "@/lib/data/room-slots";
import { roomBookingLabel, roomIsBookableLink, roomStatusLine } from "./room-status.ts";

const eight = (state: "free" | "booked"): RoomSlot["slots"] => Array.from({ length: 8 }, () => state);

function room(overrides: Partial<RoomSlot> & Pick<RoomSlot, "kind" | "status">): RoomSlot {
  return {
    id: "room",
    name: "Room 2124",
    roomNumber: "2124",
    floor: 2,
    capacity: 4,
    slots: eight("free"),
    ...overrides,
  };
}

test("a free bookable room stays free, including midnight, and never says available", () => {
  const untilTen = roomStatusLine(room({ kind: "bookable", status: "Free until 10 PM", bookingUrl: "https://umich.libcal.com/space/1" }));
  assert.deepEqual(untilTen, { text: "Free until 10 PM", tone: "free" });
  const untilMidnight = roomStatusLine(room({ kind: "bookable", status: "Free until 12 AM", bookingUrl: "https://umich.libcal.com/space/1" }));
  assert.equal(untilMidnight.text, "Free until 12 AM");
  assert.equal(untilMidnight.tone, "free");
  assert.equal(/\bavailable\b/i.test(untilTen.text), false);
});

test("a booked bookable room is muted and a failed LibCal read says availability unavailable", () => {
  const booked = roomStatusLine(
    room({ kind: "bookable", status: "Booked until 9:30 PM", slots: eight("booked"), bookingUrl: "https://umich.libcal.com/space/1" }),
  );
  assert.deepEqual(booked, { text: "Booked until 9:30 PM", tone: "booked" });

  const down = roomStatusLine(
    room({ kind: "bookable", status: "Availability unavailable", slots: null, bookingUrl: "https://umich.libcal.com/space/1" }),
  );
  assert.deepEqual(down, { text: "Availability unavailable", tone: "booked" });
  assert.equal(roomIsBookableLink(room({ kind: "bookable", status: down.text, slots: null, bookingUrl: "https://umich.libcal.com/space/1" })), true);
});

test("a classroom names the next class, or says class until, and is not a link", () => {
  const upcoming = roomStatusLine(
    room({ kind: "classroom", status: "Free until 3 PM", nextCourse: "EECS 281" }),
  );
  assert.deepEqual(upcoming, { text: "Free until 3 PM, then EECS 281", tone: "free" });

  const inClass = roomStatusLine(
    room({ kind: "classroom", status: "Booked until 4 PM", slots: eight("booked"), currentCourse: "EECS 281" }),
  );
  assert.equal(inClass.text, "Class until 4 PM, EECS 281");
  assert.equal(inClass.tone, "booked");

  const unnamed = roomStatusLine(room({ kind: "classroom", status: "Booked until 4 PM", slots: eight("booked") }));
  assert.equal(unnamed.text, "Class until 4 PM");

  const rest = roomStatusLine(room({ kind: "classroom", status: "Free for the rest of the day" }));
  assert.equal(rest.text, "Free for the rest of the day");
  assert.equal(roomIsBookableLink(room({ kind: "classroom", status: rest.text })), false);
  for (const line of [upcoming.text, inClass.text, unnamed.text, rest.text]) {
    assert.equal(/\bavailable\b/i.test(line), false);
  }
});

test("the LibCal link name uses the room name", () => {
  assert.equal(roomBookingLabel("Room 2124"), "Book Room 2124 on LibCal");
  assert.equal(roomBookingLabel("Booth 1"), "Book Booth 1 on LibCal");
});

test("only an http(s) LibCal page is a link", () => {
  const bookable = room({ kind: "bookable", status: "Free until 10 PM", bookingUrl: "https://umich.libcal.com/space/1" });
  assert.equal(roomIsBookableLink(bookable), true);
  assert.equal(roomIsBookableLink({ ...bookable, bookingUrl: "http://umich.libcal.com/space/1" }), true);
  assert.equal(roomIsBookableLink({ ...bookable, bookingUrl: "javascript:alert(1)" }), false);
  assert.equal(roomIsBookableLink({ ...bookable, bookingUrl: "/space/1" }), false);
  assert.equal(roomIsBookableLink({ ...bookable, kind: "classroom", bookingUrl: "https://umich.libcal.com/space/1" }), false);
});
