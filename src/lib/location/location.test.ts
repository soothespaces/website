import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
} from "./index.ts";

const shapiro = { latitude: 42.27587, longitude: -83.73725 };
const eastQuad = { latitude: 42.27302, longitude: -83.73517 };

async function withNavigator<T>(value: unknown, run: () => Promise<T> | T): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value });
  try {
    return await run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
}

describe("location helper (F3.6 / SOS-115)", () => {
  it("calculates accurate distance between Shapiro Library and East Quad", () => {
    const rawMeters = haversineDistanceMeters(shapiro, eastQuad);
    const roundedMeters = distanceToBuildingMeters(shapiro, eastQuad);

    assert.ok(rawMeters > 330);
    assert.ok(rawMeters < 390);
    assert.equal(roundedMeters, Math.round(rawMeters));
  });

  it("returns null when coordinates are missing or non-finite", () => {
    assert.equal(distanceToBuildingMeters(null, { latitude: 42.27, longitude: -83.73 }), null);
    assert.equal(
      distanceToBuildingMeters(
        { latitude: Number.NaN, longitude: -83.73 },
        { latitude: 42.27, longitude: -83.73 },
      ),
      null,
    );
  });

  it("accepts building rows with lat and lng", () => {
    const fromLatLng = distanceToBuildingMeters(
      { lat: shapiro.latitude, lng: shapiro.longitude },
      { lat: eastQuad.latitude, lng: eastQuad.longitude, slug: "east-quad" },
    );
    assert.equal(fromLatLng, distanceToBuildingMeters(shapiro, eastQuad));
    assert.equal(
      distanceToBuildingRecord(
        { latitude: shapiro.latitude, longitude: shapiro.longitude },
        { lat: eastQuad.latitude, lng: eastQuad.longitude },
      ),
      fromLatLng,
    );
  });

  it("picks the nearest building and treats 60 m as inside", () => {
    const buildings = [
      { slug: "missing", lat: null, lng: null },
      { slug: "far", lat: 42.29, lng: -83.75 },
      { slug: "here", lat: shapiro.latitude, lng: shapiro.longitude },
    ];

    assert.equal(findNearestBuilding(shapiro, buildings)?.slug, "here");
    assert.equal(isInsideBuilding(shapiro, buildings[2]), true);
    assert.equal(isInsideBuilding(shapiro, buildings[1]), false);
    assert.equal(isInsideBuilding(null, buildings[2]), false);
  });

  it("persists pre-prompt acknowledgement in storage", () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
    };

    assert.equal(hasAcknowledgedLocationPrePrompt(mockStorage), false);
    markLocationPrePromptAcknowledged(mockStorage);
    assert.equal(hasAcknowledgedLocationPrePrompt(mockStorage), true);
  });

  it("reports unsupported when geolocation is missing", async () => {
    await withNavigator({}, async () => {
      assert.equal(await getLocationPermissionState(), "unsupported");
      const result = await requestOneShotPosition();
      assert.equal(result.ok, false);
      assert.equal(result.status, "unsupported");
    });
    assert.equal(toHookPermission("unsupported"), "unknown");
  });

  it("reads granted, denied, and prompt without calling getCurrentPosition", async () => {
    let positionCalls = 0;
    let watchCalls = 0;
    const states = ["granted", "denied", "prompt"] as const;
    let index = 0;
    let failNext = false;
    const query = async () => {
      if (failNext) throw new Error("unsupported permissions");
      const state = states[index] ?? "prompt";
      index += 1;
      return { state };
    };

    await withNavigator(
      {
        geolocation: {
          getCurrentPosition: () => {
            positionCalls += 1;
          },
          watchPosition: () => {
            watchCalls += 1;
          },
        },
        permissions: { query },
      },
      async () => {
        assert.equal(await getLocationPermissionState(), "granted");
        assert.equal(await getLocationPermissionState(), "denied");
        assert.equal(await getLocationPermissionState(), "pre_prompt");
        assert.equal(toHookPermission("pre_prompt"), "prompt");
        failNext = true;
        assert.equal(await getLocationPermissionState(), "pre_prompt");
        assert.equal(positionCalls, 0);
        assert.equal(watchCalls, 0);
      },
    );
  });

  it("takes one position fix and reports denied", async () => {
    let positionCalls = 0;
    let watchCalls = 0;
    let denied = false;
    const getCurrentPosition = (success: PositionCallback, error?: PositionErrorCallback) => {
      positionCalls += 1;
      if (!denied) {
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
        return;
      }
      error?.({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "denied",
      } as GeolocationPositionError);
    };

    await withNavigator(
      {
        geolocation: {
          getCurrentPosition,
          watchPosition: () => {
            watchCalls += 1;
          },
        },
      },
      async () => {
        const granted = await requestOneShotPosition();
        assert.equal(granted.ok, true);
        assert.equal(granted.status, "granted");
        assert.deepEqual(granted.coords, shapiro);
        assert.equal(granted.accuracyMeters, 12);
        assert.equal(granted.timestamp, 123);
        assert.equal(positionCalls, 1);
        assert.equal(watchCalls, 0);

        denied = true;
        const refused = await requestOneShotPosition();
        assert.equal(refused.ok, false);
        assert.equal(refused.status, "denied");
        assert.equal(refused.errorMessage, "denied");
        assert.equal(watchCalls, 0);
      },
    );
  });
});
