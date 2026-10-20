import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARRIVAL_DWELL_MS,
  buildingAt,
  dwellReady,
  pointInFootprint,
  readArrivalLog,
  wasPromptedToday,
  withArrivalPrompt,
  writeArrivalLog,
  type ArrivalBuilding,
} from "./arrival.ts";

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

function memory() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("arrival (K4 / SOS-162)", () => {
  it("treats a footprint hit as inside, including holes", () => {
    const point = { latitude: 42.272, longitude: -83.735 };
    assert.equal(pointInFootprint(point, square), true);
    assert.equal(pointInFootprint({ latitude: 42.275, longitude: -83.735 }, square), false);
    assert.equal(pointInFootprint(point, { type: "Feature", geometry: square }), true);
    assert.equal(
      pointInFootprint(point, { type: "MultiPolygon", coordinates: [square.coordinates] }),
      true,
    );
  });

  it("uses the footprint before the 40 m radius", () => {
    const inside = { latitude: 42.272, longitude: -83.735 };
    const buildings: ArrivalBuilding[] = [
      { slug: "far", name: "Far", lat: inside.latitude, lng: inside.longitude, footprint: null },
      { slug: "here", name: "Here", lat: 42.29, lng: -83.8, footprint: square },
    ];
    assert.equal(buildingAt(inside, buildings)?.slug, "here");
  });

  it("matches a building within 40 m when it has no footprint", () => {
    const point = { latitude: 42.2756, longitude: -83.7372 };
    const near: ArrivalBuilding = { slug: "near", name: "Near", lat: 42.27575, lng: -83.7372, footprint: null };
    const far: ArrivalBuilding = { slug: "far", name: "Far", lat: 42.277, lng: -83.7372, footprint: null };
    assert.equal(buildingAt(point, [far, near])?.slug, "near");
    assert.equal(buildingAt(point, [far]), null);
  });

  it("needs a full minute in the building", () => {
    assert.equal(dwellReady(null, 1_000), false);
    assert.equal(dwellReady(0, ARRIVAL_DWELL_MS - 1), false);
    assert.equal(dwellReady(0, ARRIVAL_DWELL_MS), true);
  });

  it("remembers one prompt per building for the Detroit day", () => {
    const storage = memory();
    assert.equal(wasPromptedToday(readArrivalLog(storage), "shapiro", "2026-10-20"), false);
    writeArrivalLog(withArrivalPrompt({ union: "2026-10-19", hatcher: "2026-10-20" }, "shapiro", "2026-10-20"), storage);
    const log = readArrivalLog(storage);
    assert.equal(wasPromptedToday(log, "shapiro", "2026-10-20"), true);
    assert.equal(wasPromptedToday(log, "hatcher", "2026-10-20"), true);
    assert.equal(log.union, undefined);
    assert.equal(wasPromptedToday(log, "shapiro", "2026-10-21"), false);
  });

  it("ignores storage that throws or isn't a log", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.deepEqual(readArrivalLog(broken), {});
    assert.doesNotThrow(() => writeArrivalLog({ shapiro: "2026-10-20" }, broken));
    assert.deepEqual(readArrivalLog({ getItem: () => "[]" }), {});
  });
});
