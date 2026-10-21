"use client";

import { Layer } from "react-map-gl/maplibre";
import type { MapColors } from "../use-map-colors";
import { staffRoomFilter } from "./floor-staff-rooms";

export const FLOOR_STAFF_LAYER = "floor-plan-staff";
// Always on the plan, including the rooms map, where staff grey is replaced.
export const FLOOR_ROOM_LINES = "floor-plan-room-lines";

// Flat grey over staff, office, storage and mechanical rooms. Sits on the
// floor-plan source, above the white room fill and under the room outlines,
// so study rooms are unchanged.
//
// The plan GeoJSON has no use field, only `layer`, `roomNumber` and sometimes
// `roomName` (see scripts/mprint/pipeline.py and scripts/mprint/room_names.py).
// A `use` or `roomName` that says staff, office, storage or mechanical paints
// grey on every plan. Shapiro floor 2's nonpublic room numbers are extra,
// and only on that plan: 2178/2178A (Learning Programs), 2166 (conference),
// 2024 and 2024A/B (staff space east of Askwith), and 2026 plus
// 2026A/C/D/E/F (staff space above the computing site). The list is in
// ./floor-staff-rooms.ts.
export function FloorStaffLayer({
  colors,
  minzoom,
  building,
  floor,
  source,
}: {
  colors: MapColors;
  minzoom: number;
  building: string;
  floor: number;
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
      filter={staffRoomFilter(building, floor)}
      paint={{ "fill-color": colors["floor-staff"], "fill-opacity": 1 }}
      beforeId={FLOOR_ROOM_LINES}
    />
  );
}
