import assert from "node:assert/strict";
import test from "node:test";
import { distanceMeters } from "./geo.ts";

test("distance is zero at one point and about 1.11 km per 0.01 degree of latitude", () => {
  const shapiro = { lat: 42.2756, lng: -83.7372 };
  assert.equal(distanceMeters(shapiro, shapiro), 0);
  const north = distanceMeters(shapiro, { lat: shapiro.lat + 0.01, lng: shapiro.lng });
  assert.ok(north > 1100 && north < 1120, `expected about 1112 m, got ${north}`);
  const east = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(east > 111_000 && east < 111_400, `expected about 111195 m, got ${east}`);
});
