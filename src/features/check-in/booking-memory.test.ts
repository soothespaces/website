import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeBooking,
  bookingPill,
  bookingTitle,
  currentBooking,
  forgetBooking,
  rememberBooking,
  type SavedBooking,
} from "./booking-memory.ts";

function memory() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

const booking: SavedBooking = {
  roomName: "Study Room 2124",
  roomNumber: "2124",
  buildingSlug: "shapiro",
  spaceId: "space-1",
  startsAt: "2026-10-21T00:00:00.000Z",
  endsAt: "2026-10-21T02:00:00.000Z",
};

describe("booking memory (K3 / SOS-161)", () => {
  it("formats the pill and the room question", () => {
    assert.equal(bookingPill(booking.startsAt, booking.endsAt), "Your booking · 8 – 10 PM");
    assert.equal(bookingTitle(booking), "How's Room 2124?");
    assert.equal(bookingTitle({ roomName: "Fishbowl", roomNumber: "" }), "How's Fishbowl?");
    assert.equal(bookingTitle({ roomName: "Booth 1", roomNumber: "BOOTH1" }), "How's Booth 1?");
  });

  it("keeps a booking only while now is inside its window", () => {
    const before = Date.parse("2026-10-20T23:00:00.000Z");
    const during = Date.parse("2026-10-21T01:00:00.000Z");
    const after = Date.parse("2026-10-21T03:00:00.000Z");
    assert.equal(activeBooking([booking], before), null);
    assert.equal(activeBooking([booking], during)?.roomNumber, "2124");
    assert.equal(activeBooking([booking], after), null);
  });

  it("saves, prunes, and clears through storage", () => {
    const storage = memory();
    const during = Date.parse("2026-10-21T01:00:00.000Z");
    const expired: SavedBooking = {
      ...booking,
      roomNumber: "100",
      startsAt: "2026-10-20T00:00:00.000Z",
      endsAt: "2026-10-20T01:00:00.000Z",
    };
    rememberBooking(expired, during, storage);
    rememberBooking(booking, during, storage);
    assert.equal(currentBooking(during, storage)?.roomNumber, "2124");
    forgetBooking(booking, storage);
    assert.equal(currentBooking(during, storage), null);
  });

  it("skips a booking when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.doesNotThrow(() => rememberBooking(booking, Date.parse(booking.startsAt), broken));
    assert.equal(currentBooking(Date.parse(booking.startsAt) + 1, broken), null);
  });

  it("keeps a booking that has no space yet", () => {
    const storage = memory();
    const during = Date.parse(booking.startsAt) + 1_000;
    rememberBooking({ ...booking, spaceId: null, roomName: "" }, during, storage);
    assert.equal(currentBooking(during, storage)?.spaceId, null);
  });
});
