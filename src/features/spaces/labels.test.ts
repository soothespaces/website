import assert from "node:assert/strict";
import { test } from "node:test";
import { buildingShortName, spaceFloorLine, spaceNameOnFloor, spaceShortName, spaceTitle } from "./labels";

const dude = { name: "James And Anne Duderstadt Center", short_name: "Duderstadt" };
const computing = {
  name: "Art, Architecture, and Engineering Library Floor 2 Computing Spaces",
  short_name: "Floor 2 · Computing",
  floor_label: "Floor 2",
  building: dude,
};

test("short names win, full names are the fallback", () => {
  assert.equal(buildingShortName(dude), "Duderstadt");
  assert.equal(buildingShortName({ name: "Tappan Hall", short_name: " " }), "Tappan Hall");
  assert.equal(buildingShortName(null), null);
  assert.equal(spaceShortName(computing), "Floor 2 · Computing");
  assert.equal(spaceShortName({ name: "Hatcher South Open Carrels", short_name: null }), "Hatcher South Open Carrels");
});

test("spaceTitle leads with the building", () => {
  assert.equal(spaceTitle(computing), "Duderstadt, Floor 2 · Computing");
  assert.equal(spaceTitle({ name: "Somewhere", building: null }), "Somewhere");
});

test("the floor line is dropped when the short name says it", () => {
  assert.equal(spaceFloorLine(computing), null);
  assert.equal(spaceFloorLine({ name: "Reading Room", floor_label: "Floor 3" }), "Floor 3");
  assert.equal(spaceFloorLine({ name: "Floor 3", floor_label: "floor 3" }), null);
});

test("under a floor heading the floor is left out", () => {
  assert.equal(spaceNameOnFloor(computing, "Floor 2"), "Computing");
  assert.equal(spaceNameOnFloor({ name: "Shapiro Floor 4 Spaces", short_name: "Floor 4" }, "Floor 4"), "Whole floor");
  assert.equal(spaceNameOnFloor({ name: "Soundproof Booths", short_name: "Soundproof booths" }, "Floor unknown"), "Soundproof booths");
  assert.equal(spaceNameOnFloor({ name: "Hatcher Floor 6 Spaces", short_name: null }, "Floor 6"), "Hatcher Floor 6 Spaces");
});
