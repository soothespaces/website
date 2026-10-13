"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/features/map/campus-map.css";
import { useMemo, useRef } from "react";
import Map, { Layer, Marker, NavigationControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { mapStyleUrl } from "@/features/map/config";
import { FloorPlanLayers } from "@/features/map/layers/floor-plans";
import { LayerSlots, SLOTS } from "@/features/map/slots";
import { useMapColors } from "@/features/map/use-map-colors";
import { useResolvedTheme } from "@/lib/use-resolved-theme";
import type { TaggableFloor } from "./data";

export type TagMode = "room" | "spot";

const ROOMS_LAYER = "floor-plan-rooms";

// One floor's vector plan on the map. In room mode a click picks the room;
// in spot mode it drops a pin where the photo was taken (drag to adjust),
// and the room under the pin comes along with it.
export default function FloorTagger({
  buildingSlug,
  floor,
  mode,
  roomNumber,
  spot,
  heading,
  onPick,
}: {
  buildingSlug: string;
  floor: TaggableFloor;
  mode: TagMode;
  roomNumber: string | null;
  spot: [number, number] | null;
  heading: number | null;
  onPick: (pick: { roomNumber: string | null; spot: [number, number] | null }) => void;
}) {
  const theme = useResolvedTheme();
  const colors = useMapColors();
  const mapRef = useRef<MapRef>(null);
  const bounds = useMemo(() => boundsOf(floor.corners), [floor.corners]);
  const plan = useMemo(
    () => ({ building: buildingSlug, floor: floor.floor, geojson: floor.geojson, labeled: floor.labeled }),
    [buildingSlug, floor],
  );

  function roomAt(event: MapLayerMouseEvent) {
    const room = event.features?.find((f) => f.layer.id === ROOMS_LAYER);
    const number = room?.properties?.roomNumber;
    return typeof number === "string" && number ? number : null;
  }

  function onClick(event: MapLayerMouseEvent) {
    const room = roomAt(event);
    if (mode === "room") {
      if (room) onPick({ roomNumber: room, spot: null });
      return;
    }
    onPick({ roomNumber: room, spot: [event.lngLat.lng, event.lngLat.lat] });
  }

  function onDragEnd(lngLat: { lng: number; lat: number }) {
    const map = mapRef.current?.getMap();
    const features = map?.queryRenderedFeatures(map.project(lngLat), { layers: [ROOMS_LAYER] }) ?? [];
    const number = features[0]?.properties?.roomNumber;
    onPick({ roomNumber: typeof number === "string" && number ? number : null, spot: [lngLat.lng, lngLat.lat] });
  }

  return (
    <div className="relative h-[60dvh] min-h-80 overflow-hidden rounded-md border border-input bg-muted" data-map-theme={theme}>
      <Map
        key={`${buildingSlug}/${floor.floor}`}
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={mapStyleUrl(theme)}
        initialViewState={{ bounds, fitBoundsOptions: { padding: 24 } }}
        maxZoom={22}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxPitch={0}
        interactiveLayerIds={[ROOMS_LAYER]}
        cursor={mode === "spot" ? "crosshair" : undefined}
        onClick={onClick}
        onLoad={(event) => {
          const map = event.target;
          map.touchZoomRotate.disableRotation();
          map.on("styleimagemissing", ({ id }) => {
            if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
          });
        }}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <LayerSlots />
        <FloorPlanLayers plan={plan} colors={colors} />
        {roomNumber ? (
          <Layer
            id="tagged-room"
            type="fill"
            source="floor-plan"
            filter={["==", ["get", "roomNumber"], roomNumber]}
            paint={{ "fill-color": colors.primary, "fill-opacity": 0.35 }}
            beforeId={SLOTS.floorPlans}
          />
        ) : null}
        {spot ? (
          <Marker
            longitude={spot[0]}
            latitude={spot[1]}
            draggable
            onDragEnd={(event) => onDragEnd(event.lngLat)}
          >
            <SpotPin heading={heading} />
          </Marker>
        ) : null}
      </Map>
    </div>
  );
}

function SpotPin({ heading }: { heading: number | null }) {
  return (
    <span className="relative block size-6 cursor-grab" title="Drag to move the spot">
      {heading != null ? (
        <svg
          viewBox="0 0 48 48"
          className="absolute -inset-3 size-12 text-primary"
          style={{ transform: `rotate(${heading}deg)` }}
          aria-hidden
        >
          {/* A wedge pointing up (north) before rotation: the way the camera faced. */}
          <path d="M24 24 L14 2 A24 24 0 0 1 34 2 Z" fill="currentColor" opacity="0.45" />
        </svg>
      ) : null}
      <span className="absolute inset-0 rounded-full border-2 border-white bg-primary shadow" />
    </span>
  );
}

function boundsOf(corners: [number, number][]): [number, number, number, number] {
  const lngs = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
