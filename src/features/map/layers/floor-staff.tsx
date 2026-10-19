"use client";

import { Layer } from "react-map-gl/maplibre";
import { SLOTS } from "../slots";
import type { MapColors } from "../use-map-colors";
import { STAFF_ROOM_FILTER } from "./floor-staff-rooms";

export const FLOOR_STAFF_LAYER = "floor-plan-staff";

// Flat grey over staff, office, storage and mechanical rooms. Sits on the
// floor-plan source, above the white room fill and under the room outlines,
// so study rooms are unchanged.
//
// The plan GeoJSON has no use field, only `layer`, `roomNumber` and sometimes
// `roomName` (see scripts/mprint/pipeline.py and scripts/mprint/room_names.py).
// A `use` or `roomName` that says staff, office, storage or mechanical paints
// grey. Otherwise Shapiro floor 2's nonpublic rooms do: 2178/2178A (Learning
// Programs), 2166 (conference), 2024 and 2024A/B (staff space east of Askwith),
// and 2026 plus 2026A/C/D/E/F (staff space above the computing site). Letter
// classes (2C, 2S, 2E, 2V) and restrooms (2030M men's, 2036W women's) stay
// the default fill. The list lives in ./floor-staff-rooms.ts.
// <Source> stamps its id onto direct children. Forward it; a fill with no
// source never gets added.
export function FloorStaffLayer({
  colors,
  minzoom,
  source,
}: {
  colors: MapColors;
  minzoom: number;
  // Set by <Source> via cloneElement. Absent until that source exists.
  source?: string;
}) {
  if (!source) return null;
  return (
    <Layer
      id={FLOOR_STAFF_LAYER}
      type="fill"
      source={source}
      minzoom={minzoom}
      filter={STAFF_ROOM_FILTER}
      paint={{ "fill-color": colors["floor-staff"], "fill-opacity": 1 }}
      beforeId={SLOTS.floorPlans}
    />
  );
}
