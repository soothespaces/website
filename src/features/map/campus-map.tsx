"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ReactNode } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import { useResolvedTheme } from "@/lib/use-resolved-theme";
import {
  CAMPUS_BOUNDS,
  CAMPUS_INITIAL_VIEW,
  CAMPUS_MAP_ID,
  CAMPUS_MAX_ZOOM,
  CAMPUS_MIN_ZOOM,
  mapStyleUrl,
} from "./config";
import "./campus-map.css";

// The campus base map. Changing theme swaps the whole style, which drops
// anything added imperatively with map.addSource/addLayer. Add sources,
// layers and markers as react-map-gl children instead (<Source>, <Layer>,
// <Marker>); those are re-applied after every style change.
export default function CampusMap({ children }: { children?: ReactNode }) {
  const theme = useResolvedTheme();

  return (
    <div data-map-theme={theme} className="absolute inset-0 bg-muted">
      <Map
        id={CAMPUS_MAP_ID}
        mapLib={maplibregl}
        mapStyle={mapStyleUrl(theme)}
        initialViewState={CAMPUS_INITIAL_VIEW}
        minZoom={CAMPUS_MIN_ZOOM}
        maxZoom={CAMPUS_MAX_ZOOM}
        maxBounds={CAMPUS_BOUNDS}
        // North stays up: a rotating or tilting map is disorienting, and
        // the floor-plan overlay is aligned to a north-up view.
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxPitch={0}
        onLoad={(event) => {
          const map = event.target;
          map.touchZoomRotate.disableRotation();
          map.keyboard.disableRotation();
          // Some styles reference sprite images they don't ship (OpenFreeMap's
          // "wood-pattern"); a blank stand-in keeps the console quiet.
          map.on("styleimagemissing", ({ id }) => {
            if (!map.hasImage(id)) {
              map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
            }
          });
        }}
        locale={{ "Map.Title": "Campus map" }}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {children}
      </Map>
    </div>
  );
}
