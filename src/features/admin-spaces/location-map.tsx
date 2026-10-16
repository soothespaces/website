"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/features/map/campus-map.css";
import { useMemo } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { TaggableFloor } from "@/features/admin-photos/data";
import { mapStyleUrl } from "@/features/map/config";
import { FloorPlanLayers } from "@/features/map/layers/floor-plans";
import { LayerSlots, SLOTS } from "@/features/map/slots";
import { useMapColors } from "@/features/map/use-map-colors";
import { useResolvedTheme } from "@/lib/use-resolved-theme";
import type { Ring, SpaceLocation } from "./space";

export type PlaceMode = "rooms" | "area" | "pin";

const ROOMS_LAYER = "floor-plan-rooms";

// Where a space is, on one floor of its building. With a vector floor plan,
// "rooms" toggles the clicked room and "area" adds a corner to the outline
// being drawn; "pin" (the only mode without a plan) moves the space's map
// pin. The pin can always be dragged.
export default function LocationMap({
  building,
  plan,
  mode,
  locations,
  draft,
  pin,
  onRoom,
  onCorner,
  onPin,
}: {
  building: { slug: string; lat: number | null; lng: number | null };
  plan: TaggableFloor | null;
  mode: PlaceMode;
  /** This floor's locations. */
  locations: SpaceLocation[];
  /** Corners of the area being drawn. */
  draft: Ring;
  pin: [number, number] | null;
  onRoom: (roomNumber: string) => void;
  onCorner: (point: [number, number]) => void;
  onPin: (point: [number, number]) => void;
}) {
  const theme = useResolvedTheme();
  const colors = useMapColors();
  const floorPlan = useMemo(
    () => (plan ? { building: building.slug, floor: plan.floor, geojson: plan.geojson, labeled: plan.labeled } : null),
    [building.slug, plan],
  );
  const initialViewState = useMemo(() => {
    if (plan) return { bounds: boundsOf(plan.corners), fitBoundsOptions: { padding: 24 } };
    const [lng, lat] = pin ?? [building.lng ?? -83.7382, building.lat ?? 42.2808];
    return { longitude: lng, latitude: lat, zoom: 18 };
    // Only where the map starts; it's keyed by building and floor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, building]);

  const rooms = locations.flatMap((l) => (l.roomNumber ? [l.roomNumber] : []));
  const shapes = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        ...locations.flatMap((l) =>
          l.area
            ? [{ type: "Feature" as const, properties: { kind: "area" }, geometry: { type: "Polygon" as const, coordinates: [[...l.area, l.area[0]]] } }]
            : [],
        ),
        ...(draft.length > 1
          ? [{ type: "Feature" as const, properties: { kind: "draft" }, geometry: { type: "LineString" as const, coordinates: draft } }]
          : []),
      ],
    }),
    [locations, draft],
  );

  function onClick(event: MapLayerMouseEvent) {
    const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
    if (mode === "pin") return onPin(point);
    if (mode === "area") return onCorner(point);
    const number = event.features?.find((f) => f.layer.id === ROOMS_LAYER)?.properties?.roomNumber;
    if (typeof number === "string" && number) onRoom(number);
  }

  return (
    <div className="relative h-[60dvh] min-h-80 overflow-hidden rounded-md border border-input bg-muted" data-map-theme={theme}>
      <Map
        key={`${building.slug}/${plan?.floor ?? "none"}`}
        mapLib={maplibregl}
        mapStyle={mapStyleUrl(theme)}
        initialViewState={initialViewState}
        maxZoom={22}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxPitch={0}
        interactiveLayerIds={plan ? [ROOMS_LAYER] : []}
        cursor={mode === "rooms" ? undefined : "crosshair"}
        onClick={onClick}
        onLoad={(event) => {
          const map = event.target;
          map.touchZoomRotate.disableRotation();
          map.doubleClickZoom.disable();
          map.on("styleimagemissing", ({ id }) => {
            if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
          });
        }}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <LayerSlots />
        <FloorPlanLayers plan={floorPlan} colors={colors} />
        {plan && rooms.length ? (
          <Layer
            id="space-rooms"
            type="fill"
            source="floor-plan"
            filter={["in", ["get", "roomNumber"], ["literal", rooms]]}
            paint={{ "fill-color": colors.primary, "fill-opacity": 0.4 }}
            beforeId={SLOTS.floorPlans}
          />
        ) : null}
        <Source id="space-shapes" type="geojson" data={shapes}>
          <Layer
            id="space-areas"
            type="fill"
            filter={["==", ["get", "kind"], "area"]}
            paint={{ "fill-color": colors.primary, "fill-opacity": 0.3 }}
            beforeId={SLOTS.overlays}
          />
          <Layer
            id="space-area-lines"
            type="line"
            paint={{ "line-color": colors.primary, "line-width": 2 }}
            beforeId={SLOTS.overlays}
          />
        </Source>
        {draft.map(([lng, lat], index) => (
          <Marker key={index} longitude={lng} latitude={lat}>
            <span aria-hidden className="block size-2.5 rounded-full border-2 border-white bg-primary shadow" />
          </Marker>
        ))}
        {pin ? (
          <Marker longitude={pin[0]} latitude={pin[1]} anchor="bottom" draggable onDragEnd={(e) => onPin([e.lngLat.lng, e.lngLat.lat])}>
            <span title="The space's pin on the map. Drag to move it." className="flex cursor-grab flex-col items-center">
              <span className="size-5 rounded-full border-2 border-white bg-primary shadow" />
              <span className="-mt-0.5 h-2 w-0.5 bg-primary" />
            </span>
          </Marker>
        ) : null}
      </Map>
    </div>
  );
}

function boundsOf(corners: [number, number][]): [number, number, number, number] {
  const lngs = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
