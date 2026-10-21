import assert from "node:assert/strict";
import test from "node:test";
import {
  buildingSubtitle,
  displayAddress,
  entranceSummary,
  isGooglePhoto,
  photoCount,
  roomName,
  seeAllRooms,
} from "./copy.ts";
import { collectFloors } from "./floors.ts";
import { rankPreview } from "./preview.ts";
import { loginHrefFor } from "../../../lib/auth/paths.ts";
import { DEFAULT_STUDY, hasStudyPreferences } from "../../../lib/settings/model.ts";

test("sign-in comes back to the open building", () => {
  assert.equal(
    loginHrefFor("/map", "?panel=building&b=harold-t-and-vivian-b-shapiro-library"),
    "/login?next=%2Fmap%3Fpanel%3Dbuilding%26b%3Dharold-t-and-vivian-b-shapiro-library",
  );
  assert.equal(loginHrefFor("/map", ""), "/login?next=%2Fmap");
});

test("floor count comes from the building, and the range from floors we can see", () => {
  assert.deepEqual(
    collectFloors({
      planFloors: [2, 3, 4, 6],
      labels: [],
      recordedCount: 8,
    }),
    { value: "8", detail: "2 to 6" },
  );
  assert.deepEqual(collectFloors({ planFloors: [2], labels: [], recordedCount: 4 }), { value: "4", detail: "2" });
  assert.deepEqual(
    collectFloors({ planFloors: [3, 4], labels: [], recordedCount: 6 }),
    { value: "6", detail: "3 to 4" },
  );
  assert.deepEqual(
    collectFloors({
      planFloors: [1, 2, 3],
      labels: ["Basement", "Floor 4"],
    }),
    { value: "5", detail: "B to 4" },
  );
  assert.deepEqual(collectFloors({ planFloors: [], labels: [], recordedCount: 2 }), { value: "2" });
  assert.equal(collectFloors({ planFloors: [], labels: [] }), null);
});

test("building subtitle and entrance count", () => {
  assert.equal(displayAddress("919 S. UNIVERSITY AVE"), "919 S. University Ave");
  assert.equal(displayAddress("919 S. University Ave"), "919 S. University Ave");
  assert.equal(buildingSubtitle("UGLI", "919 S. UNIVERSITY AVE"), "UGLI · 919 S. University Ave");
  assert.equal(buildingSubtitle(null, null), null);
  assert.equal(entranceSummary(5, 2), "5 accessible, 2 automatic");
  assert.equal(entranceSummary(0, 0), "No accessible entrances on record");
  assert.equal(photoCount(1), "1 photo");
  assert.equal(photoCount(12), "12 photos");
  assert.equal(seeAllRooms(18), "See all 18 rooms");
  assert.equal(seeAllRooms(1), "See all 1 room");
});

test("study preferences are unset only at the defaults", () => {
  assert.equal(hasStudyPreferences(DEFAULT_STUDY), false);
  assert.equal(hasStudyPreferences({ ...DEFAULT_STUDY, noise: "quiet" }), true);
  assert.equal(hasStudyPreferences({ ...DEFAULT_STUDY, niceToHave: ["outlets"] }), true);
});

test("google photos are dropped", () => {
  assert.equal(isGooglePhoto({ sourceUrl: "https://maps.google.com/photo", license: "UM" }), true);
  assert.equal(isGooglePhoto({ sourceUrl: "https://www.lib.umich.edu/a.jpg", license: "UM", credit: "Library" }), false);
});

test("room names prefer the room number and booth label", () => {
  assert.equal(roomName("2nd Floor - 2124 - Study Room (Capacity 9)", "2124"), "Room 2124");
  assert.equal(roomName("Booth 2 (Capacity 1)", null), "Booth 2");
});

test("preview rows are free soonest, then longest, with unknown availability last", () => {
  const now = new Date("2026-10-21T00:00:00Z"); // 8 PM Detroit
  const ranked = rankPreview(
    [
      { name: "Unknown", status: "Availability unavailable" },
      { name: "Booked", status: "Booked until 9 PM" },
      { name: "Short", status: "Free until 9 PM" },
      { name: "Long", status: "Free for the rest of the day" },
    ],
    now,
  );
  assert.deepEqual(
    ranked.map((room) => room.name),
    ["Long", "Short", "Booked", "Unknown"],
  );
});
