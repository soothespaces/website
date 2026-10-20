import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  featureMatches,
  fillNow,
  geometryCenter,
  matchRoomFills,
  normalizeRoomNumber,
  propertyRoomNumber,
  roomFloor,
  roomRouteId,
  sameRoom,
} from "./room-match.ts";

const SHAPIRO_STUDY = ["2122", "2124", "2126", "2128", "2130", "2132", "2134", "2136", "2138", "2140", "2142", "2144"];

test("room numbers ignore case and punctuation", () => {
  assert.equal(normalizeRoomNumber(" 2124a "), "2124A");
  assert.equal(normalizeRoomNumber("2124-A"), "2124A");
  assert.equal(normalizeRoomNumber("BOOTH"), null);
  assert.equal(normalizeRoomNumber(null), null);
  assert.equal(propertyRoomNumber(2124), "2124");
});

test("a short booking that already ended does not keep the room red", () => {
  assert.equal(fillNow({ slots: ["booked", "free"], status: "Free for the rest of the day" }), "free");
  assert.equal(fillNow({ slots: ["booked", "booked"], status: "Booked until 9:30 PM" }), "booked");
  assert.equal(fillNow({ slots: null, status: "Availability unavailable" }), null);
  assert.equal(fillNow({ slots: ["free", "free"] }), "free");
});

test("Shapiro floor 2 study rooms match the plan and take the current fill", () => {
  const plan = JSON.parse(
    readFileSync("public/floor-plans/harold-t-and-vivian-b-shapiro-library/2.geojson", "utf8"),
  ) as {
    features: { properties: { layer?: string; roomNumber?: string }; geometry: { type: string; coordinates: unknown } }[];
  };
  const onPlan = new Set(
    plan.features
      .filter((feature) => feature.properties.layer === "room")
      .map((feature) => feature.properties.roomNumber),
  );
  const rooms = SHAPIRO_STUDY.map((roomNumber) => ({
    id: `libcal:${roomNumber}`,
    roomNumber,
    floor: 2,
    slots: (roomNumber === "2124" ? ["booked", "booked"] : ["free", "free"]) as ("free" | "booked")[],
    status: roomNumber === "2124" ? "Booked until 10 PM" : "Free until 10 PM",
  }));
  const groups = matchRoomFills(
    [
      ...rooms,
      { roomNumber: "1400", floor: 1, slots: ["free"], status: "Free until 9 PM" },
      { roomNumber: "BOOTH1", floor: 1, slots: ["free"], status: "Free until 9 PM" },
      { roomNumber: "2160", floor: 2, slots: null, status: "Availability unavailable" },
    ],
    2,
  );
  assert.deepEqual(groups.booked, ["2124"]);
  assert.equal(groups.free.includes("2122"), true);
  assert.equal(groups.free.includes("2160"), false);
  assert.equal(groups.selectable.includes("2160"), true);
  assert.equal(groups.selectable.includes("1400"), false);
  for (const number of groups.selectable) assert.equal(onPlan.has(number), true, number);

  const room2124 = plan.features.find((feature) => feature.properties.roomNumber === "2124");
  const center = geometryCenter(room2124?.geometry);
  assert.ok(center);
  assert.equal(featureMatches(room2124?.properties, { kind: "number", value: "2124" }), true);
  assert.equal(featureMatches({ layer: "room", polygonId: "p-1" }, { kind: "polygon", value: "p-1" }), true);
  const ring = room2124?.geometry.type === "Polygon" ? (room2124.geometry.coordinates as number[][][])[0] : null;
  assert.ok(ring);
  const lngs = ring.map((point) => point[0]!);
  const lats = ring.map((point) => point[1]!);
  assert.ok(center[0] >= Math.min(...lngs) && center[0] <= Math.max(...lngs));
  assert.ok(center[1] >= Math.min(...lats) && center[1] <= Math.max(...lats));
});

test("floor comes from the number when the row has none", () => {
  assert.equal(roomFloor({ floor: null, roomNumber: "3140A" }), 3);
  assert.equal(roomFloor({ floor: 2, roomNumber: "100" }), 2);
  assert.equal(roomRouteId({ roomNumber: "2124", floor: 2, slots: [] }), "2124");
  assert.equal(sameRoom({ id: "libcal:1", roomNumber: "2124", floor: 2, slots: [] }, "2124"), true);
});

test("the largest ring wins the pin, not a furniture sliver", () => {
  const center = geometryCenter({
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [0.1, 0],
          [0.1, 0.1],
          [0, 0.1],
          [0, 0],
        ],
      ],
      [
        [
          [10, 10],
          [12, 10],
          [12, 14],
          [10, 14],
          [10, 10],
        ],
      ],
    ],
  });
  assert.deepEqual(center, [11, 12]);
});
