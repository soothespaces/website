"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { SLOTS } from "../slots";
import type { MapColors } from "../use-map-colors";
import type { Entrance } from "../use-map-data";
import { useMaxZoomReached } from "../use-map-zoom";

export const ENTRANCES_LAYER = "accessible-entrances";
const CURB_RAMPS_URL = "/campus-map/curb-ramps.geojson";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// Doors show from zoom 16, where a building's doors stop overlapping; curb
// ramps from 17, and their file (280 KB) is only fetched once the map gets
// there.
export const ENTRANCES_MIN_ZOOM = 16;
const CURB_RAMPS_MIN_ZOOM = 17;

const visibility = (visible: boolean) => (visible ? "visible" : "none");

// Accessible exterior doors from FO's campus map, from Supabase. Automatic
// doors are filled dots, manual ones are rings.
export function EntranceLayer({
  entrances,
  colors,
  visible,
}: {
  entrances: Entrance[];
  colors: MapColors;
  visible: boolean;
}) {
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: entrances.map((entrance) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [entrance.lng, entrance.lat] },
        properties: { id: entrance.id, automatic: entrance.automatic },
      })),
    }),
    [entrances],
  );

  return (
    <Source id="entrances" type="geojson" data={data}>
      <Layer
        id={ENTRANCES_LAYER}
        type="circle"
        minzoom={ENTRANCES_MIN_ZOOM}
        layout={{ visibility: visibility(visible) }}
        paint={{
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 16, 4, 19, 8],
          "circle-color": ["case", ["get", "automatic"], colors.primary, colors.card],
          "circle-stroke-color": colors.primary,
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 16, 1.5, 19, 2.5],
        }}
        beforeId={SLOTS.overlays}
      />
    </Source>
  );
}

// FO's curb ramps: short lines where a sidewalk meets the street.
export function CurbRampLayer({ colors, visible }: { colors: MapColors; visible: boolean }) {
  const zoom = useMaxZoomReached();
  return (
    <Source
      id="curb-ramps"
      type="geojson"
      data={zoom >= CURB_RAMPS_MIN_ZOOM ? CURB_RAMPS_URL : EMPTY}
      attribution="U-M Facilities & Operations"
    >
      <Layer
        id="curb-ramps"
        type="line"
        minzoom={CURB_RAMPS_MIN_ZOOM}
        layout={{ visibility: visibility(visible), "line-cap": "round" }}
        paint={{
          "line-color": colors.primary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 17, 3, 19, 6],
        }}
        beforeId={SLOTS.overlays}
      />
    </Source>
  );
}
