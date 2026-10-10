"use client";

import { MapProvider, useMap } from "react-map-gl/maplibre";
import { CAMPUS_MAP_ID } from "./config";

export { CampusMap } from "./lazy-campus-map";

// The whole map page: dock or phone search, the map and the selection panel.
export { MapLayout } from "./map-layout";

// What the map shows (campus detail, entrances, buildings, study spaces,
// floor plans and the layers panel). Render it as <CampusMap>'s child,
// inside <MapStateProvider>.
export { MapExplorer } from "./map-explorer";
export { MapStateProvider, useMapState } from "./map-state";

// Wrap the map and anything that needs its instance (panels, overlays).
export const CampusMapProvider = MapProvider;

// The campus map's MapRef, or undefined until it has mounted. Call
// .getMap() on it for the raw MapLibre instance.
export function useCampusMap() {
  return useMap()[CAMPUS_MAP_ID];
}
