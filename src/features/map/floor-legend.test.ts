import assert from "node:assert/strict";
import test from "node:test";
import { legendGroups } from "./floor-legend-model.ts";

const empty = {
  roomsMap: false,
  noise: {},
  bookable: false,
  staff: false,
  notStudy: false,
  printer: false,
  restroom: false,
};

test("the legend lists only what this floor draws", () => {
  const groups = legendGroups({
    ...empty,
    noise: { conversational: true },
    bookable: true,
    staff: true,
    notStudy: true,
    printer: true,
  });
  assert.deepEqual(
    groups.map((group) => group.heading),
    ["NOISE", "ROOMS", "AMENITIES"],
  );
  assert.deepEqual(groups[0].rows.map((row) => row.label), ["Conversational"]);
  assert.deepEqual(groups[1].rows.map((row) => row.label), ["Bookable", "Staff only", "Not a study space"]);
  assert.deepEqual(groups[2].rows.map((row) => row.label), ["Printer"]);
});

test("a floor without staff or printers omits those rows", () => {
  const groups = legendGroups({ ...empty, noise: { quiet: true }, notStudy: true });
  assert.deepEqual(groups[0].rows.map((row) => row.label), ["Quiet"]);
  assert.deepEqual(groups[1].rows.map((row) => row.label), ["Not a study space"]);
  assert.equal(groups.some((group) => group.heading === "AMENITIES"), false);
});

test("the rooms map replaces noise and rooms with free and booked", () => {
  const groups = legendGroups({
    ...empty,
    roomsMap: true,
    noise: { loud: true },
    bookable: true,
    staff: true,
    printer: true,
    restroom: true,
  });
  assert.deepEqual(groups[0].rows.map((row) => row.label), ["Free", "Booked"]);
  assert.equal(groups[0].heading, null);
  assert.deepEqual(groups[1].rows.map((row) => row.label), ["Printer", "Restroom"]);
});
