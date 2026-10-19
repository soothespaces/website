import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMatchesLine,
  rankContextFromSettings,
  rankSpaceRecords,
  rankSpaces,
  toRankableSpace,
  type RankableSpace,
} from "./index.ts";

const SAMPLE_SPACES: RankableSpace[] = [
  {
    id: "loud-closed",
    name: "Atrium Tables",
    buildingId: "dude",
    isOpenNow: false,
    noise: "lively",
    brightness: "bright",
    setting: "open",
    distanceMeters: 100,
  },
  {
    id: "quiet-open-dim",
    name: "Reading Room",
    buildingId: "shapiro",
    isOpenNow: true,
    noise: "quiet",
    brightness: "dim",
    setting: "enclosed",
    amenities: { near_printer: true, outlets: true },
    distanceMeters: 220,
  },
  {
    id: "group-collab",
    name: "2nd Floor Collab Booths",
    buildingId: "shapiro",
    isOpenNow: true,
    noise: "moderate",
    brightness: "medium",
    setting: "open",
    maxGroupSize: "4_plus",
    bookable: true,
    distanceMeters: 220,
  },
];

test("rankSpaces never filters a space out, even when closed or mismatched", () => {
  const results = rankSpaces(SAMPLE_SPACES, {
    preferences: {
      noise: ["quiet"],
      brightness: "dim",
      niceToHave: ["near_printer"],
    },
    groupSize: "just_me",
    chips: { quiet: true, dimLighting: true },
  });

  assert.equal(results.length, SAMPLE_SPACES.length);
  assert.deepEqual(
    results.map((result) => result.space.id),
    ["quiet-open-dim", "group-collab", "loud-closed"],
  );
});

test("rankSpaces puts a bookable group space first when the group is 4+ and the bookable chip is on", () => {
  const results = rankSpaces(SAMPLE_SPACES, {
    groupSize: "4_plus",
    chips: { bookable: true },
  });

  assert.equal(results[0]?.space.id, "group-collab");
  assert.equal(results[results.length - 1]?.space.id, "loud-closed");
});

test("rankSpaces uses walking distance as a bonus and a tie-breaker", () => {
  const twinSpaces: RankableSpace[] = [
    {
      id: "far",
      name: "Far Study Lounge",
      buildingId: "north",
      isOpenNow: true,
      noise: "quiet",
      distanceMeters: 1200,
    },
    {
      id: "near",
      name: "Near Study Lounge",
      buildingId: "central",
      isOpenNow: true,
      noise: "quiet",
      distanceMeters: 90,
    },
  ];

  const results = rankSpaces(twinSpaces, {
    preferences: { noise: ["quiet"] },
  });

  assert.deepEqual(
    results.map((result) => result.space.id),
    ["near", "far"],
  );
});

test("formatMatchesLine builds the quiet, soft lighting, printer explainer", () => {
  const results = rankSpaces(SAMPLE_SPACES, {
    preferences: {
      noise: ["quiet"],
      brightness: "dim",
      niceToHave: ["near_printer"],
    },
  });

  const top = results[0];
  assert.ok(top);
  assert.equal(top.space.id, "quiet-open-dim");
  assert.equal(top.matchesLine, "Matches: quiet · soft lighting · near a printer");
});

test("formatMatchesLine caps the explainer at 3 reasons and drops duplicate keys", () => {
  const line = formatMatchesLine(["quiet", "quiet", "soft_lighting", "near_printer", "outlets"]);
  assert.equal(line, "Matches: quiet · soft lighting · near a printer");
});

test("toRankableSpace maps a spaces row and saved needs into rankSpaces", () => {
  const readingRoom = {
    id: "reading",
    slug: "reading-room",
    name: "Reading Room",
    building_slug: "shapiro",
    floor: 2,
    floor_label: "Floor 2",
    noise_level: "quiet" as const,
    light_level: "dim" as const,
    features: ["printing", "outlets", "natural_light"] as const,
    capacity: 40,
    lat: 42.2759,
    lng: -83.7372,
  };
  const atrium = {
    id: "atrium",
    slug: "atrium",
    name: "Atrium Tables",
    building_slug: "dude",
    floor: 1,
    floor_label: "Floor 1",
    noise_level: "loud" as const,
    light_level: "bright" as const,
    features: ["wheelchair_accessible"] as const,
    capacity: 20,
    lat: null,
    lng: null,
  };

  const context = rankContextFromSettings(
    {
      theme: "system",
      needs: { noise: ["quiet"], features: ["printing", "wheelchair_accessible"] },
    },
    { groupSize: "just_me" },
  );

  assert.deepEqual(context.preferences, {
    noise: ["quiet"],
    niceToHave: ["near_printer"],
  });

  const results = rankSpaceRecords([readingRoom, atrium], context, (space) => ({
    isOpenNow: space.id === "reading",
    userCoords: { latitude: 42.27587, longitude: -83.73725 },
  }));

  assert.equal(results.length, 2);
  assert.equal(results[0]?.space.id, "reading");
  assert.equal(results[0]?.space.slug, "reading-room");
  assert.equal(results[0]?.space.noise_level, "quiet");
  assert.equal(results[0]?.space.buildingId, "shapiro");
  assert.equal(results[0]?.space.noise, "quiet");
  assert.equal(results[0]?.space.brightness, "dim");
  assert.equal(results[0]?.space.daylight, "some_daylight");
  assert.equal(results[0]?.space.floor, 2);
  assert.equal(results[0]?.space.maxGroupSize, 40);
  assert.equal(results[0]?.space.amenities?.near_printer, true);
  assert.equal(results[0]?.space.amenities?.outlets, true);
  assert.equal(typeof results[0]?.space.distanceMeters, "number");
  assert.ok((results[0]?.space.distanceMeters ?? Infinity) < 50);
  assert.equal(results[0]?.matchesLine, "Matches: quiet · good for solo study · near a printer");
  assert.equal(results[0]?.space.amenities?.bookable, undefined);
  assert.equal(results[1]?.space.id, "atrium");
  assert.equal(results[1]?.space.noise, "lively");
  assert.equal(results[1]?.space.isOpenNow, false);
  assert.equal(results[1]?.space.distanceMeters, null);
});

test("toRankableSpace reads a list row's building coordinates and keeps an already rankable space", () => {
  const summary = {
    slug: "reading-room",
    name: "Reading Room",
    summary: "A quiet room",
    floor_label: "Floor 2",
    noise_level: "low_noise" as const,
    features: ["whiteboards", "bookable"] as const,
    lat: null,
    lng: null,
    building: { slug: "shapiro", name: "Shapiro Library", lat: 42.27587, lng: -83.73725 },
  };

  const adapted = toRankableSpace(summary, {
    isOpenLate: true,
    userCoords: { lat: 42.27302, lng: -83.73517 },
  });

  assert.equal(adapted.id, "reading-room");
  assert.equal(adapted.buildingId, "shapiro");
  assert.equal(adapted.floor, "Floor 2");
  assert.equal(adapted.noise, "quiet");
  assert.equal(adapted.bookable, true);
  assert.equal(adapted.amenities?.whiteboard, true);
  assert.equal(adapted.isOpenLate, true);
  assert.equal(typeof adapted.distanceMeters, "number");

  const kept = toRankableSpace(
    {
      id: "near",
      name: "Near Study Lounge",
      buildingId: "central",
      distanceMeters: 90,
    },
    { isOpenNow: true },
  );
  assert.equal(kept.distanceMeters, 90);
  assert.equal(kept.isOpenNow, true);
});
