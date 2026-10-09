"use client";

import type { SelectedBuilding } from "../map-explorer";

// Selecting a building zooms the map to it, at least this far in. Floor
// plans are meant to show from here on.
export const FLOOR_PLAN_MIN_ZOOM = 17;

// WP5's mount point for floor plans, rendered by <MapExplorer> with the
// building the user selected. Nothing is drawn yet: the plans themselves
// come from the MPrint extraction pipeline (scripts/mprint).
//
// The plan for this component: read the building's listed floor_plans rows
// that have corners, and draw the chosen floor's image from the floor-plans
// bucket as an image source at those corners (MapLibre's order: top-left,
// top-right, bottom-right, bottom-left, each [lng, lat]), with a raster
// layer at minzoom FLOOR_PLAN_MIN_ZOOM and beforeId={SLOTS.floorPlans}, so it
// sits on FO's campus detail and under the basemap labels. Room zones and the
// floor switcher come after that.
export function FloorPlanLayers({ building }: { building: SelectedBuilding | null }) {
  void building;
  return null;
}
