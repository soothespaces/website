import assert from "node:assert/strict";
import test from "node:test";
import { BOOKABLE_PATTERN, bookableStripeImage } from "./floor-bookable-pattern.ts";

test("bookable stripes are diagonal, meet at tile edges, and keep a dark edge", () => {
  assert.equal(BOOKABLE_PATTERN, "bookable-stripes");
  const { width, data } = bookableStripeImage();
  assert.equal(width % 8, 0);
  const pixel = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return { r: data[index], a: data[index + 3] };
  };
  assert.ok(pixel(0, 0).a > 200);
  assert.equal(pixel(0, 0).r, 255);
  assert.equal(pixel(5, 0).a, 0);
  assert.equal(pixel(3, 0).r, 23);
  // The same diagonal step continues into the next tile.
  assert.deepEqual(pixel(width - 1, 0), pixel(7, 0));
  assert.deepEqual(pixel(0, 1), pixel(1, 0));
});
