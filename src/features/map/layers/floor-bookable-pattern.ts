export const BOOKABLE_PATTERN = "bookable-stripes";

// White 45° stripes on a transparent ground, so the noise fill shows between
// them. A cross-hatch is reserved for rooms that are booked.
export function bookableStripeImage(size = 32): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  const stripe = 3;
  const period = 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % period >= stripe) continue;
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = 235;
    }
  }
  return { width: size, height: size, data };
}
