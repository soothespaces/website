import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nearestSpaces, searchSpaces, type CheckInSpace } from "./spaces.ts";

const shapiro = { buildingSlug: "shapiro", buildingName: "Shapiro Library", buildingLat: 42.2756, buildingLng: -83.7372 };

function space(partial: Partial<CheckInSpace> & Pick<CheckInSpace, "id" | "name">): CheckInSpace {
  return {
    slug: partial.id,
    lat: null,
    lng: null,
    buildingSlug: shapiro.buildingSlug,
    buildingName: shapiro.buildingName,
    buildingLat: shapiro.buildingLat,
    buildingLng: shapiro.buildingLng,
    ...partial,
  };
}

describe("check-in spaces (K2 / SOS-137)", () => {
  it("lists the nearest spaces in the building and keeps the open space in the row", () => {
    const near = space({ id: "near", name: "Reading Room", lat: 42.27561, lng: -83.73721 });
    const mid = space({ id: "mid", name: "Fishbowl", lat: 42.2759, lng: -83.7374 });
    const far = space({ id: "far", name: "Stacks", lat: 42.2764, lng: -83.738 });
    const other = space({ id: "other", name: "Cafe", lat: 42.2768, lng: -83.739, buildingSlug: "union", buildingName: "Michigan Union" });
    const picked = space({ id: "picked", name: "Basement", lat: 42.277, lng: -83.74 });
    const rows = nearestSpaces([far, other, mid, near, picked], {
      buildingSlug: "shapiro",
      origin: { lat: 42.2756, lng: -83.7372 },
      preferId: "picked",
    });
    assert.deepEqual(
      rows.map((row) => row.id),
      ["near", "mid", "picked"],
    );
  });

  it("sorts spaces with no coordinates after the ones it can measure", () => {
    const placed = space({ id: "placed", name: "Placed", lat: 42.2756, lng: -83.7372 });
    const unplaced = space({
      id: "unplaced",
      name: "Atrium",
      buildingLat: null,
      buildingLng: null,
    });
    const rows = nearestSpaces([unplaced, placed], {
      origin: { lat: 42.2756, lng: -83.7372 },
      limit: 2,
    });
    assert.deepEqual(
      rows.map((row) => row.id),
      ["placed", "unplaced"],
    );
  });

  it("searches by space or building name", () => {
    const rows = searchSpaces(
      [
        space({ id: "a", name: "Reading Room" }),
        space({ id: "b", name: "Cafe", buildingName: "Michigan Union", buildingSlug: "union" }),
      ],
      "union",
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      ["b"],
    );
    assert.equal(searchSpaces([space({ id: "a", name: "Reading Room" })], "  ").length, 0);
  });
});
