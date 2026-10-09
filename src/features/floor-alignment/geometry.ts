// A floor-plan sheet placed on the map by a similarity transform: where its
// center sits, how many meters one pixel covers, and which way its top
// points. The map only needs the four corners (MapLibre image-source order:
// top-left, top-right, bottom-right, bottom-left); the editor works in these
// parameters so dragging a corner rotates and scales without skewing.

export type LngLat = [number, number];
export type Corners = [LngLat, LngLat, LngLat, LngLat];

export type Placement = {
  center: LngLat;
  metersPerPixel: number;
  /** Clockwise degrees from north to the sheet's top edge direction. */
  rotation: number;
};

// Same spherical frame as scripts/mprint/fit_outline.py (local_frame), so
// corners round-trip exactly between the pipeline and the editor.
const METERS_PER_DEGREE_LAT = 111_320;
const metersPerDegreeLng = (lat: number) => METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);

/** East/north meters from `origin`. Flat is fine at building scale. */
export function toLocal(origin: LngLat, point: LngLat): [number, number] {
  return [
    (point[0] - origin[0]) * metersPerDegreeLng(origin[1]),
    (point[1] - origin[1]) * METERS_PER_DEGREE_LAT,
  ];
}

export function fromLocal(origin: LngLat, [east, north]: [number, number]): LngLat {
  return [
    origin[0] + east / metersPerDegreeLng(origin[1]),
    origin[1] + north / METERS_PER_DEGREE_LAT,
  ];
}

/** Where sheet pixel (x, y) lands, in east/north meters from the center. */
function pixelOffset(p: Placement, width: number, height: number, x: number, y: number) {
  const t = (p.rotation * Math.PI) / 180;
  const dx = (x - width / 2) * p.metersPerPixel;
  const dy = (y - height / 2) * p.metersPerPixel;
  // Right along the sheet is (cos t, -sin t); up the sheet is (sin t, cos t).
  return [dx * Math.cos(t) - dy * Math.sin(t), -dx * Math.sin(t) - dy * Math.cos(t)] as [number, number];
}

export function cornersOf(p: Placement, width: number, height: number): Corners {
  const at = (x: number, y: number) => fromLocal(p.center, pixelOffset(p, width, height, x, y));
  return [at(0, 0), at(width, 0), at(width, height), at(0, height)];
}

/** The placement closest to four corners (the pipeline's fits are similarities already). */
export function placementOf(corners: Corners, width: number, height: number): Placement {
  const center: LngLat = [
    corners.reduce((sum, c) => sum + c[0], 0) / 4,
    corners.reduce((sum, c) => sum + c[1], 0) / 4,
  ];
  const [tl, tr, br, bl] = corners.map((c) => toLocal(center, c));
  // Average the top and bottom edges for direction, all four for scale.
  const right = [(tr[0] - tl[0] + br[0] - bl[0]) / 2, (tr[1] - tl[1] + br[1] - bl[1]) / 2];
  const down = [(bl[0] - tl[0] + br[0] - tr[0]) / 2, (bl[1] - tl[1] + br[1] - tr[1]) / 2];
  const metersPerPixel = (Math.hypot(right[0], right[1]) / width + Math.hypot(down[0], down[1]) / height) / 2;
  const rotation = (Math.atan2(-right[1], right[0]) * 180) / Math.PI;
  return { center, metersPerPixel, rotation: normalize(rotation) };
}

/**
 * The placement after dragging corner `index` to `to`, keeping the center:
 * the corner's distance from the center sets the scale and its bearing sets
 * the rotation.
 */
export function dragCorner(p: Placement, width: number, height: number, index: number, to: LngLat): Placement {
  const [x, y] = [[0, 0], [width, 0], [width, height], [0, height]][index];
  const [e, n] = toLocal(p.center, to);
  const base = pixelOffset({ ...p, metersPerPixel: 1, rotation: 0 }, width, height, x, y);
  const metersPerPixel = Math.hypot(e, n) / Math.hypot(base[0], base[1]);
  if (!(metersPerPixel > 0)) return p;
  const rotation = ((Math.atan2(base[1], base[0]) - Math.atan2(n, e)) * 180) / Math.PI;
  return { ...p, metersPerPixel, rotation: normalize(rotation) };
}

export function nudge(p: Placement, east: number, north: number): Placement {
  return { ...p, center: fromLocal(p.center, [east, north]) };
}

function normalize(degrees: number) {
  const d = ((degrees % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}
