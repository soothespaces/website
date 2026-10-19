import type { Database } from "@/types/supabase";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BuildingLocationTarget {
  latitude: number;
  longitude: number;
}

/** A campus building row, or any object that carries `lat` / `lng`. */
export type BuildingLatLng = Pick<Database["public"]["Tables"]["buildings"]["Row"], "lat" | "lng">;

/**
 * Either `{ latitude, longitude }` or `{ lat, lng }`. Building rows and
 * geolocation results both satisfy this.
 */
export type GeoPoint = {
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export type LocationPermissionStatus = "pre_prompt" | "granted" | "denied" | "unsupported";

/**
 * Permission names the check-in hook exposes. `pre_prompt` is `prompt` here,
 * and a browser without geolocation is `unknown`.
 */
export type HookLocationPermission = "unknown" | "prompt" | "granted" | "denied";

export interface OneShotPositionResult {
  ok: boolean;
  coords?: Coordinates;
  accuracyMeters?: number;
  timestamp?: number;
  status: LocationPermissionStatus;
  errorMessage?: string;
}

const PRE_PROMPT_STORAGE_KEY = "soothespaces:location-pre-prompt-acknowledged";
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * A position counts as inside a building when it is within this many meters
 * of the building's coordinates. 60 m covers a typical campus footprint
 * without reaching the next building over.
 */
export const INSIDE_BUILDING_RADIUS_METERS = 60;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function readGeoPoint(point: GeoPoint | BuildingLatLng | null | undefined): Coordinates | null {
  if (!point || typeof point !== "object") return null;
  const latitude = "latitude" in point && typeof point.latitude === "number" ? point.latitude : point.lat;
  const longitude = "longitude" in point && typeof point.longitude === "number" ? point.longitude : point.lng;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Computes the great-circle Haversine distance in meters between two lat/lng points.
 */
export function haversineDistanceMeters(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates distance in meters from the user's position to a building.
 * Returns null if either coordinate pair is missing or invalid.
 * Accepts `{ latitude, longitude }` and building records with `lat` / `lng`.
 */
export function distanceToBuildingMeters(
  userCoords: GeoPoint | BuildingLatLng | null | undefined,
  building: GeoPoint | BuildingLatLng | null | undefined,
): number | null {
  const from = readGeoPoint(userCoords);
  const to = readGeoPoint(building);
  if (!from || !to) return null;
  return Math.round(haversineDistanceMeters(from, to));
}

/** Same inputs as {@link distanceToBuildingMeters}, named for building rows. */
export function distanceToBuildingRecord(
  userCoords: GeoPoint | null | undefined,
  building: BuildingLatLng | null | undefined,
): number | null {
  return distanceToBuildingMeters(userCoords, building);
}

export function findNearestBuilding<T extends GeoPoint | BuildingLatLng>(
  userCoords: GeoPoint | BuildingLatLng | null | undefined,
  buildings: readonly T[],
): T | null {
  let nearest: T | null = null;
  let nearestMeters = Number.POSITIVE_INFINITY;
  for (const building of buildings) {
    const meters = distanceToBuildingMeters(userCoords, building);
    if (meters == null || meters >= nearestMeters) continue;
    nearest = building;
    nearestMeters = meters;
  }
  return nearest;
}

export function isInsideBuilding(
  userCoords: GeoPoint | BuildingLatLng | null | undefined,
  building: GeoPoint | BuildingLatLng | null | undefined,
  radiusMeters = INSIDE_BUILDING_RADIUS_METERS,
): boolean {
  const meters = distanceToBuildingMeters(userCoords, building);
  return meters != null && meters <= radiusMeters;
}

export function toHookPermission(status: LocationPermissionStatus): HookLocationPermission {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  if (status === "unsupported") return "unknown";
  return "prompt";
}

/**
 * Returns whether the user has already acknowledged our custom pre-prompt explanation (K1).
 */
export function hasAcknowledgedLocationPrePrompt(
  storage: Pick<Storage, "getItem"> | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
): boolean {
  try {
    return storage?.getItem(PRE_PROMPT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Marks the custom location pre-prompt explanation (K1) as acknowledged.
 */
export function markLocationPrePromptAcknowledged(
  storage: Pick<Storage, "setItem"> | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
): void {
  try {
    storage?.setItem(PRE_PROMPT_STORAGE_KEY, "true");
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

/**
 * Inspects the current geolocation permission state without triggering the browser prompt.
 * If the browser permission state is "prompt", returns "pre_prompt" so UI (K1, H6) knows
 * to show our explanation before calling requestOneShotPosition().
 */
export async function getLocationPermissionState(): Promise<LocationPermissionStatus> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return "unsupported";
  }

  if ("permissions" in navigator && typeof navigator.permissions?.query === "function") {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      if (status.state === "granted") return "granted";
      if (status.state === "denied") return "denied";
      return "pre_prompt";
    } catch {
      return "pre_prompt";
    }
  }

  return "pre_prompt";
}

/**
 * Requests a single GPS/Wi-Fi position fix from the browser.
 * One-shot `getCurrentPosition` — never `watchPosition`.
 */
export function requestOneShotPosition(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 60_000,
  },
): Promise<OneShotPositionResult> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve({
      ok: false,
      status: "unsupported",
      errorMessage: "Geolocation is not supported in this browser.",
    });
  }

  markLocationPrePromptAcknowledged();

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracyMeters: position.coords.accuracy,
          timestamp: position.timestamp,
          status: "granted",
        });
      },
      (error) => {
        const isDenied = error.code === error.PERMISSION_DENIED;
        resolve({
          ok: false,
          status: isDenied ? "denied" : "pre_prompt",
          errorMessage: error.message || "Unable to retrieve your location.",
        });
      },
      options,
    );
  });
}
