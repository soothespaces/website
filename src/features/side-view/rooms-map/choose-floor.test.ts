import assert from "node:assert/strict";
import test from "node:test";
import { chooseRoomsMapFloor } from "./choose-floor.ts";
import type { MatchableRoom } from "@/features/map/layers/room-match.ts";

function room(floor: number, status: string): MatchableRoom {
  return { roomNumber: `${floor}100`, floor, slots: ["free"], status };
}

test("a focused room's floor wins, then the floor the map last showed", () => {
  const rooms = [room(1, "Free until 9 PM"), room(2, "Free until 9 PM"), room(2, "Free until 9 PM")];
  assert.equal(
    chooseRoomsMapFloor({ plans: [1, 2, 3], rooms, focusedFloor: 3, rememberedFloor: 1 }),
    3,
  );
  assert.equal(chooseRoomsMapFloor({ plans: [1, 2], rooms, focusedFloor: 4, rememberedFloor: 1 }), 1);
  assert.equal(chooseRoomsMapFloor({ plans: [], rooms, focusedFloor: 2 }), null);
});

test("without a memory, the floor with the most free rooms opens", () => {
  const rooms = [
    room(1, "Booked until 9 PM"),
    room(1, "Booked until 9 PM"),
    room(2, "Free until 10 PM"),
    room(3, "Free until 10 PM"),
    room(3, "Free until 11 PM"),
    room(3, "Booked until 8 PM"),
  ];
  assert.equal(chooseRoomsMapFloor({ plans: [1, 2, 3], rooms }), 3);
  // Floor 2 and 3 have one free room; floor 3 has more rooms, so it wins.
  assert.equal(
    chooseRoomsMapFloor({
      plans: [2, 3],
      rooms: [room(2, "Free until 9 PM"), room(3, "Free until 9 PM"), room(3, "Booked until 8 PM")],
    }),
    3,
  );
  assert.equal(chooseRoomsMapFloor({ plans: [1, 2], rooms: [] }), 1);
});
