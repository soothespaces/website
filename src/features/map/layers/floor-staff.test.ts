import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isStaffRoom,
  SHAPIRO_FLOOR_2_STAFF_FILTER,
  SHAPIRO_FLOOR_2_STAFF_ROOMS,
  SHAPIRO_STAFF_BUILDING,
  SHAPIRO_STAFF_FLOOR,
  STAFF_ROOM_FILTER,
  staffRoomFilter,
} from "./floor-staff-rooms.ts";

const SHAPIRO_FLOOR_2 = { building: SHAPIRO_STAFF_BUILDING, floor: SHAPIRO_STAFF_FLOOR };

const STUDY_ROOMS = [
  "2000",
  "2002",
  "2002A",
  "2054",
  "2054B",
  "2054C",
  "2122",
  "2124",
  "2126",
  "2128",
  "2130",
  "2132",
  "2134",
  "2136",
  "2138",
  "2140",
  "2142",
  "2144",
  "2160",
  "2160A",
  "2160B",
  "2160C",
];

test("Shapiro floor 2 staff rooms are grey and study rooms are not", () => {
  const plan = JSON.parse(
    readFileSync("public/floor-plans/harold-t-and-vivian-b-shapiro-library/2.geojson", "utf8"),
  ) as { features: { properties: Record<string, unknown> }[] };
  const staff = plan.features.flatMap((feature) => {
    const number = feature.properties.roomNumber;
    return isStaffRoom(feature.properties, SHAPIRO_FLOOR_2) && typeof number === "string" ? [number] : [];
  });
  assert.deepEqual(staff.sort(), [...SHAPIRO_FLOOR_2_STAFF_ROOMS].sort());
  for (const number of STUDY_ROOMS) {
    assert.equal(isStaffRoom({ layer: "room", roomNumber: number }, SHAPIRO_FLOOR_2), false, number);
  }
  for (const number of ["2030M", "2036W", "2036", "2005", "2007P", "2170", "2170B", "2C01", "2S01"]) {
    assert.equal(isStaffRoom({ layer: "room", roomNumber: number }, SHAPIRO_FLOOR_2), false, number);
  }
});

test("Shapiro room numbers do not grey other floors", () => {
  const room = { layer: "room", roomNumber: "2024" };
  assert.equal(isStaffRoom(room, SHAPIRO_FLOOR_2), true);
  assert.equal(isStaffRoom(room, { building: SHAPIRO_STAFF_BUILDING, floor: 3 }), false);
  assert.equal(isStaffRoom(room, { building: "james-and-anne-duderstadt-center", floor: 2 }), false);
  assert.equal(isStaffRoom(room), false);
  assert.equal(staffRoomFilter("james-and-anne-duderstadt-center", 2), STAFF_ROOM_FILTER);
  assert.equal(staffRoomFilter(SHAPIRO_STAFF_BUILDING, 2), SHAPIRO_FLOOR_2_STAFF_FILTER);
});

test("use and roomName words mark staff, office, storage and mechanical", () => {
  assert.equal(isStaffRoom({ layer: "room", use: "mechanical" }), true);
  assert.equal(isStaffRoom({ layer: "room", use: "Office" }), true);
  assert.equal(isStaffRoom({ layer: "room", roomName: "Staff workroom" }), true);
  assert.equal(isStaffRoom({ layer: "room", roomName: "Closed storage" }), true);
  assert.equal(isStaffRoom({ layer: "room", roomName: "Shapiro Reading Room" }), false);
  assert.equal(isStaffRoom({ layer: "room", roomName: "Clark Commons Collaborative Spaces" }), false);
  assert.equal(isStaffRoom({ layer: "structure" }), false);
  assert.equal(isStaffRoom({ layer: "room", roomNumber: null }), false);
});

test("the map filter lists the same rooms and uses", () => {
  const shapiro = JSON.stringify(SHAPIRO_FLOOR_2_STAFF_FILTER);
  const other = JSON.stringify(STAFF_ROOM_FILTER);
  for (const number of SHAPIRO_FLOOR_2_STAFF_ROOMS) assert.match(shapiro, new RegExp(`"${number}"`));
  for (const number of SHAPIRO_FLOOR_2_STAFF_ROOMS) assert.doesNotMatch(other, new RegExp(`"${number}"`));
  for (const use of ["staff", "office", "storage", "mechanical"]) {
    assert.match(shapiro, new RegExp(`"${use}"`));
    assert.match(other, new RegExp(`"${use}"`));
  }
});
