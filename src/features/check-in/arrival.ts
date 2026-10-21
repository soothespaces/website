import { distanceMeters } from "@/lib/geo";
import { isInsideBuilding } from "@/lib/location";

// Arrival (K4 / SOS-162): inside a building for a minute, at most once per
// building per day. "Inside" is the shared footprint-or-60 m test.

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

/** The nearest building the visitor is inside, or null. */
export function buildingAt(point: ArrivalPoint, buildings: readonly ArrivalBuilding[]): ArrivalBuilding | null {
  const inside = buildings.filter((building) =>
    isInsideBuilding(
      { latitude: point.latitude, longitude: point.longitude },
      { lat: building.lat, lng: building.lng, footprint: building.footprint },
    ),
  );
  if (inside.length === 0) return null;
  return closest(point, inside);
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
