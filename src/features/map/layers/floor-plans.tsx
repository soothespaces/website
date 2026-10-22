"use client";

import { useEffect, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import { SLOTS } from "../slots";
import type { FloorPlan } from "../use-floor-index";
import type { MapColors } from "../use-map-colors";
import { FloorBookableLayer } from "./floor-bookable";
import { FloorNoiseGlyphLayer, FloorNoiseLayer, useFloorColoring } from "./floor-noise";
import { FloorPrintersLayer } from "./floor-printers";
import { FLOOR_ROOM_LINES } from "./floor-layer-ids";
import { FloorStaffLayer } from "./floor-staff";

// Selecting a building zooms the map to it, at least this far in. Floor
// plans show from here on.
export const FLOOR_PLAN_MIN_ZOOM = 17;

// Room numbers only fit once rooms are a few pixels across.
const LABEL_MIN_ZOOM = 18;

// The campus map stops at zoom 19. Shapiro's shortest study room is about
// 25px tall there, so the glyph has to be small enough to sit under the
// room number without leaving the room.
const NOISE_GLYPH_MIN_ZOOM = 19;

// The font of the basemap's own labels. Glyphs come from the style's font
// server, which only has the fonts its style uses, and each style names
// them differently, so borrow one from a label layer that's already there.
function useLabelFont() {
  const map = useMap().current?.getMap();
  const [font, setFont] = useState<string[] | null>(null);
  useEffect(() => {
    if (!map) return;
    const update = () => {
      for (const id of map.getLayersOrder()) {
        const layer = map.getLayer(id);
        if (layer?.type !== "symbol") continue;
        const value = map.getLayoutProperty(id, "text-font");
        // Plain lists only; an expression can't be reused out of context.
        if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
          setFont((current) => (current?.join() === value.join() ? current : value));
          return;
        }
      }
    };
    update();
    map.on("styledata", update);
    return () => {
      map.off("styledata", update);
    };
  }, [map]);
  return font;
}

// One floor of a building, drawn from the vector floor plan the MPrint
// pipeline made (public/floor-plans/<building>/<floor>.geojson): walls and
// structure, rooms on top, then room numbers or names when zoomed in. Sits
// in SLOTS.floorPlans, over FO's campus detail and under the basemap
// labels and the overlays.
export function FloorPlanLayers({
  plan,
  colors,
  availability = false,
}: {
  plan: FloorPlan | null;
  colors: MapColors;
  // Rooms map paints free and booked instead, so noise and stripes stay off.
  availability?: boolean;
}) {
  const font = useLabelFont();
  const coloring = useFloorColoring(plan);
  if (!plan) return null;
  const id = `floor-plan`;
  return (
    <>
      {/* Keyed by URL so switching floors swaps the data in place. */}
      <Source key={plan.geojson} id={id} type="geojson" data={coloring.planData ?? plan.geojson}>
      <Layer
        id={`${id}-structure`}
        type="fill"
        minzoom={FLOOR_PLAN_MIN_ZOOM - 1}
        filter={["==", ["get", "layer"], "structure"]}
        paint={{ "fill-color": colors["muted-foreground"], "fill-opacity": 0.85 }}
        beforeId={SLOTS.floorPlans}
      />
      <Layer
        id={`${id}-rooms`}
        type="fill"
        minzoom={FLOOR_PLAN_MIN_ZOOM - 1}
        filter={["==", ["get", "layer"], "room"]}
        paint={{ "fill-color": colors.card, "fill-opacity": 0.92 }}
        beforeId={SLOTS.floorPlans}
      />
      <Layer
        id={FLOOR_ROOM_LINES}
        type="line"
        minzoom={FLOOR_PLAN_MIN_ZOOM - 1}
        filter={["==", ["get", "layer"], "room"]}
        paint={{
          "line-color": colors.foreground,
          "line-width": ["interpolate", ["linear"], ["zoom"], 16, 1, 19, 1.75],
        }}
        beforeId={SLOTS.floorPlans}
      />
      <FloorStaffLayer
        colors={colors}
        minzoom={FLOOR_PLAN_MIN_ZOOM - 1}
        building={plan.building}
        floor={plan.floor}
      />
      {/* Direct children of Source. A fragment would swallow the source id
          and these layers would never mount. */}
      {availability ? null : (
        <FloorNoiseLayer colors={colors} minzoom={FLOOR_PLAN_MIN_ZOOM - 1} byNoise={coloring.byNoise} />
      )}
      {availability ? null : <FloorBookableLayer minzoom={FLOOR_PLAN_MIN_ZOOM - 1} rooms={coloring.bookableRooms} />}
      {availability ? null : <FloorNoiseGlyphLayer colors={colors} minzoom={NOISE_GLYPH_MIN_ZOOM} />}
      {font ? (
        <Layer
          id={`${id}-labels`}
          type="symbol"
          minzoom={LABEL_MIN_ZOOM}
          filter={["all", ["==", ["get", "layer"], "room"], ["has", "roomNumber"]]}
          layout={{
            "text-field": ["coalesce", ["get", "roomName"], ["get", "roomNumber"]],
            "text-font": font,
            "text-size": ["interpolate", ["linear"], ["zoom"], LABEL_MIN_ZOOM, 10, 19, 12],
            "text-max-width": 6,
            // Labels collide, and a lower rank is placed first. Tagged and
            // bookable rooms keep their number; stairs and staff give way.
            "text-padding": 4,
            "text-allow-overlap": false,
            "symbol-sort-key": ["coalesce", ["get", "labelRank"], 3],
          }}
          paint={{
            "text-color": colors.foreground,
            "text-halo-color": colors.card,
            "text-halo-width": 1.25,
          }}
          beforeId={SLOTS.overlays}
        />
      ) : null}
    </Source>
    <FloorPrintersLayer plan={plan} rooms={coloring.rooms} />
    </>
  );
}
