export const BOOKABLE_PATTERN = "bookable-stripes";

// White 45° stripes on a transparent ground, so the noise fill shows between
// them. A cross-hatch is reserved for rooms that are booked.
// Period divides the tile, so the diagonal continues across tile edges.
const STRIPE_PERIOD = 8;
const STRIPE_WIDTH = 3;

export function bookableStripeImage(size = 32): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const along = (x + y) % STRIPE_PERIOD;
      if (along > STRIPE_WIDTH) continue;
      const index = (y * size + x) * 4;
      // A dark edge keeps the white stripe readable on gold.
      const edge = along === STRIPE_WIDTH;
      data[index] = edge ? 23 : 255;
      data[index + 1] = edge ? 23 : 255;
      data[index + 2] = edge ? 23 : 255;
      data[index + 3] = edge ? 210 : 235;
    }
  }
  return { width: size, height: size, data };
}
