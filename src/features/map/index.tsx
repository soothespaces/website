"use client";

import dynamic from "next/dynamic";
import { MapProvider, useMap } from "react-map-gl/maplibre";
import { CAMPUS_MAP_ID } from "./config";

// MapLibre needs the browser (WebGL, window), so the map only renders on
// the client.
export const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
    >
      Loading map…
    </div>
  ),
});

// Wrap the map and anything that needs its instance (panels, overlays).
export const CampusMapProvider = MapProvider;

// The campus map's MapRef, or undefined until it has mounted. Call
// .getMap() on it for the raw MapLibre instance.
export function useCampusMap() {
  return useMap()[CAMPUS_MAP_ID];
}
