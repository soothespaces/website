import { describe, expect, it } from "vitest";
import type { SpaceSummary } from "@/features/spaces/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/model";
import type { Database } from "@/types/supabase";
import {
  formatMatchesLine,
  matchesLine,
  rankSpaceRows,
  rankSpaceSummaries,
  rankSpaces,
  studyPreferencesFromSettings,
  toStudyPreferences,
  type RankableSpace,
} from "./index";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];

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

    expect(results).toHaveLength(SAMPLE_SPACES.length);
    expect(results.map((r) => r.space.id)).toEqual(["quiet-open-dim", "group-collab", "loud-closed"]);
  });

  it("prioritizes group-friendly bookable spaces when groupSize is 4_plus and bookable chip is active", () => {
    const results = rankSpaces(SAMPLE_SPACES, {
      groupSize: "4_plus",
      chips: { bookable: true },
    });

    expect(results[0]?.space.id).toBe("group-collab");
    expect(results[results.length - 1]?.space.id).toBe("loud-closed");
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

    expect(results.map((r) => r.space.id)).toEqual(["near", "far"]);
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

    const top = results[0]!;
    expect(top.space.id).toBe("quiet-open-dim");
    expect(top.matchesLine).toBe("Matches: quiet · soft lighting · near a printer");
  });

  it("caps the explainer at 3 reasons and deduplicates keys", () => {
    const line = formatMatchesLine(["quiet", "quiet", "soft_lighting", "near_printer", "outlets"]);
    expect(line).toBe("Matches: quiet · soft lighting · near a printer");
  });

  it("returns null when nothing matched", () => {
    expect(formatMatchesLine([])).toBe("");
    expect(matchesLine([])).toBeNull();
  });

  it("orders reasons noise, lighting, daylight, setting, then nice-to-haves", () => {
    expect(matchesLine(["near_printer", "enclosed", "soft_lighting", "quiet"])).toBe(
      "Matches: quiet · soft lighting · enclosed",
    );
  });
});

describe("catalog spaces and F3.1 preferences", () => {
  const readingRoom: SpaceSummary = {
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

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.space.slug)).toEqual(["reading-room", "atrium"]);
    expect(results[0]?.space).toBe(readingRoom);
  });

  it("maps a spaces row and F3.1 study preferences into the matches line", () => {
    const match = spaceRow({
      id: "reading-room",
      slug: "reading-room",
      name: "Reading Room",
      noise_level: "quiet",
      light_level: "dim",
      features: ["printing"],
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
        niceToHave: ["printer"],
        when: [],
      },
    });

    expect(results.map((result) => result.space.id)).toEqual(["reading-room", "atrium"]);
    expect(results[0]?.matchesLine).toBe("Matches: quiet · soft lighting · near a printer");
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
    expect(byGroup.map((result) => result.space.id)).toEqual(["booth", "carrel"]);

    const byDistance = rankSpaceRows(
      [
        { ...carrel, capacity: 4 },
        { ...booth, capacity: 4 },
      ],
      { origin },
    );
    expect(byDistance.map((result) => result.space.id)).toEqual(["booth", "carrel"]);
  });

  it("reads study preferences from settings extras until settings.study exists", () => {
    expect(
      studyPreferencesFromSettings(DEFAULT_SETTINGS, {
        study: {
          noise: "low_noise",
          brightness: "moderate",
          daylight: "lots",
          setting: "enclosed",
          niceToHave: ["printer", "accessible", "monitors_or_computers"],
          when: ["late_night", "mornings"],
        },
      }),
    ).toEqual({
      noise: ["quiet"],
      setting: "enclosed",
      brightness: "medium",
      daylight: "bright_daylight",
      niceToHave: ["near_printer", "external_monitors", "caen_computers"],
      whenYouStudy: ["late_night", "morning"],
    });

    expect(
      studyPreferencesFromSettings(
        { ...DEFAULT_SETTINGS, study: { noise: "conversational" } },
        { study: { noise: "quiet" } },
      ),
    ).toEqual({ noise: ["moderate"] });

    expect(toStudyPreferences({ noise: "nope", brightness: "blinding" })).toEqual({});
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
