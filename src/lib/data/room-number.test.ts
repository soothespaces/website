import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoomNumber, sameRoomNumber } from "./room-number.ts";

test("room numbers ignore a leading Room and case", () => {
  assert.equal(normalizeRoomNumber("  Room 2124 "), "2124");
  assert.equal(normalizeRoomNumber("room  2124"), "2124");
  assert.equal(normalizeRoomNumber("2124"), "2124");
  assert.equal(normalizeRoomNumber("  "), null);
  assert.equal(normalizeRoomNumber(null), null);
  assert.equal(sameRoomNumber("2124", "Room 2124"), true);
  assert.equal(sameRoomNumber("2124", "2125"), false);
  assert.equal(sameRoomNumber(null, null), false);
});
