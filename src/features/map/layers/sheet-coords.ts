import type { Corners } from "@/features/floor-alignment/geometry";

// Maps a pixel on an MPrint sheet to longitude/latitude with the same
// four-corner homography scripts/mprint/geom.py uses (top-left, top-right,
// bottom-right, bottom-left).

type Mat3 = [number, number, number, number, number, number, number, number, number];

function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = Array<number>(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] =
        a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out as Mat3;
}

function invert(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const D = c * h - b * i;
  const E = a * i - c * g;
  const F = b * g - a * h;
  const G = b * f - c * e;
  const H = c * d - a * f;
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (!det) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
}

function normalize(points: [number, number][]) {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  cx /= points.length;
  cy /= points.length;
  let distance = 0;
  for (const [x, y] of points) distance += Math.hypot(x - cx, y - cy);
  distance /= points.length;
  const scale = distance ? Math.SQRT2 / distance : 1;
  const transform: Mat3 = [scale, 0, -scale * cx, 0, scale, -scale * cy, 0, 0, 1];
  const out = points.map(([x, y]) => [scale * (x - cx), scale * (y - cy)] as [number, number]);
  return { transform, out };
}

function solve(rows: number[][], values: number[]): number[] {
  const size = values.length;
  const matrix = rows.map((row, index) => [...row, values[index]]);
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    }
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const divisor = matrix[col][col];
    if (Math.abs(divisor) < 1e-12) throw new Error("Sheet homography is singular.");
    for (let cell = col; cell <= size; cell++) matrix[col][cell] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = matrix[row][col];
      for (let cell = col; cell <= size; cell++) matrix[row][cell] -= factor * matrix[col][cell];
    }
  }
  return matrix.map((row) => row[size]);
}

function homography(src: [number, number][], dst: [number, number][]): Mat3 {
  const from = normalize(src);
  const to = normalize(dst);
  const rows: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < from.out.length; index++) {
    const [x, y] = from.out[index];
    const [u, v] = to.out[index];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const h = solve(rows, values);
  const normalized: Mat3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  const composed = multiply(invert(to.transform), multiply(normalized, from.transform));
  const scale = composed[8] || 1;
  return composed.map((value) => value / scale) as Mat3;
}

export function applyHomography(transform: Mat3, x: number, y: number): [number, number] {
  const weight = transform[6] * x + transform[7] * y + transform[8];
  return [
    (transform[0] * x + transform[1] * y + transform[2]) / weight,
    (transform[3] * x + transform[4] * y + transform[5]) / weight,
  ];
}

/** Where sheet pixel (x, y) lands. `corners` follow MapLibre image order. */
export function pixelToLngLat(corners: Corners, width: number, height: number, x: number, y: number): [number, number] {
  const transform = homography(
    [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ],
    corners,
  );
  return applyHomography(transform, x, y);
}

export type Ring = [number, number][];

export function parseRing(value: unknown): Ring | null {
  if (!Array.isArray(value)) return null;
  const ring: Ring = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lng, lat] = point;
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    ring.push([lng, lat]);
  }
  return ring.length >= 3 ? ring : null;
}

/** A space_locations.area value: an open ring, or a GeoJSON polygon. */
export function parseArea(value: unknown): Ring | null {
  if (Array.isArray(value)) return parseRing(value);
  if (!value || typeof value !== "object") return null;
  const geometry = value as { type?: string; coordinates?: unknown };
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) return parseRing(geometry.coordinates[0]);
  return null;
}

export function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if (xi === xj && yi === yj) continue;
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function ringCentroid(ring: Ring): [number, number] {
  const unique = ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of unique) {
    lng += x;
    lat += y;
  }
  return [lng / unique.length, lat / unique.length];
}

type Geometry = { type?: string; coordinates?: unknown };

export function outerRing(geometry: Geometry | null | undefined): Ring | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) return parseRing(geometry.coordinates[0]);
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    let best: Ring | null = null;
    for (const polygon of geometry.coordinates) {
      if (!Array.isArray(polygon)) continue;
      const ring = parseRing(polygon[0]);
      if (ring && (!best || ring.length > best.length)) best = ring;
    }
    return best;
  }
  return null;
}
