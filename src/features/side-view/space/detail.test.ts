import assert from "node:assert/strict";
import test from "node:test";
import { chooseSpacePhotos, floorsForPrinters, locationFloors, toSpaceDetail, type SpaceDetailRow } from "./detail.ts";

const row: SpaceDetailRow = {
  id: "space-1",
  slug: "shapiro-reading-room",
  name: " Shapiro Reading Room ",
  summary: " Long tables. ",
  description: "The longer listing.",
  floor: null,
  floor_label: null,
  noise_level: "quiet",
  light_level: null,
  features: ["natural_light", "not-a-feature", "wheelchair_accessible"],
  capacity: null,
  image_url: " https://example.com/room.webp ",
  image_alt: " Students ",
  source: "um_library",
  edited_fields: ["noise_level"],
  lat: null,
  lng: null,
  building: [{ slug: "shapiro", name: "Harold T And Vivian B Shapiro Library", short_name: " Shapiro Library ", lat: 1, lng: 2 }],
  locations: [
    { floor: 2, room_number: " 200 " },
    { floor: 1, room_number: null },
  ],
};

test("a space row keeps the building short name, floors, and listed features", () => {
  const detail = toSpaceDetail(row, {
    count: 5,
    gallery: { src: "g", srcSet: "g 960w", alt: "Gallery", credit: null },
  });
  assert.ok(detail);
  assert.equal(detail.name, "Shapiro Reading Room");
  assert.equal(detail.summary, "Long tables.");
  assert.equal(detail.imageUrl, "https://example.com/room.webp");
  assert.equal(detail.imageAlt, "Students");
  assert.deepEqual(detail.features, ["natural_light", "wheelchair_accessible"]);
  assert.equal(detail.building?.shortName, "Shapiro Library");
  assert.deepEqual(locationFloors(detail.locations), [1, 2]);
  assert.deepEqual(
    detail.locations.map((location) => location.roomNumber),
    [null, "200"],
  );
  assert.equal(detail.photoCount, 5);
  assert.equal(detail.noiseLevel, "quiet");
});

test("a row without an id is not a space", () => {
  assert.equal(toSpaceDetail({ ...row, id: "" }, { count: 0, gallery: null }), null);
  assert.equal(toSpaceDetail({ ...row, source: "google" }, { count: 0, gallery: null }), null);
});

test("gallery photos drop Google rows and keep the stored widths", () => {
  const photos = chooseSpacePhotos(
    [
      {
        alt: "Street",
        pathPrefix: "photos/street",
        widths: [960],
        credit: "Google",
        license: null,
        sourceUrl: null,
      },
      {
        alt: "Tables",
        pathPrefix: "photos/tables",
        widths: [480, 960],
        credit: "Soothe Spaces team",
        license: "Soothe Spaces team photo",
        sourceUrl: null,
      },
    ],
    "https://example.supabase.co",
  );
  assert.equal(photos.count, 1);
  assert.equal(photos.gallery?.alt, "Tables");
  assert.match(photos.gallery?.src ?? "", /photos\/tables-960\.webp$/);
  assert.match(photos.gallery?.srcSet ?? "", /480w/);
});

test("printer floors include the library floor when no polygon is placed", () => {
  assert.deepEqual(floorsForPrinters({ floor: 2, locations: [] }), [2]);
  assert.deepEqual(floorsForPrinters({ floor: 2, locations: [{ floor: 3 }] }), [2, 3]);
  assert.deepEqual(locationFloors([]), []);
});
