import assert from "node:assert/strict";
import test from "node:test";
import { distanceMeters, pointInGeometry, pointInPolygon } from "./geo.ts";
import { isInsideBuilding } from "./location/index.ts";

test("a point is inside a ring and not outside it", () => {
  const square = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ] as const;
  assert.equal(pointInPolygon({ lng: 1, lat: 1 }, [square]), true);
  assert.equal(pointInPolygon({ lng: 3, lat: 1 }, [square]), false);
  assert.equal(pointInPolygon({ lng: 1, lat: 1 }, [[[0, 0], [1, 1]]]), false);
});

test("distance is zero at one point and about 1.11 km per 0.01 degree of latitude", () => {
  const shapiro = { lat: 42.2756, lng: -83.7372 };
  assert.equal(distanceMeters(shapiro, shapiro), 0);
  const north = distanceMeters(shapiro, { lat: shapiro.lat + 0.01, lng: shapiro.lng });
  assert.ok(north > 1100 && north < 1120, `expected about 1112 m, got ${north}`);
  const east = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(east > 111_000 && east < 111_400, `expected about 111195 m, got ${east}`);
});

const square = {
  type: "Polygon",
  coordinates: [
    [
      [-83.74, 42.27],
      [-83.73, 42.27],
      [-83.73, 42.28],
      [-83.74, 42.28],
      [-83.74, 42.27],
    ],
    [
      [-83.736, 42.274],
      [-83.734, 42.274],
      [-83.734, 42.276],
      [-83.736, 42.276],
      [-83.736, 42.274],
    ],
  ],
};

test("a point inside the footprint is inside, including a Feature wrapper", () => {
  const point = { lat: 42.272, lng: -83.735 };
  assert.equal(pointInGeometry(point, square), true);
  assert.equal(pointInGeometry(point, { type: "Feature", geometry: square }), true);
});

test("a MultiPolygon hole excludes the courtyard", () => {
  const holed = { type: "MultiPolygon", coordinates: [square.coordinates] };
  assert.equal(pointInGeometry({ lat: 42.272, lng: -83.735 }, holed), true);
  assert.equal(pointInGeometry({ lat: 42.275, lng: -83.735 }, holed), false);
});

test("outside the footprint is outside even within 60 m of the building point", () => {
  const point = { latitude: 42.272, longitude: -83.735 };
  const elsewhere = {
    type: "Polygon",
    coordinates: [
      [
        [-83.7, 42.3],
        [-83.69, 42.3],
        [-83.69, 42.31],
        [-83.7, 42.31],
        [-83.7, 42.3],
      ],
    ],
  };
  assert.equal(
    isInsideBuilding(point, { lat: point.latitude, lng: point.longitude, footprint: elsewhere }),
    false,
  );
});

test("no footprint counts as inside within 60 m and outside past it", () => {
  const point = { latitude: 42.2756, longitude: -83.7372 };
  assert.equal(isInsideBuilding(point, { lat: 42.27575, lng: -83.7372 }), true);
  assert.equal(isInsideBuilding(point, { lat: 42.277, lng: -83.7372 }), false);
  assert.equal(isInsideBuilding(point, { lat: point.latitude, lng: point.longitude, footprint: square }), true);
});
