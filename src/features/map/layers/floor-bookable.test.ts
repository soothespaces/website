import assert from "node:assert/strict";
import test from "node:test";
import { BOOKABLE_PATTERN, bookableStripeImage } from "./floor-bookable-pattern.ts";

test("bookable stripes are diagonal and white, with transparent gaps", () => {
  assert.equal(BOOKABLE_PATTERN, "bookable-stripes");
  const { width, data } = bookableStripeImage(20);
  const pixel = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  assert.ok(pixel(0, 0) > 200);
  assert.equal(pixel(8, 0), 0);
  // x + y stays on the same diagonal.
  assert.ok(pixel(2, 0) > 200);
  assert.ok(pixel(1, 1) > 200);
  assert.ok(pixel(0, 2) > 200);
});
