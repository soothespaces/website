import assert from "node:assert/strict";
import test from "node:test";
import { filterSpaces } from "./space-filters.ts";
import {
  groupSpacesByFloor,
  hasStudyPreferences,
  rankWithinFloors,
  spacesSortCaption,
  spacesTitle,
  UNLISTED_FLOOR,
  withFloorNotes,
  type FloorGroup,
} from "./space-floors.ts";
import type { ListedSpace } from "./listed-space.ts";

function space(partial: Pick<ListedSpace, "name" | "floor" | "floor_label"> & Partial<ListedSpace>): ListedSpace {
  return {
    id: partial.id ?? partial.name,
    slug: partial.slug ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    name: partial.name,
    summary: partial.summary ?? null,
    floor: partial.floor,
    floor_label: partial.floor_label,
    noise_level: partial.noise_level ?? null,
    light_level: partial.light_level ?? null,
    features: partial.features ?? [],
    capacity: partial.capacity ?? null,
    source: partial.source ?? null,
    edited_fields: partial.edited_fields ?? [],
    lat: null,
    lng: null,
    imageUrl: null,
    imageAlt: null,
    building_slug: "harold-t-and-vivian-b-shapiro-library",
    building: null,
  };
}

function titles(groups: readonly FloorGroup<ListedSpace>[]) {
  return groups.map((group) => group.title);
}

test("groups floors in building order and leaves unknown floors last", () => {
  const groups = groupSpacesByFloor([
    space({ name: "Somewhere", floor: null, floor_label: null }),
    space({ name: "Fourth", floor: 4, floor_label: null }),
    space({ name: "Lobby", floor: 1, floor_label: "1st Floor" }),
    space({ name: "Stacks", floor: null, floor_label: "Floor 2" }),
    space({ name: "Lab", floor: 0, floor_label: "Basement" }),
    space({ name: "Also missing", floor: null, floor_label: "Floors 3 and 4" }),
    space({ name: "Codes", floor: null, floor_label: "01" }),
  ]);
  assert.deepEqual(titles(groups), ["Basement", "Floor 1", "Floor 2", "Floor 4", UNLISTED_FLOOR]);
  assert.deepEqual(
    groups.find((group) => group.title === "Floor 1")?.spaces.map((item) => item.name),
    ["Lobby", "Codes"],
  );
  assert.deepEqual(
    groups.find((group) => group.unlisted)?.spaces.map((item) => item.name),
    ["Somewhere", "Also missing"],
  );
  assert.equal(groups.at(-1)?.key, "unlisted");
});

test("floor notes use bookable rooms, check-ins, entrances and CAEN, and skip the rest", () => {
  const basement = space({
    name: "Shapiro Basement Spaces",
    summary: "Movable tables, plus a CAEN Lab.",
    floor: 0,
    floor_label: "Basement",
    noise_level: "low_noise",
  });
  const first = space({ name: "Floor 1", floor: 1, floor_label: "Floor 1", noise_level: "conversational" });
  const second = space({ name: "Floor 2", floor: 2, floor_label: "Floor 2", noise_level: "loud" });
  const missing = space({ name: "Reading Room", floor: null, floor_label: null, noise_level: "quiet" });
  const groups = withFloorNotes(groupSpacesByFloor([second, missing, basement, first]), {
    bookableByFloor: new Map([[2, 13]]),
    entrances: [{ floor_label: "01" }, { floor_label: null }],
    overview: new Map([
      [basement.id, { typicalNoise: "quiet", checkInCount: 4 }],
      [first.id, { typicalNoise: "loud", checkInCount: 4 }],
    ]),
  });
  const note = (title: string) => groups.find((group) => group.title === title)?.note;
  assert.equal(note("Basement"), "Quietest floor");
  assert.equal(note("Floor 1"), "Entrance level");
  assert.equal(note("Floor 2"), "13 bookable rooms");
  assert.equal(note(UNLISTED_FLOOR), "1 space");
});

test("a tied or single check-in sample is not called the quietest floor", () => {
  const quiet = space({ name: "A", floor: 1, floor_label: "Floor 1" });
  const also = space({ name: "B", floor: 2, floor_label: "Floor 2" });
  const tied = withFloorNotes(groupSpacesByFloor([quiet, also]), {
    bookableByFloor: new Map(),
    entrances: [],
    overview: new Map([
      [quiet.id, { typicalNoise: "quiet", checkInCount: 2 }],
      [also.id, { typicalNoise: "quiet", checkInCount: 2 }],
    ]),
  });
  assert.equal(tied.every((group) => group.note == null), true);

  const only = withFloorNotes(groupSpacesByFloor([quiet]), {
    bookableByFloor: new Map(),
    entrances: [],
    overview: new Map([[quiet.id, { typicalNoise: "quiet", checkInCount: 9 }]]),
  });
  assert.equal(only[0]?.note, null);
});

test("bookable count wins over the quietest label, and one room stays singular", () => {
  const room = space({ name: "Carrel", floor: 3, floor_label: "Floor 3", summary: "CAEN desk" });
  const other = space({ name: "Hall", floor: 4, floor_label: "Floor 4" });
  const groups = withFloorNotes(groupSpacesByFloor([room, other]), {
    bookableByFloor: new Map([[3, 1]]),
    entrances: [{ floor_label: "Floor 3" }],
    overview: new Map([
      [room.id, { typicalNoise: "quiet", checkInCount: 5 }],
      [other.id, { typicalNoise: "loud", checkInCount: 5 }],
    ]),
  });
  assert.equal(groups[0]?.note, "1 bookable room");
  assert.equal(groups[1]?.note, null);
});

test("ranks inside each floor and never hides a space or moves a floor", () => {
  const loud = space({ name: "Alpha", floor: 1, floor_label: "Floor 1", noise_level: "loud" });
  const quiet = space({ name: "Zulu", floor: 1, floor_label: "Floor 1", noise_level: "quiet" });
  const upstairs = space({ name: "Quiet upstairs", floor: 4, floor_label: "Floor 4", noise_level: "quiet" });
  const basement = space({ name: "Lab", floor: 0, floor_label: "Basement", noise_level: "conversational" });
  const input = [loud, upstairs, quiet, basement];

  const alphabetical = rankWithinFloors(groupSpacesByFloor(input), {});
  assert.deepEqual(titles(alphabetical), ["Basement", "Floor 1", "Floor 4"]);
  assert.deepEqual(
    alphabetical.find((group) => group.title === "Floor 1")?.spaces.map((item) => item.name),
    ["Alpha", "Zulu"],
  );

  const byQuiet = rankWithinFloors(groupSpacesByFloor(input), {
    preferences: { noise: "quiet", setting: "any", brightness: "any", daylight: "any", niceToHave: [], when: [] },
  });
  assert.deepEqual(titles(byQuiet), ["Basement", "Floor 1", "Floor 4"]);
  assert.deepEqual(
    byQuiet.find((group) => group.title === "Floor 1")?.spaces.map((item) => item.name),
    ["Zulu", "Alpha"],
  );
  assert.equal(
    byQuiet.reduce((count, group) => count + group.spaces.length, 0),
    input.length,
  );

  const matched = filterSpaces(input, ["quiet"]);
  const narrowed = rankWithinFloors(groupSpacesByFloor(matched), { preferences: { noise: "quiet" } });
  assert.deepEqual(titles(narrowed), ["Floor 1", "Floor 4"]);
  assert.deepEqual(
    narrowed.flatMap((group) => group.spaces.map((item) => item.name)),
    ["Zulu", "Quiet upstairs"],
  );
});

test("the screen title and the sort line follow preferences and group size", () => {
  const none = { noise: "any", setting: "any", brightness: "any", daylight: "any", niceToHave: [], when: [] } as const;
  const quiet = { ...none, noise: "quiet" } as const;
  assert.equal(spacesTitle(11), "11 study spaces");
  assert.equal(spacesTitle(1), "1 study space");
  assert.equal(hasStudyPreferences(none), false);
  assert.equal(hasStudyPreferences(quiet), true);
  assert.equal(spacesSortCaption(none, null), null);
  assert.equal(spacesSortCaption(quiet, null), "Sorted by how you like to study");
  assert.equal(spacesSortCaption(none, "2_3"), "Sorted for your group size");
  assert.equal(spacesSortCaption(quiet, "2_3"), "Sorted by how you like to study and your group size");
});
