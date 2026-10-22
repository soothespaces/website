export const NOT_STUDY_PATTERN = "not-study-cross";

// An X on a transparent ground, so the building's own color shows between
// the strokes. The period divides the tile and the cross continues across edges.
const PERIOD = 16;
const WIDTH = 2;

function onCross(x: number, y: number) {
  const slash = (x + y) % PERIOD;
  const back = (x - y + PERIOD * 2) % PERIOD;
  return slash < WIDTH || back < WIDTH;
}

export function notStudyCrossImage(color: string): { width: number; height: number; data: Uint8Array } {
  const size = PERIOD * 2;
  const data = new Uint8Array(size * size * 4);
  const value = Number.parseInt(color.slice(1), 16);
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!onCross(x, y)) continue;
      const index = (y * size + x) * 4;
      data[index] = rgb[0] ?? 0;
      data[index + 1] = rgb[1] ?? 0;
      data[index + 2] = rgb[2] ?? 0;
      data[index + 3] = 200;
    }
  }
  return { width: size, height: size, data };
}
