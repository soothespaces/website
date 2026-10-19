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
