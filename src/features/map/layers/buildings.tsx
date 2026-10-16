"use client";

import { Layer } from "react-map-gl/maplibre";
import { SLOTS } from "../slots";
import type { MapColors } from "../use-map-colors";
import { FO_BUILDINGS_SOURCE } from "./campus-detail";

// Clicks on a building land on this layer. It's transparent rather than
// hidden, because hidden layers can't be clicked, and it doesn't depend on
// the campus detail being shown.
export const BUILDINGS_HIT_LAYER = "buildings-hit";

// Building footprints from FO's buildings layer (FO_BUILDINGS_SOURCE, loaded
// by <CampusDetailLayers>), and an outline around the selected one. Render
// after <CampusDetailLayers>, which adds the source.
export function BuildingLayers({
  selectedRecordNumber,
  colors,
}: {
  // FO's loc_ObjectNum for the selected building.
  selectedRecordNumber: string | null;
  colors: MapColors;
}) {
  return (
    <>
      <Layer
        id={BUILDINGS_HIT_LAYER}
        type="fill"
        source={FO_BUILDINGS_SOURCE}
        paint={{ "fill-color": "#000000", "fill-opacity": 0 }}
        beforeId={SLOTS.overlays}
      />
      <Layer
        id="building-selected-fill"
        type="fill"
        source={FO_BUILDINGS_SOURCE}
        filter={["==", ["get", "loc_ObjectNum"], selectedRecordNumber ?? ""]}
        paint={{ "fill-color": colors.primary, "fill-opacity": 0.12 }}
        beforeId={SLOTS.overlays}
      />
      <Layer
        id="building-selected-outline"
        type="line"
        source={FO_BUILDINGS_SOURCE}
        filter={["==", ["get", "loc_ObjectNum"], selectedRecordNumber ?? ""]}
        layout={{ "line-join": "round" }}
        paint={{
          "line-color": colors.primary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 19, 4],
        }}
        beforeId={SLOTS.overlays}
      />
    </>
  );
}
