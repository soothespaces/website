import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isStaffRoom, SHAPIRO_FLOOR_2_STAFF_ROOMS, STAFF_ROOM_FILTER } from "./floor-staff-rooms.ts";

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
    return isStaffRoom(feature.properties) && typeof number === "string" ? [number] : [];
  });
  assert.deepEqual(staff.sort(), [...SHAPIRO_FLOOR_2_STAFF_ROOMS].sort());
  for (const number of STUDY_ROOMS) {
    assert.equal(isStaffRoom({ layer: "room", roomNumber: number }), false, number);
  }
  assert.equal(isStaffRoom({ layer: "room", roomNumber: "2030M" }), false);
  assert.equal(isStaffRoom({ layer: "room", roomNumber: "2036W" }), false);
  assert.equal(isStaffRoom({ layer: "room", roomNumber: "2C01" }), false);
  assert.equal(isStaffRoom({ layer: "room", roomNumber: "2S01" }), false);
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
  const json = JSON.stringify(STAFF_ROOM_FILTER);
  for (const number of SHAPIRO_FLOOR_2_STAFF_ROOMS) assert.match(json, new RegExp(`"${number}"`));
  for (const use of ["staff", "office", "storage", "mechanical"]) assert.match(json, new RegExp(`"${use}"`));
  assert.match(json, /"layer"/);
});
