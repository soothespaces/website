import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAttributes } from "@/lib/data/attributes.ts";
import {
  assignRoomNoise,
  bookableRoomNumbers,
  groupByNoise,
  isServiceRoom,
  noiseBarImage,
  noiseFromLabel,
  resolvedNoise,
  withNoiseBars,
  type BookableRoomRef,
  type FloorSpace,
  type RoomPoint,
} from "./floor-noise-rooms.ts";
import { outerRing, pointInRing, ringCentroid } from "./sheet-coords.ts";

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

test("a room number beats an area, and a listed space with no location adds nothing", () => {
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
  const untagged = assignRoomNoise({
    floor: 1,
    spaces: [space({ id: "floor", name: "Open floor", floor: 1, noise: "loud" })],
    bookable: [],
    rooms,
  });
  assert.equal(untagged.size, 0);
});

test("a listed space with no locations colors nothing", () => {
  const rooms = roomsOf("public/floor-plans/harold-t-and-vivian-b-shapiro-library/2.geojson");
  const assigned = assignRoomNoise({
    floor: 2,
    spaces: [
      space({ id: "floor-2", name: "Shapiro Floor 2 Spaces", floor: 2, noise: "conversational" }),
      space({ id: "rooms", name: "Shapiro Bookable Study Rooms", bookable: true, noise: "conversational" }),
      space({ id: "booths", name: "Soundproof Booths", bookable: true, noise: "quiet" }),
    ],
    bookable: [],
    rooms,
  });
  assert.equal(assigned.size, 0);
});

test("a bookable item with no spaceId colors nothing", () => {
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
    floor: 2,
    spaces: [
      space({ id: "rooms", name: "Shapiro Bookable Study Rooms", bookable: true, noise: "conversational" }),
      space({ id: "booths", name: "Soundproof Booths", bookable: true, noise: "quiet" }),
    ],
    bookable,
    rooms,
  });
  assert.equal(assigned.size, 0);
  for (const room of ["2024", "2000", "2005", "2030M", "2036W"]) assert.equal(assigned.has(room), false, room);
  assert.deepEqual(bookableRoomNumbers(bookable, 2), STUDY);
  assert.equal(isServiceRoom("2030M"), true);
  assert.equal(isServiceRoom("2002A"), false);

  const linked = assignRoomNoise({
    floor: 2,
    spaces: [space({ id: "rooms", name: "Shapiro Bookable Study Rooms", bookable: true, noise: "quiet" })],
    bookable: [
      { roomNumber: "2122", floor: 2, spaceId: "rooms", title: "Study Room" },
      { roomNumber: "2124", floor: 2, spaceId: null, title: "2nd Floor - 2124 - Study Room" },
    ],
    rooms,
  });
  assert.equal(linked.get("2122"), "quiet");
  assert.equal(linked.has("2124"), false);
  const stamped = withNoiseBars(
    [
      { properties: { layer: "room", roomNumber: "2122" } },
      { properties: { layer: "room", roomNumber: "2124" } },
    ],
    linked,
  );
  assert.equal(stamped[0]?.properties?.noiseBars, 1);
  assert.equal(stamped[1]?.properties?.noiseBars, undefined);
  assert.deepEqual(groupByNoise(linked).quiet, ["2122"]);
});

test("noise bar images sit on a card plate", () => {
  const card = "#ffffff";
  const quiet = noiseBarImage(1, "#171717", card);
  const loud = noiseBarImage(4, "#ffffff", "#000000");
  assert.equal(quiet.width, 48);
  assert.equal(quiet.height, 48);
  const pixel = (image: { width: number; data: Uint8Array }, x: number, y: number) => {
    const index = (y * image.width + x) * 4;
    return [image.data[index], image.data[index + 1], image.data[index + 2], image.data[index + 3]];
  };
  // First bar is filled at every level. The last bar is 30% foreground on the card until loud.
  assert.deepEqual(pixel(quiet, 5, 40), [23, 23, 23, 255]);
  assert.deepEqual(pixel(quiet, 41, 20), [185, 185, 185, 255]);
  assert.deepEqual(pixel(quiet, 20, 8), [255, 255, 255, 255]);
  assert.deepEqual(pixel(loud, 5, 40), [255, 255, 255, 255]);
  assert.deepEqual(pixel(loud, 41, 20), [255, 255, 255, 255]);
  assert.deepEqual(pixel(loud, 20, 8), [0, 0, 0, 255]);
  assert.deepEqual(pixel(quiet, 0, 0), [0, 0, 0, 0]);
});
