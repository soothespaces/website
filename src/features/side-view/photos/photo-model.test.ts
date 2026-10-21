import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPhoto,
  creditPill,
  filterPhotos,
  formatCreditMonth,
  orderPhotos,
  photoCountLabel,
  photoSpace,
  photoSrcSet,
  photosForSpace,
  widthAtLeast,
  widthThatFits,
  type GalleryPhoto,
  type SpaceRef,
} from "./photo-model.ts";

const SQUARE = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
  ],
};

function photo(overrides: Partial<GalleryPhoto> = {}): GalleryPhoto {
  return {
    id: "p",
    pathPrefix: "photos/buildings/shapiro/abc",
    widths: [480, 960, 1600],
    width: 1600,
    height: 1200,
    alt: "Reading Room, long tables",
    credit: "University of Michigan Library",
    license: "UM, used with credit",
    sourceUrl: "https://www.lib.umich.edu/example",
    sortOrder: 0,
    kind: "photo",
    floor: 2,
    roomNumber: null,
    lat: null,
    lng: null,
    spaceId: null,
    buildingSlug: "shapiro",
    spaceName: null,
    spaceSlug: null,
    createdAt: "2026-10-04T15:00:00.000Z",
    isListed: true,
    ...overrides,
  };
}

const reading: SpaceRef = {
  id: "reading",
  slug: "reading-room",
  name: "Reading Room",
  buildingSlug: "shapiro",
  locations: [{ floor: 2, roomNumber: "Room 2124", area: null }],
};

const lounge: SpaceRef = {
  id: "lounge",
  slug: "lounge",
  name: "Lounge",
  buildingSlug: "shapiro",
  locations: [{ floor: 1, roomNumber: null, area: SQUARE }],
};

test("credit pills match the board", () => {
  assert.deepEqual(creditPill(photo()), { source: "official", label: "U-M Library" });
  assert.deepEqual(creditPill(photo({ credit: "Cadop, Wikimedia Commons, CC0", license: "CC0" })), {
    source: "official",
    label: "Wikimedia Commons",
  });
  assert.deepEqual(creditPill(photo({ credit: "Visitor", license: "Visitor photo" })), {
    source: "visitor",
    label: "Visitor · Oct 2026",
  });
  assert.deepEqual(creditPill(photo({ credit: "Soothe Spaces team", license: "Soothe Spaces team photo" })), {
    source: "official",
    label: "Soothe Spaces",
  });
  assert.equal(formatCreditMonth("not-a-date"), null);
});

test("Google photos and panoramas stay out of every chip", () => {
  const rows = [
    classifyPhoto(photo({ id: "lib" })),
    classifyPhoto(photo({ id: "wiki", credit: "Kashkin, Wikimedia Commons, Public domain", license: "Public domain" })),
    classifyPhoto(photo({ id: "visit", credit: "Visitor", license: "Visitor photo" })),
    classifyPhoto(
      photo({
        id: "google",
        credit: "A Google user",
        license: "Google",
        sourceUrl: "https://lh5.googleusercontent.com/p/abc",
      }),
    ),
    classifyPhoto(photo({ id: "hidden", isListed: false })),
    classifyPhoto(photo({ id: "pano", kind: "panorama" })),
  ];

  assert.deepEqual(
    filterPhotos(rows, "all").map((item) => item.id),
    ["lib", "wiki", "visit"],
  );
  assert.deepEqual(
    filterPhotos(rows, "official").map((item) => item.id),
    ["lib", "wiki"],
  );
  assert.deepEqual(
    filterPhotos(rows, "visitors").map((item) => item.pill),
    ["Visitor · Oct 2026"],
  );
  assert.equal(photoCountLabel(12), "12 photos");
  assert.equal(photoCountLabel(1), "1 photo");
  assert.equal(photoCountLabel(0), "No photos");
});

test("a photo belongs to a space by id, room number, or spot", () => {
  const spaces = [reading, lounge];
  assert.equal(photoSpace(photo({ spaceId: "reading", roomNumber: null }), spaces)?.slug, "reading-room");
  assert.equal(
    photoSpace(photo({ spaceId: null, floor: 2, roomNumber: "2124" }), spaces)?.id,
    "reading",
  );
  assert.equal(photoSpace(photo({ spaceId: null, floor: 1, lat: 1, lng: 1, roomNumber: null }), spaces)?.id, "lounge");
  assert.equal(photoSpace(photo({ spaceId: null, floor: 1, lat: 5, lng: 5, roomNumber: null }), spaces), null);

  const upload = photo({ id: "upload", spaceId: null, floor: 2, roomNumber: "2124" });
  assert.deepEqual(
    photosForSpace([upload, photo({ id: "other", roomNumber: "9999" })], reading, spaces).map((item) => item.id),
    ["upload"],
  );
});

test("space photos come before building photos, then by saved order", () => {
  const rows = [
    photo({ id: "building-late", spaceSlug: null, sortOrder: 0, createdAt: "2026-02-01T00:00:00.000Z" }),
    photo({ id: "space-b", spaceSlug: "reading-room", sortOrder: 2, createdAt: "2026-01-01T00:00:00.000Z" }),
    photo({ id: "space-a", spaceSlug: "reading-room", sortOrder: 1, createdAt: "2026-03-01T00:00:00.000Z" }),
    photo({ id: "building-early", spaceSlug: null, sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z" }),
  ];
  assert.deepEqual(
    orderPhotos(rows).map((item) => item.id),
    ["space-a", "space-b", "building-early", "building-late"],
  );
});

test("srcset uses stored widths and the loader covers the request", () => {
  assert.equal(widthThatFits([480, 960, 1600], 400, 2), 480);
  assert.equal(widthThatFits([480, 960, 1600], 400, 3), 960);
  assert.equal(widthThatFits([1600], 100, 1), 1600);
  assert.equal(widthThatFits([], 100, 1), null);
  assert.equal(widthAtLeast([480, 960, 1600], 640), 960);
  assert.equal(widthAtLeast([480], 640), 480);
  assert.equal(widthAtLeast([], 640), null);
  assert.equal(
    photoSrcSet("https://example.supabase.co/", "photos/buildings/shapiro/abc", [960, 480]),
    "https://example.supabase.co/storage/v1/object/public/photos/buildings/shapiro/abc-480.webp 480w, https://example.supabase.co/storage/v1/object/public/photos/buildings/shapiro/abc-960.webp 960w",
  );
});
