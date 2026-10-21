export type LatLng = { lat: number; lng: number };

function ringContains(point: LatLng, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index];
    const prior = ring[previous];
    if (!current || !prior || current.length < 2 || prior.length < 2) continue;
    const xi = current[0]!;
    const yi = current[1]!;
    const xj = prior[0]!;
    const yj = prior[1]!;
    const crosses = yi > point.lat !== yj > point.lat;
    if (!crosses) continue;
    const xAtLat = ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (point.lng < xAtLat) inside = !inside;
  }
  return inside;
}

/** GeoJSON Polygon coordinates: the outer ring, then any holes. Rings are `[lng, lat]`. */
export function pointInPolygon(
  point: LatLng,
  coordinates: readonly (readonly (readonly number[])[])[],
): boolean {
  if (coordinates.length === 0) return false;
  const [outer, ...holes] = coordinates;
  if (!outer || !ringContains(point, outer)) return false;
  return holes.every((hole) => !ringContains(point, hole));
}

/** True when `geometry` is a GeoJSON geometry, Feature, or FeatureCollection that contains `point`. */
export function pointInGeometry(point: LatLng, geometry: unknown): boolean {
  if (!geometry || typeof geometry !== "object") return false;
  const record = geometry as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown };
  if (record.type === "Feature") return pointInGeometry(point, record.geometry);
  if (record.type === "FeatureCollection" && Array.isArray(record.features)) {
    return record.features.some((feature) => pointInGeometry(point, feature));
  }
  if (record.type === "Polygon" && Array.isArray(record.coordinates)) {
    return pointInPolygon(point, record.coordinates as number[][][]);
  }
  if (record.type === "MultiPolygon" && Array.isArray(record.coordinates)) {
    return record.coordinates.some(
      (polygon) => Array.isArray(polygon) && pointInPolygon(point, polygon as number[][][]),
    );
  }
  return false;
}

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Distance in meters between two map points. Shared by printer "nearby"
 * checks and, later, restroom points.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
