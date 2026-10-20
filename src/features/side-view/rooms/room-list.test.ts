import assert from "node:assert/strict";
import test from "node:test";
import type { RoomSlot } from "@/lib/data/room-slots";
import {
  chooseRoomsMapFloor,
  groupRoomsByFloor,
  periodLabel,
  roomMatchesSize,
  roomSizeFromGroup,
} from "./room-list.ts";

const free = (id: string, floor: number, capacity: number | null): RoomSlot => ({
  id,
  name: id,
  roomNumber: id,
  floor,
  capacity,
  kind: "bookable",
  bookingUrl: "https://umich.libcal.com/space/1",
  slots: Array.from({ length: 8 }, () => "free" as const),
  status: "Free until 10 PM",
});

const booked = (id: string, floor: number): RoomSlot => ({
  ...free(id, floor, 4),
  slots: Array.from({ length: 8 }, () => "booked" as const),
  status: "Booked until 9 PM",
});

test("size chips default to the map group and filter by capacity", () => {
  assert.equal(roomSizeFromGroup(null), "any");
  assert.equal(roomSizeFromGroup("4_plus"), "4_plus");
  assert.equal(roomMatchesSize(1, "any"), true);
  assert.equal(roomMatchesSize(null, "any"), true);
  assert.equal(roomMatchesSize(1, "just_me"), true);
  assert.equal(roomMatchesSize(1, "2_3"), false);
  assert.equal(roomMatchesSize(3, "2_3"), true);
  assert.equal(roomMatchesSize(3, "4_plus"), false);
  assert.equal(roomMatchesSize(6, "4_plus"), true);
  assert.equal(roomMatchesSize(null, "just_me"), false);
});

test("the window label follows the time of day", () => {
  assert.equal(periodLabel(8 * 60), "Today");
  assert.equal(periodLabel(5 * 60), "Today");
  assert.equal(periodLabel(12 * 60 - 1), "Today");
  assert.equal(periodLabel(12 * 60), "This afternoon");
  assert.equal(periodLabel(16 * 60 + 59), "This afternoon");
  assert.equal(periodLabel(17 * 60), "Tonight");
  assert.equal(periodLabel(20 * 60), "Tonight");
  assert.equal(periodLabel(0), "Tonight");
  assert.equal(periodLabel(4 * 60 + 59), "Tonight");
});

test("rooms group by floor with unnamed floors last", () => {
  const groups = groupRoomsByFloor([
    free("2124", 2, 4),
    { ...free("other", 2, 2), floor: null, name: "Booth" },
    free("104", 1, 2),
  ]);
  assert.deepEqual(
    groups.map((group) => [group.label, group.rooms.map((room) => room.id)]),
    [
      ["Floor 1", ["104"]],
      ["Floor 2", ["2124"]],
      ["Other", ["other"]],
    ],
  );
});

test("the floor plan opens the floor with the most free rooms", () => {
  const rooms = [free("a", 1, 2), booked("b", 1), free("c", 2, 4), free("d", 2, 6), booked("e", 3), free("f", 4, 8)];
  assert.equal(chooseRoomsMapFloor(rooms, [1, 2, 3]), 2);
  assert.equal(chooseRoomsMapFloor([booked("b", 1), booked("e", 3), free("f", 4, 8)], [1, 3]), 1);
  assert.equal(chooseRoomsMapFloor([], [3, 1]), 1);
  assert.equal(chooseRoomsMapFloor(rooms, []), null);
  assert.equal(
    chooseRoomsMapFloor(
      [free("a", 1, 2), { ...free("down", 2, 4), slots: null, status: "Availability unavailable" }],
      [1, 2],
    ),
    1,
  );
});
