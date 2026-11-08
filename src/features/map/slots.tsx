"use client";

import { useEffect, useState } from "react";
import { Layer, useMap } from "react-map-gl/maplibre";
import { basemapLayersToLower, campusDetailBeforeId, floorPlanBeforeId, type StackLayer } from "./layer-order";

// Named positions in the layer stack. Each slot is an invisible layer;
// features add their layers with beforeId={SLOTS.x}, which puts them just
// under that slot's marker, so bands stay in this order (bottom to top) no
// matter which component mounts first:
//
//   basemap land, roads, buildings
//   campusDetail   FO's campus basemap (lawns, sidewalks, buildings, trees)
//   buildingColors footprints colored by study-space count, and the cross
//   floorPlans     floor-plan images and room zones, above building footprints
//   basemap labels
//   overlays       entrances, curb ramps, the selected building's outline
//
// Study-space pins are DOM markers, so they sit above every layer.
export const SLOTS = {
  campusDetail: "slot-campus-detail",
  // Its own band, so a study color that loads after the floor plan still
  // goes under it.
  buildingColors: "slot-building-colors",
  floorPlans: "slot-floor-plans",
  overlays: "slot-overlays",
} as const;

type StyleMap = NonNullable<ReturnType<typeof useMap>["current"]> extends { getMap(): infer M } ? M : never;

function stackOf(map: StyleMap): StackLayer[] {
  return map.getLayersOrder().map((id) => {
    const layer = map.getLayer(id);
    const source = layer?.source ? map.getSource(layer.source) : undefined;
    return { id, type: layer?.type ?? "", sourceType: source?.type };
  });
}

// Render once inside <CampusMap>, before any layer that uses a slot.
export function LayerSlots() {
  const map = useMap().current?.getMap();
  // Re-render on every style change, before the layers that use the slots
  // (parents render first), so a new style gets its slots in place first.
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!map) return;
    const update = () => {
      // Basemap labels above basemap fills first (QA-013). Moving a layer
      // fires styledata again, and by then there is nothing left to move.
      const move = basemapLayersToLower(stackOf(map));
      if (move) for (const id of move.ids) map.moveLayer(id, move.beforeId);
      setVersion((v) => v + 1);
    };
    if (map.isStyleLoaded()) update();
    map.on("styledata", update);
    return () => {
      map.off("styledata", update);
    };
  }, [map]);

  // Campus detail stays under the first symbol so it doesn't cover labels.
  // The floor plan goes above the highest basemap fill or line, which is
  // under every basemap label once the effect above has lowered the dark
  // style's late fills. Our own labels (room numbers, the outline) are in
  // the overlays band.
  const order = map ? stackOf(map) : [];
  const firstLabel = campusDetailBeforeId(order);
  const floorPlanAnchor = floorPlanBeforeId(order);

  return (
    <>
      <Layer id={SLOTS.campusDetail} type="background" layout={{ visibility: "none" }} beforeId={firstLabel} />
      <Layer id={SLOTS.buildingColors} type="background" layout={{ visibility: "none" }} beforeId={floorPlanAnchor} />
      <Layer id={SLOTS.floorPlans} type="background" layout={{ visibility: "none" }} beforeId={floorPlanAnchor} />
      <Layer id={SLOTS.overlays} type="background" layout={{ visibility: "none" }} />
    </>
  );
}
