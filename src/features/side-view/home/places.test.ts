import assert from "node:assert/strict";
import test from "node:test";
import { detroitParts, weekdayOfDate } from "@/lib/detroit";
import { DEFAULT_STUDY, type StudyPreferences } from "@/lib/settings/model";
import type { OpeningHours, HourInterval } from "@/lib/data/opening-hours";
import { EMPTY_SPACE_FILTERS } from "@/features/map/space-filters";
import {
  browseAllLabel,
  buildingLabel,
  describeSpace,
  hasStudyPreferences,
  hoursForSpace,
  indexHours,
  isDimLighting,
  isOpenLateTonight,
  matchesFilters,
  orderOpenNow,
  orderRecommended,
  placeMeta,
  selectedGroupSize,
  spaceIsBookable,
  spaceMeters,
  walkLabel,
  type HomeSpace,
} from "./places.ts";
import type { SpaceSummary } from "@/features/spaces";

const NOW = new Date("2026-10-20T22:00:00Z");
const TODAY = detroitParts(NOW).date;

function hours(intervals: HourInterval[], date = TODAY): OpeningHours {
  return {
    date,
    weekday: weekdayOfDate(date),
    byDate: [{ date, weekday: weekdayOfDate(date), intervals }],
  };
}

function summary(overrides: Partial<SpaceSummary> & Pick<SpaceSummary, "slug" | "name">): SpaceSummary {
  return {
    summary: null,
    floor_label: null,
    noise_level: null,
    features: [],
    lat: null,
    lng: null,
    building: null,
    source: "um_library",
    edited_fields: [],
    capacity: null,
    light_level: null,
    ...overrides,
  };
}

function place(overrides: Partial<HomeSpace> & Pick<HomeSpace, "slug" | "name">): HomeSpace {
  return {
    ...summary(overrides),
    open: false,
    openLabel: null,
    openLate: false,
    bookable: false,
    dim: false,
    ...overrides,
  };
}

test("Just me is the group size when none is stored", () => {
  assert.equal(selectedGroupSize(null), "just_me");
  assert.equal(selectedGroupSize("4_plus"), "4_plus");
});

test("browse all uses the loaded count", () => {
  assert.equal(browseAllLabel(null), "Browse all study spaces");
  assert.equal(browseAllLabel(1), "Browse all 1 study space");
  assert.equal(browseAllLabel(47), "Browse all 47 study spaces");
});

test("walk time is hidden without a distance and uses minutes otherwise", () => {
  assert.equal(walkLabel(null), null);
  assert.equal(walkLabel(Number.NaN), null);
  assert.equal(walkLabel(40), "1 min walk");
  assert.equal(walkLabel(320), "4 min walk");
  assert.equal(placeMeta(["Shapiro Library", "Open 24 hours", walkLabel(320)]), "Shapiro Library · Open 24 hours · 4 min walk");
  assert.equal(placeMeta(["Shapiro Library", null, walkLabel(null)]), "Shapiro Library");
  assert.equal(buildingLabel({ slug: "shapiro", name: "Harold T And Vivian B Shapiro Library", short_name: "Shapiro Library", lat: 1, lng: 2 }), "Shapiro Library");
  assert.equal(buildingLabel({ slug: "shapiro", name: "Shapiro Library", lat: 1, lng: 2 }), "Shapiro Library");
});

test("open late means open at 11 PM tonight or later", () => {
  const untilEleven = hours([{ opens: 8 * 60, closes: 23 * 60, access: "public" }]);
  const throughEleven = hours([{ opens: 8 * 60, closes: 23 * 60 + 1, access: "public" }]);
  const allDay = hours([{ opens: 0, closes: 1440, access: "public" }]);
  const overnight = hours([{ opens: 10 * 60, closes: 26 * 60, access: "public" }]);
  assert.equal(isOpenLateTonight(untilEleven, NOW), false);
  assert.equal(isOpenLateTonight(throughEleven, NOW), true);
  assert.equal(isOpenLateTonight(allDay, NOW), true);
  assert.equal(isOpenLateTonight(overnight, NOW), true);
  assert.equal(isOpenLateTonight(null, NOW), false);
});

test("a space's own hours override the building, including open late", () => {
  const now = new Date("2026-10-21T00:30:00Z");
  const date = detroitParts(now).date;
  const index = indexHours([
    {
      buildingSlug: "shapiro",
      spaceId: null,
      validFrom: "2026-01-01",
      validUntil: "2026-12-31",
      weekday: weekdayOfDate(date),
      opens: "08:00",
      closes: "17:00",
      access: "public",
    },
    {
      buildingSlug: "shapiro",
      spaceId: "reading",
      validFrom: "2026-01-01",
      validUntil: "2026-12-31",
      weekday: weekdayOfDate(date),
      opens: "08:00",
      closes: "24:00",
      access: "public",
    },
  ]);
  const reading = summary({
    id: "reading",
    slug: "reading",
    name: "Reading Room",
    building: { slug: "shapiro", name: "Shapiro Library", lat: null, lng: null },
  });
  const stacks = summary({
    id: "stacks",
    slug: "stacks",
    name: "Stacks",
    building: { slug: "shapiro", name: "Shapiro Library", lat: null, lng: null },
  });
  const readingHours = hoursForSpace(reading, index, now);
  const stackHours = hoursForSpace(stacks, index, now);
  assert.equal(isOpenLateTonight(readingHours, now), true);
  assert.equal(isOpenLateTonight(stackHours, now), false);
  const described = describeSpace(reading, readingHours, false, now);
  assert.equal(described.open, true);
  assert.equal(described.openLate, true);
  assert.match(described.openLabel ?? "", /^Open until /);
});

test("dim lighting follows the brightness resolver", () => {
  assert.equal(isDimLighting(summary({ slug: "a", name: "A", light_level: "dim" })), true);
  assert.equal(isDimLighting(summary({ slug: "b", name: "B", light_level: "bright" })), false);
  assert.equal(isDimLighting(summary({ slug: "c", name: "C", light_level: "dim", source: undefined })), true);
});

test("bookable is the space or its building having bookable items", () => {
  const spaces = new Set(["room"]);
  const buildings = new Set(["hatcher"]);
  assert.equal(spaceIsBookable(summary({ id: "room", slug: "room", name: "Room" }), spaces, buildings), true);
  assert.equal(
    spaceIsBookable(summary({ id: "other", slug: "other", name: "Other", building: { slug: "hatcher", name: "Hatcher", lat: null, lng: null } }), spaces, buildings),
    true,
  );
  assert.equal(
    spaceIsBookable(summary({ id: "quiet", slug: "quiet", name: "Quiet", features: ["bookable"], building: { slug: "dude", name: "Dude", lat: null, lng: null } }), spaces, buildings),
    false,
  );
});

test("each quick chip narrows, and together they combine", () => {
  const quiet = place({ slug: "quiet", name: "Quiet", noise_level: "quiet", openLate: true, dim: true, bookable: false });
  const low = place({ slug: "low", name: "Low", noise_level: "low_noise", openLate: false, dim: false, bookable: true });
  const loud = place({ slug: "loud", name: "Loud", noise_level: "loud", openLate: true, dim: true, bookable: true });
  assert.deepEqual(
    [quiet, low, loud].filter((space) => matchesFilters(space, { ...EMPTY_SPACE_FILTERS, quiet: true })).map((space) => space.slug),
    ["quiet", "low"],
  );
  assert.deepEqual(
    [quiet, low, loud].filter((space) => matchesFilters(space, { ...EMPTY_SPACE_FILTERS, openLate: true })).map((space) => space.slug),
    ["quiet", "loud"],
  );
  assert.deepEqual(
    [quiet, low, loud].filter((space) => matchesFilters(space, { ...EMPTY_SPACE_FILTERS, dimLighting: true })).map((space) => space.slug),
    ["quiet", "loud"],
  );
  assert.deepEqual(
    [quiet, low, loud].filter((space) => matchesFilters(space, { ...EMPTY_SPACE_FILTERS, bookable: true })).map((space) => space.slug),
    ["low", "loud"],
  );
  assert.deepEqual(
    [quiet, low, loud]
      .filter((space) => matchesFilters(space, { quiet: true, openLate: true, dimLighting: true, bookable: false }))
      .map((space) => space.slug),
    ["quiet"],
  );
});

test("4+ re-sorts recommended without dropping a space, and preferences change the pick", () => {
  const room = place({
    slug: "room",
    name: "Group Room",
    noise_level: "conversational",
    capacity: 8,
    open: true,
    lat: 42.27,
    lng: -83.74,
  });
  const carrel = place({
    slug: "carrel",
    name: "Carrel",
    noise_level: "quiet",
    capacity: 1,
    open: true,
    light_level: "dim",
    features: ["printing"],
    lat: 42.27,
    lng: -83.74,
  });
  const closed = place({ slug: "closed", name: "Closed", noise_level: "quiet", capacity: 6, open: false });

  const solo = orderRecommended([room, closed, carrel], { study: DEFAULT_STUDY, groupSize: "just_me", origin: null });
  assert.deepEqual(
    solo.map((pick) => pick.space.slug),
    ["carrel", "room", "closed"],
  );
  assert.equal(solo[0]?.matchesLine, null);

  const group = orderRecommended([room, closed, carrel], { study: DEFAULT_STUDY, groupSize: "4_plus", origin: null });
  assert.deepEqual(
    group.map((pick) => pick.space.slug),
    ["room", "carrel", "closed"],
  );
  assert.equal(group.length, 3);

  const loudStudy: StudyPreferences = { ...DEFAULT_STUDY, noise: "conversational" };
  assert.equal(hasStudyPreferences(loudStudy), true);
  assert.equal(hasStudyPreferences(DEFAULT_STUDY), false);
  const preferred = orderRecommended([carrel, room], { study: loudStudy, groupSize: "just_me", origin: null });
  assert.equal(preferred[0]?.space.slug, "room");
  assert.equal(preferred[0]?.matchesLine, "Matches: conversational · fits your group");

  const quietStudy: StudyPreferences = {
    ...DEFAULT_STUDY,
    noise: "quiet",
    brightness: "dim",
    niceToHave: ["printer"],
  };
  const matched = orderRecommended([room, carrel], { study: quietStudy, groupSize: "just_me", origin: null });
  assert.equal(matched[0]?.space.slug, "carrel");
  assert.equal(matched[0]?.matchesLine, "Matches: quiet · soft lighting · near a printer");
});

test("without a position, nearer spaces do not jump the line and walk time stays hidden", () => {
  const origin = { latitude: 42.2757, longitude: -83.7372 };
  const near = place({
    slug: "near",
    name: "Zebra",
    open: true,
    noise_level: "quiet",
    capacity: 1,
    lat: origin.latitude,
    lng: origin.longitude,
  });
  const far = place({
    slug: "far",
    name: "Alpha",
    open: true,
    noise_level: "quiet",
    capacity: 1,
    lat: origin.latitude + 0.02,
    lng: origin.longitude,
  });
  const byName = orderRecommended([near, far], { study: DEFAULT_STUDY, groupSize: "just_me", origin: null });
  assert.deepEqual(
    byName.map((pick) => pick.space.slug),
    ["far", "near"],
  );
  assert.equal(walkLabel(spaceMeters(near, null)), null);

  const byDistance = orderRecommended([far, near], { study: DEFAULT_STUDY, groupSize: "just_me", origin });
  assert.equal(byDistance[0]?.space.slug, "near");
  assert.equal(walkLabel(spaceMeters(near, origin)), "1 min walk");
});

test("open now lists only open spaces, by name or by distance", () => {
  const origin = { latitude: 42.27, longitude: -83.74 };
  const closed = place({ slug: "closed", name: "Alpha Closed", open: false, lat: origin.latitude, lng: origin.longitude });
  const far = place({ slug: "far", name: "Bravo", open: true, lat: origin.latitude + 0.03, lng: origin.longitude });
  const near = place({ slug: "near", name: "Zulu", open: true, lat: origin.latitude, lng: origin.longitude });
  assert.deepEqual(
    orderOpenNow([closed, near, far], null).map((space) => space.slug),
    ["far", "near"],
  );
  assert.deepEqual(
    orderOpenNow([closed, far, near], origin).map((space) => space.slug),
    ["near", "far"],
  );
});
