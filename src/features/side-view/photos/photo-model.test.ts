import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPhoto,
  creditPill,
  filterPhotos,
  formatCreditMonth,
  groupPhotos,
  photoCountLabel,
  photoFileUrl,
  photoSrcSet,
  swipeDirection,
  widthThatFits,
  type GalleryPhoto,
} from "./photo-model.ts";

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
    spaceName: null,
    spaceSlug: null,
    spaceFloor: null,
    createdAt: "2026-10-04T15:00:00.000Z",
    uploadedBy: null,
    isListed: true,
    ...overrides,
  };
}

test("credit pills match the board", () => {
  assert.deepEqual(creditPill(photo()), { source: "official", label: "U-M Library" });
  assert.deepEqual(
    creditPill(photo({ credit: "Cadop, Wikimedia Commons, CC0", license: "CC0" })),
    { source: "official", label: "Wikimedia Commons" },
  );
  assert.deepEqual(
    creditPill(photo({ credit: "Visitor", license: "Visitor photo" })),
    { source: "visitor", label: "Visitor · Oct 2026" },
  );
  assert.deepEqual(creditPill(photo({ credit: "Soothe Spaces team", license: "Soothe Spaces team photo" })), {
    source: "official",
    label: "Soothe Spaces",
  });
  assert.equal(formatCreditMonth("not-a-date"), null);
});

test("Google photos are hidden from every chip", () => {
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

test("photos group by room and spot, low floors first", () => {
  const rows = [
    classifyPhoto(photo({ id: "spot", lat: 42.27, lng: -83.73, floor: 1, spaceId: null })),
    classifyPhoto(photo({ id: "room-b", roomNumber: "2202", floor: 2, sortOrder: 1 })),
    classifyPhoto(photo({ id: "room-a", roomNumber: "2202", floor: 2, sortOrder: 0, lat: 42.1, lng: -83.7 })),
    classifyPhoto(
      photo({
        id: "space",
        spaceId: "reading",
        spaceName: "Reading Room",
        floor: null,
        spaceFloor: 3,
        alt: "",
      }),
    ),
    classifyPhoto(photo({ id: "basement", roomNumber: "B12", floor: 0 })),
  ];

  const groups = groupPhotos(rows);
  assert.deepEqual(
    groups.map((group) => [group.label, group.photos.map((item) => item.id)]),
    [
      ["Floor 0 · Room B12", ["basement"]],
      ["Floor 1 spot", ["spot"]],
      ["Floor 2 · Room 2202", ["room-b", "room-a"]],
      ["Reading Room", ["space"]],
    ],
  );
  assert.equal(groups[3]?.photos[0]?.caption, "Reading Room");
});

test("a sideways swipe changes photos and a short drag does not", () => {
  assert.equal(swipeDirection(-80, 10), "next");
  assert.equal(swipeDirection(80, 10), "prev");
  assert.equal(swipeDirection(-20, 0), null);
  assert.equal(swipeDirection(-40, 80), null);
});

test("srcset uses stored widths and the viewer picks the largest that fits", () => {
  assert.equal(widthThatFits([480, 960, 1600], 400, 2), 480);
  assert.equal(widthThatFits([480, 960, 1600], 400, 3), 960);
  assert.equal(widthThatFits([1600], 100, 1), 1600);
  assert.equal(widthThatFits([], 100, 1), null);
  assert.equal(
    photoFileUrl("https://example.supabase.co/", "/photos/buildings/shapiro/abc", 960),
    "https://example.supabase.co/storage/v1/object/public/photos/buildings/shapiro/abc-960.webp",
  );
  assert.equal(
    photoSrcSet("https://example.supabase.co", "photos/buildings/shapiro/abc", [960, 480]),
    "https://example.supabase.co/storage/v1/object/public/photos/buildings/shapiro/abc-480.webp 480w, https://example.supabase.co/storage/v1/object/public/photos/buildings/shapiro/abc-960.webp 960w",
  );
});
