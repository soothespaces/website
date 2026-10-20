import assert from "node:assert/strict";
import test from "node:test";
import { bookingWindow, PENDING_BOOKING_KEY, readPendingBooking, recordPendingBooking } from "./booking-memory.ts";

test("the booking window is the eight Detroit half hours on screen", () => {
  // 8:10 PM EDT on Oct 21 is 00:10 UTC on Oct 22. The window is 8 PM to 12 AM.
  const span = bookingWindow(new Date("2026-10-22T00:10:00Z"));
  assert.equal(span.start, "2026-10-22T00:00:00.000Z");
  assert.equal(span.end, "2026-10-22T04:00:00.000Z");
});

test("Book stores the room for the check-in prompt and ignores a blocked store", () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
  const booking = {
    roomName: "Room 2124",
    roomNumber: "2124",
    buildingSlug: "harold-t-and-vivian-b-shapiro-library",
    spaceId: null,
    start: "2026-10-22T00:00:00.000Z",
    end: "2026-10-22T04:00:00.000Z",
  };
  recordPendingBooking(booking, storage);
  assert.equal(saved.has(PENDING_BOOKING_KEY), true);
  assert.deepEqual(readPendingBooking(storage), booking);
  assert.equal(readPendingBooking({ getItem: () => "nope", setItem: () => {} }), null);
  assert.doesNotThrow(() =>
    recordPendingBooking(booking, {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    }),
  );
});
