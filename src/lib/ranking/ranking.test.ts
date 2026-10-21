import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SpaceSummary } from "../../features/spaces/types.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../settings/model.ts";
import type { Database } from "../../types/supabase.ts";
import {
  formatMatchesLine,
  matchesLine,
  rankSpaceRows,
  rankSpaceSummaries,
  rankSpaces,
  studyPreferencesFromSettings,
  toStudyPreferences,
  type RankableSpace,
} from "./index.ts";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];

const SAMPLE_SPACES: RankableSpace[] = [
  {
    id: "loud-closed",
    name: "Atrium Tables",
    buildingId: "dude",
    isOpenNow: false,
    noise: "loud",
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
    noise: "conversational",
    brightness: "moderate",
    setting: "open",
    maxGroupSize: "4_plus",
    bookable: true,
    distanceMeters: 220,
  },
];

describe("rankSpaces (F3.4 / SOS-114)", () => {
  it("never filters any space out, even when closed or mismatched", () => {
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

  it("prioritizes group-friendly bookable spaces when groupSize is 4_plus and bookable chip is active", () => {
    const results = rankSpaces(SAMPLE_SPACES, {
      groupSize: "4_plus",
      chips: { bookable: true },
    });

    assert.equal(results[0]?.space.id, "group-collab");
    assert.equal(results[results.length - 1]?.space.id, "loud-closed");
    assert.equal(results[0]?.matchesLine, "Matches: fits your group");
  });

  it("uses walking distance as a bonus and tie-breaker", () => {
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

  it("ranks low noise apart from quiet", () => {
    const quiet: RankableSpace = {
      id: "quiet",
      name: "Quiet Room",
      buildingId: "b",
      isOpenNow: true,
      noise: "quiet",
    };
    const low: RankableSpace = {
      id: "low",
      name: "Low Room",
      buildingId: "b",
      isOpenNow: true,
      noise: "low_noise",
    };

    const results = rankSpaces([quiet, low], { preferences: { noise: "low_noise" } });

    assert.equal(results[0]?.space.id, "low");
    assert.equal(results[0]?.matchesLine, "Matches: low noise");
    assert.ok((results[0]?.score ?? 0) > (results[1]?.score ?? 0));
    assert.equal(results[1]?.matchesLine, null);
  });
});

describe("formatMatchesLine (F3.5 / SOS-121)", () => {
  it("formats the exact 'Matches: quiet · soft lighting · near a printer' string", () => {
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

  it("caps the explainer at 3 reasons and deduplicates keys", () => {
    const line = formatMatchesLine(["quiet", "quiet", "soft_lighting", "near_printer", "outlets"]);
    assert.equal(line, "Matches: quiet · soft lighting · near a printer");
  });

  it("returns null when nothing matched", () => {
    assert.equal(formatMatchesLine([]), "");
    assert.equal(matchesLine([]), null);
    assert.equal(matchesLine(["open_now", "nearby"]), null);
  });

  it("hides the line when the user has set no preferences or chips", () => {
    const results = rankSpaces([
      {
        id: "a",
        name: "A",
        buildingId: "b",
        noise: "quiet",
        isOpenNow: true,
        brightness: "dim",
        amenities: { near_printer: true },
        distanceMeters: 40,
      },
    ]);

    assert.equal(results[0]?.matchesLine, null);
    assert.equal(results[0]?.matchedReasons.includes("quiet"), false);
    assert.equal(results[0]?.matchedReasons.includes("open_now"), false);
    assert.equal(results[0]?.matchedReasons.includes("nearby"), true);
  });

  it("orders reasons noise, lighting, daylight, setting, then nice-to-haves", () => {
    assert.equal(
      matchesLine(["near_printer", "enclosed", "soft_lighting", "quiet"]),
      "Matches: quiet · soft lighting · enclosed",
    );
  });

  it("uses the board phrases", () => {
    assert.equal(
      matchesLine(["natural_light", "near_restroom", "bright_lighting", "fits_group", "monitors", "accessible"]),
      "Matches: bright · lots of daylight · monitors",
    );
    assert.equal(
      matchesLine(["near_restroom", "fits_group", "accessible"]),
      "Matches: restroom nearby · accessible · fits your group",
    );
  });
});

describe("catalog spaces and F3.1 preferences", () => {
  const readingRoom: SpaceSummary = {
    id: "reading-room",
    slug: "reading-room",
    name: "Reading Room",
    summary: "Quiet tables",
    floor_label: "Floor 2",
    noise_level: "quiet",
    features: ["printing"],
    lat: 42.2759,
    lng: -83.7372,
    building: { slug: "shapiro", name: "Shapiro Library", lat: 42.2759, lng: -83.7372 },
  };
  const atrium: SpaceSummary = {
    id: "atrium",
    slug: "atrium",
    name: "Atrium Tables",
    summary: null,
    floor_label: "Floor 1",
    noise_level: "loud",
    features: [],
    lat: 42.28,
    lng: -83.74,
    building: { slug: "dude", name: "Dude", lat: 42.28, lng: -83.74 },
  };

  it("ranks SpaceSummary rows without dropping any", () => {
    const results = rankSpaceSummaries([atrium, readingRoom], {
      preferences: { noise: "quiet", setting: "any", brightness: "any", daylight: "any", niceToHave: [], when: [] },
    });

    assert.equal(results.length, 2);
    assert.deepEqual(
      results.map((result) => result.space.slug),
      ["reading-room", "atrium"],
    );
    assert.equal(results[0]?.space, readingRoom);
  });

  it("maps a spaces row and F3.1 study preferences into the matches line", () => {
    const match = spaceRow({
      id: "reading-room",
      slug: "reading-room",
      name: "Reading Room",
      noise_level: "quiet",
      light_level: "dim",
      features: ["printing", "wheelchair_accessible", "computers"],
      isOpenNow: true,
    });
    const closed = spaceRow({
      id: "atrium",
      slug: "atrium",
      name: "Atrium Tables",
      building_slug: "dude",
      noise_level: "loud",
      light_level: "bright",
      isOpenNow: false,
    });

    const results = rankSpaces([closed, match], {
      preferences: {
        noise: "quiet",
        setting: "any",
        brightness: "dim",
        daylight: "any",
        niceToHave: ["printer", "accessible", "monitors_or_computers"],
        when: [],
      },
    });

    assert.deepEqual(
      results.map((result) => result.space.id),
      ["reading-room", "atrium"],
    );
    assert.equal(results[0]?.matchesLine, "Matches: quiet · soft lighting · monitors");
  });

  it("lets capacity change group order and origin fill walking distance", () => {
    const origin = { latitude: 42.27587, longitude: -83.73725 };
    const booth = spaceRow({
      id: "booth",
      slug: "booth",
      name: "Booth",
      capacity: 6,
      lat: origin.latitude,
      lng: origin.longitude,
      isOpenNow: true,
    });
    const carrel = spaceRow({
      id: "carrel",
      slug: "carrel",
      name: "Carrel",
      capacity: 1,
      lat: origin.latitude + 0.01,
      lng: origin.longitude,
      isOpenNow: true,
    });

    const byGroup = rankSpaceRows([carrel, booth], { groupSize: "4_plus" });
    assert.deepEqual(
      byGroup.map((result) => result.space.id),
      ["booth", "carrel"],
    );

    const byDistance = rankSpaceRows(
      [
        { ...carrel, capacity: 4 },
        { ...booth, capacity: 4 },
      ],
      { origin },
    );
    assert.deepEqual(
      byDistance.map((result) => result.space.id),
      ["booth", "carrel"],
    );
  });

  it("reads study preferences from settings.study", () => {
    const parsed = parseSettings({
      study: {
        noise: "low_noise",
        brightness: "moderate",
        daylight: "lots",
        setting: "enclosed",
        niceToHave: ["printer", "accessible", "monitors_or_computers"],
        when: ["late_night", "mornings"],
      },
    });
    assert.deepEqual(studyPreferencesFromSettings(parsed.settings, parsed.extras), {
      noise: ["low_noise"],
      setting: "enclosed",
      brightness: "moderate",
      daylight: "bright_daylight",
      niceToHave: ["near_printer", "accessible", "external_monitors"],
      whenYouStudy: ["late_night", "morning"],
    });

    const chosen = parseSettings({ study: { noise: "conversational" } });
    assert.deepEqual(
      studyPreferencesFromSettings(chosen.settings, { study: { noise: "quiet" } }),
      { noise: ["conversational"] },
    );

    const beforeStudy: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete beforeStudy.study;
    assert.deepEqual(
      studyPreferencesFromSettings(beforeStudy, { study: { noise: "quiet" } }),
      { noise: ["quiet"] },
    );

    assert.deepEqual(toStudyPreferences({ noise: "nope", brightness: "blinding" }), {});
  });
});

function spaceRow(
  overrides: Partial<SpaceRow> & Pick<SpaceRow, "id" | "name" | "slug"> & { isOpenNow?: boolean },
): SpaceRow & { isOpenNow?: boolean } {
  return {
    building_slug: "shapiro",
    capacity: null,
    description: null,
    edited_fields: [],
    features: [],
    floor: null,
    floor_label: null,
    image_alt: null,
    image_url: null,
    is_listed: true,
    lat: null,
    light_level: null,
    lng: null,
    noise_level: null,
    source: "manual",
    source_url: null,
    summary: null,
    updated_at: "2026-01-01T00:00:00Z",
    waitz_id: null,
    ...overrides,
  };
}
