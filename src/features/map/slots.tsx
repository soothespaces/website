"use client";

import { useEffect, useState } from "react";
import { Layer, useMap } from "react-map-gl/maplibre";

// Named positions in the layer stack. Each slot is an invisible layer;
// features add their layers with beforeId={SLOTS.x}, which puts them just
// under that slot's marker, so bands stay in this order (bottom to top) no
// matter which component mounts first:
//
//   basemap land, roads, buildings
//   campusDetail   FO's campus basemap (lawns, sidewalks, buildings, trees)
//   floorPlans     floor-plan images and room zones (WP5)
//   basemap labels
//   overlays       entrances, curb ramps, the selected building's outline
//
// Study-space pins are DOM markers, so they sit above every layer.
export const SLOTS = {
  campusDetail: "slot-campus-detail",
  floorPlans: "slot-floor-plans",
  overlays: "slot-overlays",
} as const;

// Render once inside <CampusMap>, before any layer that uses a slot.
export function LayerSlots() {
  const map = useMap().current?.getMap();
  // Re-render on every style change, before the layers that use the slots
  // (parents render first), so a new style gets its slots in place first.
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!map) return;
    const update = () => setVersion((v) => v + 1);
    map.on("styledata", update);
    return () => {
      map.off("styledata", update);
    };
  }, [map]);

  // The lower slots go under the basemap's first label layer. Each style
  // names its layers differently, so it's looked up from the current one.
  const firstLabel = map?.getLayersOrder().find((id) => map.getLayer(id)?.type === "symbol");

  return (
    <>
      <Layer id={SLOTS.campusDetail} type="background" layout={{ visibility: "none" }} beforeId={firstLabel} />
      <Layer id={SLOTS.floorPlans} type="background" layout={{ visibility: "none" }} beforeId={firstLabel} />
      <Layer id={SLOTS.overlays} type="background" layout={{ visibility: "none" }} />
    </>
  );
}
