import assert from "node:assert/strict";
import test from "node:test";
import {
  buildingDisplayName,
  floorPlanSubtitle,
  heroPhoto,
  isBlockedPhoto,
  photoCountLabel,
  spaceBackLabel,
  spaceOpenStatus,
  spaceParagraph,
  spacePhotosRoute,
  walkPoint,
  walkTimeLabel,
  whatsHereLabels,
} from "./format.ts";

test("photo count hides zero and pluralizes", () => {
  assert.equal(photoCountLabel(0), null);
  assert.equal(photoCountLabel(-2), null);
  assert.equal(photoCountLabel(1.5), null);
  assert.equal(photoCountLabel(1), "1 photo");
  assert.equal(photoCountLabel(5), "5 photos");
});

test("floor plan subtitle uses space_locations floors", () => {
  assert.equal(floorPlanSubtitle([]), "Floor not listed yet");
  assert.equal(floorPlanSubtitle([2, 2]), "Floor 2");
  assert.equal(floorPlanSubtitle([3, 1]), "Floors 1 and 3");
  assert.equal(floorPlanSubtitle([4, 1, 2]), "Floors 1, 2 and 4");
});

test("what's here keeps amenities and drops facts the rows already show", () => {
  assert.deepEqual(
    whatsHereLabels(["natural_light", "wheelchair_accessible", "all_gender_restroom_on_floor", "outlets"], ["light", "power"]),
    ["Wheelchair accessible", "All-gender restroom on floor"],
  );
  assert.deepEqual(whatsHereLabels(["printing", "computers"], null), ["Computers", "Printing"]);
  assert.deepEqual(whatsHereLabels(["printing", "computers"], ["nearby"]), ["Computers"]);
  assert.deepEqual(whatsHereLabels(["whiteboards", "computers"], []), ["Whiteboards", "Computers"]);
});

test("the paragraph is the summary, then the longer description", () => {
  assert.equal(spaceParagraph("  Long tables. ", "A much longer listing."), "Long tables.");
  assert.equal(spaceParagraph("  ", "The reading room."), "The reading room.");
  assert.equal(spaceParagraph(null, "  "), null);
});

test("building link prefers the short name", () => {
  assert.equal(buildingDisplayName({ name: "Harold T And Vivian B Shapiro Library", shortName: " Shapiro Library " }), "Shapiro Library");
  assert.equal(buildingDisplayName({ name: "Hatcher", shortName: null }), "Hatcher");
  assert.equal(buildingDisplayName(null), null);
});

test("open status turns a later opening into closed now", () => {
  assert.equal(spaceOpenStatus(null), null);
  assert.equal(spaceOpenStatus("Open 24 hours"), "Open 24 hours");
  assert.equal(spaceOpenStatus("Open until 11 PM"), "Open until 11 PM");
  assert.equal(spaceOpenStatus("Open until midnight"), "Open until midnight");
  assert.equal(spaceOpenStatus("Opens at 8 AM"), "Closed now · opens 8 AM");
  assert.equal(spaceOpenStatus("Closed today"), "Closed today");
});

test("walk time hides without a position and rounds to minutes", () => {
  assert.equal(walkTimeLabel(null), null);
  assert.equal(walkTimeLabel(undefined), null);
  assert.equal(walkTimeLabel(Number.NaN), null);
  assert.equal(walkTimeLabel(-1), null);
  assert.equal(walkTimeLabel(0), "1 min walk");
  assert.equal(walkTimeLabel(40), "1 min walk");
  assert.equal(walkTimeLabel(80), "1 min walk");
  assert.equal(walkTimeLabel(120), "2 min walk");
  assert.equal(walkTimeLabel(320), "4 min walk");
});

test("walk distance uses the space, then its building", () => {
  assert.deepEqual(walkPoint({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }), { lat: 1, lng: 2 });
  assert.deepEqual(walkPoint({ lat: null, lng: null }, { lat: 3, lng: 4 }), { lat: 3, lng: 4 });
  assert.equal(walkPoint({ lat: null, lng: 2 }, null), null);
});

test("a Google or Yelp photo is not shown", () => {
  assert.equal(isBlockedPhoto({ sourceUrl: "https://maps.google.com/photo" }), true);
  assert.equal(isBlockedPhoto({ credit: "Yelp" }), true);
  assert.equal(isBlockedPhoto({ sourceUrl: "https://www.lib.umich.edu/room.webp" }), false);
});

test("the photos pill opens the gallery by space slug", () => {
  assert.deepEqual(spacePhotosRoute("harold-t-and-vivian-b-shapiro-library", "shapiro-reading-room"), {
    kind: "photos",
    slug: "harold-t-and-vivian-b-shapiro-library",
    spaceId: "shapiro-reading-room",
  });
});

test("hero prefers the library photo and always has alt text", () => {
  assert.deepEqual(
    heroPhoto({ name: "Reading Room", imageUrl: "https://example.com/a.webp", imageAlt: " Tables ", gallery: { src: "g", alt: "Gallery" } }),
    { src: "https://example.com/a.webp", alt: "Tables" },
  );
  assert.deepEqual(heroPhoto({ name: "Reading Room", imageUrl: null, imageAlt: null, gallery: { src: "g", alt: "  " } }), {
    src: "g",
    alt: "Photo of Reading Room",
  });
  assert.equal(heroPhoto({ name: "Reading Room", imageUrl: null, imageAlt: null, gallery: null }), null);
  assert.deepEqual(
    heroPhoto({
      name: "Reading Room",
      imageUrl: "https://lh3.googleusercontent.com/p",
      imageAlt: "Street view",
      gallery: { src: "ours", alt: "Tables" },
    }),
    { src: "ours", alt: "Tables" },
  );
});

test("back names the building under this space", () => {
  assert.equal(spaceBackLabel(undefined, "Shapiro Library"), "Back");
  assert.equal(spaceBackLabel({ kind: "home" }, "Shapiro Library"), "Back");
  assert.equal(spaceBackLabel({ kind: "building", slug: "shapiro", name: "Shapiro Library" }, null), "Back to Shapiro Library");
  assert.equal(spaceBackLabel({ kind: "building", slug: "shapiro" }, "Shapiro Library"), "Back to Shapiro Library");
  assert.equal(spaceBackLabel({ kind: "hours", slug: "shapiro" }, "Shapiro Library"), "Back");
});
