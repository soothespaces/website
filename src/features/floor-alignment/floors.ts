import "server-only";
import floorIndex from "../../../public/floor-plans/index.json";
import type { Corners } from "./geometry";

// public/floor-plans/index.json, written by scripts/mprint/pipeline.py.
export type FloorRecord = {
  building: string;
  /** The footprint's name in the U-M Facilities map ("Shapiro Library"). */
  buildingName: string;
  floor: number;
  sheet: string;
  sha256: string;
  width: number;
  height: number;
  /** Public path to the footprint GeoJSON the sheet was fitted to. */
  footprint: string;
  aligned: "auto" | "manual";
  corners: Corners;
  usable: boolean;
  fitMedianMeters: number;
  labeled: boolean;
  geojson: string | null;
  rooms?: number;
};

export const floors = floorIndex.floors as unknown as FloorRecord[];

/** A floor drawn on several sheets (Hatcher's two wings) has a record per sheet; `sheet` picks one. */
export function findFloor(building: string, floor: string, sheet?: string) {
  const onFloor = floors.filter((f) => f.building === building && String(f.floor) === floor);
  return (sheet && onFloor.find((f) => f.sheet === sheet)) || onFloor[0];
}

export function findSheet(sheet: string) {
  return floors.find((f) => f.sheet === sheet);
}

