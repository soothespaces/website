import { distanceMeters } from "@/lib/geo";

// Arrival (K4 / SOS-162): inside a footprint, or within about 40 m of the
// building point, for a minute, at most once per building per day.

export const ARRIVAL_RADIUS_METERS = 40;
export const ARRIVAL_DWELL_MS = 60_000;

const ARRIVAL_KEY = "soothespaces:arrival-prompted";

export type ArrivalPoint = { latitude: number; longitude: number };

export type ArrivalBuilding = {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  footprint: unknown;
};

export type ArrivalLog = Record<string, string>;

type Reader = Pick<Storage, "getItem"> | undefined;
type Writer = Pick<Storage, "setItem"> | undefined;

export function dwellReady(startedAt: number | null, now: number, dwellMs = ARRIVAL_DWELL_MS): boolean {
  return startedAt != null && now - startedAt >= dwellMs;
}

function ringContains(point: ArrivalPoint, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index];
    const prior = ring[previous];
    if (!current || !prior || current.length < 2 || prior.length < 2) continue;
    const xi = current[0]!;
    const yi = current[1]!;
    const xj = prior[0]!;
    const yj = prior[1]!;
    const crosses = yi > point.latitude !== yj > point.latitude;
    if (!crosses) continue;
    const xAtLat = ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
    if (point.longitude < xAtLat) inside = !inside;
  }
  return inside;
}

function polygonContains(point: ArrivalPoint, coordinates: unknown): boolean {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  const [outer, ...holes] = coordinates as number[][][];
  if (!outer || !ringContains(point, outer)) return false;
  return holes.every((hole) => !ringContains(point, hole));
}

function geometryContains(point: ArrivalPoint, geometry: unknown): boolean {
  if (!geometry || typeof geometry !== "object") return false;
  const record = geometry as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown };
  if (record.type === "Feature") return geometryContains(point, record.geometry);
  if (record.type === "FeatureCollection" && Array.isArray(record.features)) {
    return record.features.some((feature) => geometryContains(point, feature));
  }
  if (record.type === "Polygon") return polygonContains(point, record.coordinates);
  if (record.type === "MultiPolygon" && Array.isArray(record.coordinates)) {
    return record.coordinates.some((polygon) => polygonContains(point, polygon));
  }
  return false;
}

export function pointInFootprint(point: ArrivalPoint, footprint: unknown): boolean {
  return geometryContains(point, footprint);
}

function metersTo(point: ArrivalPoint, building: ArrivalBuilding): number | null {
  if (building.lat == null || building.lng == null) return null;
  return distanceMeters({ lat: point.latitude, lng: point.longitude }, { lat: building.lat, lng: building.lng });
}

function closest(point: ArrivalPoint, buildings: readonly ArrivalBuilding[]): ArrivalBuilding {
  let best = buildings[0]!;
  let bestMeters = metersTo(point, best);
  for (const building of buildings.slice(1)) {
    const meters = metersTo(point, building);
    if (bestMeters == null || (meters != null && meters < bestMeters)) {
      best = building;
      bestMeters = meters;
    }
  }
  return best;
}

/** The building the user is standing in, or null when they aren't near one. */
export function buildingAt(point: ArrivalPoint, buildings: readonly ArrivalBuilding[]): ArrivalBuilding | null {
  const inside = buildings.filter((building) => pointInFootprint(point, building.footprint));
  if (inside.length > 0) return closest(point, inside);
  let nearest: ArrivalBuilding | null = null;
  let nearestMeters = ARRIVAL_RADIUS_METERS;
  for (const building of buildings) {
    const meters = metersTo(point, building);
    if (meters == null || meters > nearestMeters) continue;
    nearest = building;
    nearestMeters = meters;
  }
  return nearest;
}

export function readArrivalLog(storage: Reader): ArrivalLog {
  try {
    const raw = storage?.getItem(ARRIVAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const log: ArrivalLog = {};
    for (const [slug, date] of Object.entries(parsed)) {
      if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) log[slug] = date;
    }
    return log;
  } catch {
    return {};
  }
}

export function wasPromptedToday(log: ArrivalLog, slug: string, today: string): boolean {
  return log[slug] === today;
}

/** Keeps today's marks and adds this building. Older days are dropped. */
export function withArrivalPrompt(log: ArrivalLog, slug: string, today: string): ArrivalLog {
  const next: ArrivalLog = {};
  for (const [key, date] of Object.entries(log)) {
    if (date === today) next[key] = date;
  }
  next[slug] = today;
  return next;
}

export function writeArrivalLog(log: ArrivalLog, storage: Writer): void {
  try {
    storage?.setItem(ARRIVAL_KEY, JSON.stringify(log));
  } catch {
    // Quota or private browsing. The sheet can still open this once.
  }
}

export function browserArrivalStore(): { getItem: Storage["getItem"]; setItem: Storage["setItem"] } | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
