export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BuildingLocationTarget {
  latitude: number;
  longitude: number;
}

/** A `buildings` or `spaces` coordinate pair. `lat` / `lng` may be null. */
export type LatLng = {
  lat: number | null;
  lng: number | null;
};

/** A GPS fix (`latitude` / `longitude`) or a database `lat` / `lng` pair. */
export type GeoPoint = Coordinates | LatLng;

export type LocationPermissionStatus = "pre_prompt" | "granted" | "denied" | "unsupported";

/** Names `useLocation().permission` exposes. `pre_prompt` is `prompt`; no geolocation is `unknown`. */
export type HookLocationPermission = "unknown" | "prompt" | "granted" | "denied";

/**
 * A position counts as inside a building within this many meters of its
 * coordinates. 60 m covers a typical campus footprint without reaching the next building.
 */
export const INSIDE_BUILDING_RADIUS_METERS = 60;

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

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Reads either `{ latitude, longitude }` or a record's `{ lat, lng }`.
 * Returns null when either component is missing or not finite.
 */
export function toCoordinates(point: GeoPoint | null | undefined): Coordinates | null {
  if (!point) return null;

  if ("latitude" in point) {
    const { latitude, longitude } = point;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }

  const { lat, lng } = point;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
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
 * Accepts a GPS fix or a `buildings` row (`lat` / `lng`).
 * Returns null if either coordinate pair is missing or invalid.
 */
export function distanceToBuildingMeters(
  userCoords: GeoPoint | null | undefined,
  building: GeoPoint | null | undefined,
): number | null {
  const from = toCoordinates(userCoords);
  const to = toCoordinates(building);
  if (!from || !to) return null;
  return Math.round(haversineDistanceMeters(from, to));
}

/** The building with the shortest finite distance, or null when none can be measured. */
export function findNearestBuilding<T extends GeoPoint>(
  userCoords: GeoPoint | null | undefined,
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
  userCoords: GeoPoint | null | undefined,
  building: GeoPoint | null | undefined,
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
 * Inspects geolocation permission without triggering the browser prompt.
 * "prompt" comes back as "pre_prompt" so the check-in screen can explain
 * the request first. A missing Permissions API is "unsupported" (`useLocation`
 * shows that as "unknown").
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
      return "unsupported";
    }
  }

  return "unsupported";
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
