import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceToBuildingMeters,
  getLocationPermissionState,
  hasAcknowledgedLocationPrePrompt,
  haversineDistanceMeters,
  markLocationPrePromptAcknowledged,
  requestOneShotPosition,
  toCoordinates,
} from "./index.ts";

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
  assert.equal(await getLocationPermissionState(), "unsupported");
  const position = await requestOneShotPosition();
  assert.equal(position.ok, false);
  assert.equal(position.status, "unsupported");
});
