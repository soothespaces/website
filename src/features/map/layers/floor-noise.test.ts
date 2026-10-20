import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAttributes } from "@/lib/data/attributes.ts";
import {
  assignRoomNoise,
  bookableRoomNumbers,
  groupByNoise,
  isServiceRoom,
  noiseFromLabel,
  resolvedNoise,
  type BookableRoomRef,
  type FloorSpace,
  type RoomPoint,
} from "./floor-noise-rooms.ts";
import { outerRing, pointInRing, ringCentroid } from "./sheet-coords.ts";

const SHAPIRO = "harold-t-and-vivian-b-shapiro-library";

function space(partial: Partial<FloorSpace> & Pick<FloorSpace, "id" | "name">): FloorSpace {
  return {
    listed: true,
    floor: null,
    noise: "conversational",
    bookable: false,
    locations: [],
    ...partial,
  };
}

function roomsOf(path: string): RoomPoint[] {
  const plan = JSON.parse(readFileSync(path, "utf8")) as {
    features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
  };
  return plan.features.flatMap((feature) => {
    if (feature.properties.layer !== "room" || typeof feature.properties.roomNumber !== "string") return [];
    const ring = outerRing(feature.geometry);
    if (!ring) return [];
    const [lng, lat] = ringCentroid(ring);
    return [{ roomNumber: feature.properties.roomNumber, lng, lat }];
  });
}

const STUDY = ["2122", "2124", "2126", "2128", "2130", "2132", "2134", "2136", "2138", "2140", "2142", "2144"];

test("noise labels from the attribute resolver map back to levels", () => {
  assert.equal(noiseFromLabel("Quiet"), "quiet");
  assert.equal(noiseFromLabel("Low noise"), "low_noise");
  assert.equal(noiseFromLabel("Conversational"), "conversational");
  assert.equal(noiseFromLabel("Loud"), "loud");
  assert.equal(noiseFromLabel(null), null);
  const resolved = resolveAttributes(
    {
      noiseLevel: "quiet",
      lightLevel: null,
      features: [],
      capacity: null,
      source: "um_library",
      editedFields: ["noise_level"],
    },
    { count: 5, lastAt: null, noise: { loud: 5 }, light: {}, busyness: {}, naturalLight: 0, easeOfFocusMedian: null, features: {} },
  );
  assert.equal(resolvedNoise(
    {
      noiseLevel: "quiet",
      lightLevel: null,
      features: [],
      capacity: null,
      source: "um_library",
      editedFields: ["noise_level"],
    },
    { count: 5, lastAt: null, noise: { loud: 5 }, light: {}, busyness: {}, naturalLight: 0, easeOfFocusMedian: null, features: {} },
  ), "quiet");
  assert.equal(resolved.noise?.value, "Quiet");
});

test("a room location beats the floor guess, and an area covers the rooms inside it", () => {
  const rooms: RoomPoint[] = [
    { roomNumber: "100", lng: 0, lat: 0 },
    { roomNumber: "200", lng: 5, lat: 5 },
  ];
  const area: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const assigned = assignRoomNoise({
    building: "somewhere",
    floor: 1,
    spaces: [
      space({ id: "floor", name: "Open floor", floor: 1, noise: "loud" }),
      space({
        id: "room",
        name: "Carrel",
        noise: "quiet",
        locations: [{ floor: 1, roomNumber: "200", area: null }],
      }),
      space({
        id: "area",
        name: "Reading room",
        noise: "low_noise",
        locations: [{ floor: 1, roomNumber: null, area }],
      }),
    ],
    bookable: [],
    rooms,
  });
  assert.equal(assigned.get("100"), "low_noise");
  assert.equal(assigned.get("200"), "quiet");
  assert.equal(pointInRing(0, 0, area), true);
  assert.equal(pointInRing(5, 5, area), false);
});

test("Shapiro floor 2 colors study rooms and leaves service rooms white", () => {
  const rooms = roomsOf("public/floor-plans/harold-t-and-vivian-b-shapiro-library/2.geojson");
  const bookable: BookableRoomRef[] = [
    ...STUDY.map((roomNumber) => ({
      roomNumber,
      floor: 2,
      spaceId: null,
      title: `2nd Floor - ${roomNumber} - Study Room`,
    })),
    { roomNumber: null, floor: 1, spaceId: null, title: "1st Floor - BOOTH1 - Individual Soundproof Booth" },
  ];
  const assigned = assignRoomNoise({
    building: SHAPIRO,
    floor: 2,
    spaces: [
      space({ id: "floor-2", name: "Shapiro Floor 2 Spaces", floor: 2, noise: "conversational" }),
      space({ id: "rooms", name: "Shapiro Bookable Study Rooms", bookable: true, noise: "conversational" }),
      space({ id: "booths", name: "Soundproof Booths", bookable: true, noise: "quiet" }),
    ],
    bookable,
    rooms,
  });
  const grouped = groupByNoise(assigned);
  for (const room of STUDY) assert.equal(assigned.get(room), "conversational", room);
  for (const room of ["2024", "2026", "2166", "2178", "2178A"]) assert.equal(assigned.has(room), false, room);
  for (const room of ["2C01", "2S01", "2V01", "2030M", "2036W"]) assert.equal(assigned.has(room), false, room);
  assert.equal(assigned.get("2000"), "conversational");
  assert.ok(grouped.conversational.includes("2000"));
  assert.deepEqual(bookableRoomNumbers(bookable, 2), STUDY);
  assert.equal(isServiceRoom("2030M"), true);
  assert.equal(isServiceRoom("2002A"), false);
});

test("light noise tokens are the FloorStyle board colors", () => {
  const css = readFileSync("src/app/tokens.css", "utf8");
  assert.match(css, /--noise-quiet: #2f5a40;/);
  assert.match(css, /--noise-low: #7fa58b;/);
  assert.match(css, /--noise-conversational: #d9b45a;/);
  assert.match(css, /--noise-loud: #c8704e;/);
});
