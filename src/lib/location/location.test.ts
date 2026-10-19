import { afterEach, describe, expect, it, vi } from "vitest";
import {
  distanceToBuildingMeters,
  distanceToBuildingRecord,
  findNearestBuilding,
  getLocationPermissionState,
  hasAcknowledgedLocationPrePrompt,
  haversineDistanceMeters,
  isInsideBuilding,
  markLocationPrePromptAcknowledged,
  requestOneShotPosition,
  toHookPermission,
} from "./index";

const shapiro = { latitude: 42.27587, longitude: -83.73725 };
const eastQuad = { latitude: 42.27302, longitude: -83.73517 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("location helper (F3.6 / SOS-115)", () => {
  it("calculates accurate distance between Shapiro Library and East Quad", () => {
    const rawMeters = haversineDistanceMeters(shapiro, eastQuad);
    const roundedMeters = distanceToBuildingMeters(shapiro, eastQuad);

    expect(rawMeters).toBeGreaterThan(330);
    expect(rawMeters).toBeLessThan(390);
    expect(roundedMeters).toBe(Math.round(rawMeters));
  });

  it("returns null when coordinates are missing or non-finite", () => {
    expect(distanceToBuildingMeters(null, { latitude: 42.27, longitude: -83.73 })).toBeNull();
    expect(
      distanceToBuildingMeters(
        { latitude: Number.NaN, longitude: -83.73 },
        { latitude: 42.27, longitude: -83.73 },
      ),
    ).toBeNull();
  });

  it("accepts building rows with lat and lng", () => {
    const fromLatLng = distanceToBuildingMeters(
      { lat: shapiro.latitude, lng: shapiro.longitude },
      { lat: eastQuad.latitude, lng: eastQuad.longitude, slug: "east-quad" },
    );
    expect(fromLatLng).toBe(distanceToBuildingMeters(shapiro, eastQuad));
    expect(
      distanceToBuildingRecord(
        { latitude: shapiro.latitude, longitude: shapiro.longitude },
        { lat: eastQuad.latitude, lng: eastQuad.longitude },
      ),
    ).toBe(fromLatLng);
  });

  it("picks the nearest building and treats 60 m as inside", () => {
    const buildings = [
      { slug: "missing", lat: null, lng: null },
      { slug: "far", lat: 42.29, lng: -83.75 },
      { slug: "here", lat: shapiro.latitude, lng: shapiro.longitude },
    ];

    expect(findNearestBuilding(shapiro, buildings)?.slug).toBe("here");
    expect(isInsideBuilding(shapiro, buildings[2])).toBe(true);
    expect(isInsideBuilding(shapiro, buildings[1])).toBe(false);
    expect(isInsideBuilding(null, buildings[2])).toBe(false);
  });

  it("persists pre-prompt acknowledgement in storage", () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
    };

    expect(hasAcknowledgedLocationPrePrompt(mockStorage)).toBe(false);
    markLocationPrePromptAcknowledged(mockStorage);
    expect(hasAcknowledgedLocationPrePrompt(mockStorage)).toBe(true);
  });

  it("reports unsupported when geolocation is missing and does not watch position", async () => {
    await expect(getLocationPermissionState()).resolves.toBe("unsupported");
    await expect(requestOneShotPosition()).resolves.toMatchObject({
      ok: false,
      status: "unsupported",
    });
    expect(toHookPermission("unsupported")).toBe("unknown");
  });

  it("reads granted, denied, and prompt without calling getCurrentPosition", async () => {
    const getCurrentPosition = vi.fn();
    const watchPosition = vi.fn();
    const query = vi.fn(async () => ({ state: "granted" as PermissionState }));
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition, watchPosition },
      permissions: { query },
    });

    await expect(getLocationPermissionState()).resolves.toBe("granted");
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();

    query.mockResolvedValueOnce({ state: "denied" });
    await expect(getLocationPermissionState()).resolves.toBe("denied");

    query.mockResolvedValueOnce({ state: "prompt" });
    await expect(getLocationPermissionState()).resolves.toBe("pre_prompt");
    expect(toHookPermission("pre_prompt")).toBe("prompt");

    query.mockRejectedValueOnce(new Error("unsupported permissions"));
    await expect(getLocationPermissionState()).resolves.toBe("pre_prompt");
  });

  it("takes one position fix and reports denied", async () => {
    const watchPosition = vi.fn();
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: shapiro.latitude,
          longitude: shapiro.longitude,
          accuracy: 12,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON() {
            return {};
          },
        },
        timestamp: 123,
        toJSON() {
          return {};
        },
      });
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition, watchPosition } });

    await expect(requestOneShotPosition()).resolves.toMatchObject({
      ok: true,
      status: "granted",
      coords: shapiro,
      accuracyMeters: 12,
      timestamp: 123,
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(watchPosition).not.toHaveBeenCalled();

    getCurrentPosition.mockImplementation((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "denied",
      } as GeolocationPositionError);
    });

    await expect(requestOneShotPosition()).resolves.toMatchObject({
      ok: false,
      status: "denied",
      errorMessage: "denied",
    });
    expect(watchPosition).not.toHaveBeenCalled();
  });
});
