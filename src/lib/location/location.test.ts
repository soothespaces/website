import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceToBuildingMeters,
  findNearestBuilding,
  getLocationPermissionState,
  hasAcknowledgedLocationPrePrompt,
  haversineDistanceMeters,
  INSIDE_BUILDING_RADIUS_METERS,
  isInsideBuilding,
  markLocationPrePromptAcknowledged,
  requestOneShotPosition,
  toCoordinates,
  toHookPermission,
} from "./index.ts";
import { useLocation } from "./use-location.ts";

test("distance between Shapiro Library and East Quad is a short walk", () => {
  const shapiro = { latitude: 42.27587, longitude: -83.73725 };
  const eastQuad = { latitude: 42.27302, longitude: -83.73517 };

  const rawMeters = haversineDistanceMeters(shapiro, eastQuad);
  const roundedMeters = distanceToBuildingMeters(shapiro, eastQuad);

  assert.ok(rawMeters > 330);
  assert.ok(rawMeters < 390);
  assert.equal(roundedMeters, Math.round(rawMeters));
});

test("distanceToBuildingMeters returns null when coordinates are missing or not finite", () => {
  assert.equal(distanceToBuildingMeters(null, { latitude: 42.27, longitude: -83.73 }), null);
  assert.equal(
    distanceToBuildingMeters(
      { latitude: Number.NaN, longitude: -83.73 },
      { latitude: 42.27, longitude: -83.73 },
    ),
    null,
  );
});

test("distanceToBuildingMeters accepts a building row's lat/lng", () => {
  const shapiro = { slug: "shapiro", name: "Shapiro Library", lat: 42.27587, lng: -83.73725 };
  const eastQuad = { lat: 42.27302, lng: -83.73517 };
  const viaColumns = distanceToBuildingMeters(eastQuad, shapiro);
  const viaFix = distanceToBuildingMeters(
    { latitude: eastQuad.lat, longitude: eastQuad.lng },
    { latitude: shapiro.lat, longitude: shapiro.lng },
  );

  assert.equal(viaColumns, viaFix);
  assert.equal(toCoordinates({ lat: null, lng: -83.73 }), null);
  assert.equal(distanceToBuildingMeters(eastQuad, { lat: null, lng: -83.73 }), null);
});

test("pre-prompt acknowledgement is stored on the provided storage", () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  assert.equal(hasAcknowledgedLocationPrePrompt(mockStorage), false);
  markLocationPrePromptAcknowledged(mockStorage);
  assert.equal(hasAcknowledgedLocationPrePrompt(mockStorage), true);
});

test("a storage failure leaves the pre-prompt unacknowledged", () => {
  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };

  assert.equal(hasAcknowledgedLocationPrePrompt(broken), false);
  assert.doesNotThrow(() => markLocationPrePromptAcknowledged(broken));
});

test("geolocation helpers report unsupported where the browser API is missing", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  try {
    assert.equal(await getLocationPermissionState(), "unsupported");
    const position = await requestOneShotPosition();
    assert.equal(position.ok, false);
    assert.equal(position.status, "unsupported");
    assert.equal(toHookPermission("unsupported"), "unknown");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
  }
});

test("nearest building and the 60 m inside radius", () => {
  const shapiro = { slug: "shapiro", lat: 42.27587, lng: -83.73725 };
  const eastQuad = { slug: "east-quad", lat: 42.27302, lng: -83.73517 };
  const buildings = [{ slug: "missing", lat: null, lng: null }, eastQuad, shapiro];
  const here = { latitude: shapiro.lat, longitude: shapiro.lng };

  assert.equal(INSIDE_BUILDING_RADIUS_METERS, 60);
  assert.equal(findNearestBuilding(here, buildings)?.slug, "shapiro");
  assert.equal(isInsideBuilding(here, shapiro), true);
  assert.equal(isInsideBuilding(here, eastQuad), false);
  assert.equal(isInsideBuilding(null, shapiro), false);
});

test("permission is read without prompting, and one fix reports granted or denied", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let state: PermissionState = "granted";
  let watches = 0;
  const getCurrentPosition = (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ) => {
    if (state === "denied") {
      error?.({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "denied",
      } as GeolocationPositionError);
      return;
    }
    success({
      coords: {
        latitude: 42.27587,
        longitude: -83.73725,
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
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition,
        watchPosition: () => {
          watches += 1;
        },
      },
      permissions: {
        query: async () => ({ state }),
      },
    },
  });

  try {
    assert.equal(await getLocationPermissionState(), "granted");
    assert.equal(watches, 0);
    state = "denied";
    assert.equal(await getLocationPermissionState(), "denied");
    state = "prompt";
    assert.equal(await getLocationPermissionState(), "pre_prompt");
    assert.equal(toHookPermission("pre_prompt"), "prompt");

    state = "granted";
    const granted = await requestOneShotPosition();
    assert.equal(granted.ok, true);
    assert.equal(granted.status, "granted");
    assert.equal(granted.coords?.latitude, 42.27587);
    assert.equal(granted.accuracyMeters, 12);
    assert.equal(watches, 0);

    state = "denied";
    const denied = await requestOneShotPosition();
    assert.equal(denied.ok, false);
    assert.equal(denied.status, "denied");
    assert.equal(denied.errorMessage, "denied");
    assert.equal(watches, 0);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition,
          watchPosition: () => {
            watches += 1;
          },
        },
        permissions: { query: async () => Promise.reject(new Error("no permissions")) },
      },
    });
    assert.equal(await getLocationPermissionState(), "unsupported");
    assert.equal(toHookPermission(await getLocationPermissionState()), "unknown");
    assert.equal(watches, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
  }
});

test("useLocation is the check-in hook", () => {
  assert.equal(typeof useLocation, "function");
});
