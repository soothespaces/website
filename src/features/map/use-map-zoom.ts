"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-map-gl/maplibre";

// The map's zoom, updated when a zoom gesture ends. Use inside <CampusMap>.
export function useMapZoom() {
  const { current } = useMap();
  const map = current?.getMap();
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 0);

  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);

  return zoom;
}

// The highest zoom reached so far. Sources that load once the user zooms in
// stay loaded after zooming back out, so they aren't fetched twice.
export function useMaxZoomReached() {
  const zoom = useMapZoom();
  const [max, setMax] = useState(zoom);
  if (zoom > max) setMax(zoom);
  return Math.max(max, zoom);
}
