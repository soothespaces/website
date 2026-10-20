"use client";

import { useEffect, useState } from "react";
import type { FilterSpecification } from "maplibre-gl";
import { Layer, Marker, useMap } from "react-map-gl/maplibre";
import { PinIcon } from "@/components/ui/icons";
import { useRoomsData } from "@/features/side-view/rooms-map/rooms-data";
import { roomTitle } from "@/features/side-view/rooms-map/room-copy";
import { useMapState } from "../map-state";
import { SLOTS } from "../slots";
import type { MapColors } from "../use-map-colors";
import {
  geometryCenter,
  matchRoomFills,
  normalizeRoomNumber,
  propertyRoomNumber,
  sameRoom,
} from "./room-match";

export const ROOM_AVAILABILITY_HIT_LAYER = "floor-room-availability-hit";

const HATCH_IMAGE = "room-booked-hatch";

function numberFilter(numbers: readonly string[]): FilterSpecification | null {
  if (numbers.length === 0) return null;
  return [
    "all",
    ["==", ["get", "layer"], "room"],
    ["in", ["upcase", ["to-string", ["coalesce", ["get", "roomNumber"], ""]]], ["literal", [...numbers]]],
  ] as unknown as FilterSpecification;
}

function selectedFilter(roomId: string): FilterSpecification {
  return [
    "all",
    ["==", ["get", "layer"], "room"],
    ["==", ["upcase", ["to-string", ["coalesce", ["get", "roomNumber"], ""]]], roomId],
  ] as unknown as FilterSpecification;
}

// Cross-hatch on the booked red, the same read as the slot timeline's
// .slot-booked stripes. The image is the whole fill: MapLibre does not tint
// a pattern.
function hatchImage(fill: string, line: string) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = fill;
  context.fillRect(0, 0, size, size);
  context.strokeStyle = line;
  context.lineWidth = 2;
  context.beginPath();
  for (let offset = -size; offset <= size * 2; offset += 8) {
    context.moveTo(offset, 0);
    context.lineTo(offset + size, size);
    context.moveTo(offset, size);
    context.lineTo(offset + size, 0);
  }
  context.stroke();
  return context.getImageData(0, 0, size, size);
}

function useBookedHatch(fill: string, line: string) {
  const map = useMap().current?.getMap();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!map) return;
    // A style swap drops images added by hand. Adding one also emits
    // styledata, so a second pass has to leave an image that is already there.
    const paint = () => {
      if (map.hasImage(HATCH_IMAGE)) return;
      const image = hatchImage(fill, line);
      if (!image) return;
      map.addImage(HATCH_IMAGE, image, { pixelRatio: 2 });
      setReady(true);
    };
    if (map.hasImage(HATCH_IMAGE)) map.removeImage(HATCH_IMAGE);
    paint();
    map.on("styledata", paint);
    return () => {
      map.off("styledata", paint);
    };
  }, [map, fill, line]);
  return ready;
}

// Free rooms grey, booked rooms red with a white cross-hatch. Only mounted
// on the rooms-map route, so noise fills and staff grey stay off and the
// two states can be told apart. Other rooms keep the neutral floor fill.
export function FloorRoomAvailability({
  building,
  floor,
  minzoom,
  colors,
  source,
}: {
  building: string;
  floor: number;
  minzoom: number;
  colors: MapColors;
  source?: string;
}) {
  const { route } = useMapState();
  const { rooms } = useRoomsData();
  const patternReady = useBookedHatch(colors.destructive, colors["destructive-foreground"]);
  if (!source || route.kind !== "rooms-map" || route.slug !== building || route.floor !== floor) return null;

  const groups = matchRoomFills(rooms, floor);
  const selected = route.roomId ? (normalizeRoomNumber(route.roomId) ?? route.roomId) : null;
  const free = numberFilter(groups.free);
  const booked = numberFilter(groups.booked);
  const selectable = numberFilter(groups.selectable);
  const outline = selected ? selectedFilter(selected) : null;

  return (
    <>
      {selectable ? (
        <Layer
          id={ROOM_AVAILABILITY_HIT_LAYER}
          type="fill"
          source={source}
          minzoom={minzoom}
          filter={selectable}
          paint={{ "fill-color": colors.foreground, "fill-opacity": 0.01 }}
          beforeId={SLOTS.floorPlans}
        />
      ) : null}
      {free ? (
        <Layer
          id="floor-room-availability-free"
          type="fill"
          source={source}
          minzoom={minzoom}
          filter={free}
          paint={{ "fill-color": colors["slot-free"], "fill-opacity": 1 }}
          beforeId={SLOTS.floorPlans}
        />
      ) : null}
      {booked && patternReady ? (
        <Layer
          id="floor-room-availability-booked"
          type="fill"
          source={source}
          minzoom={minzoom}
          filter={booked}
          paint={{ "fill-pattern": HATCH_IMAGE, "fill-opacity": 1 }}
          beforeId={SLOTS.floorPlans}
        />
      ) : null}
      {outline ? (
        <Layer
          id="floor-room-availability-selected"
          type="line"
          source={source}
          minzoom={minzoom}
          filter={outline}
          paint={{
            "line-color": colors.foreground,
            "line-width": ["interpolate", ["linear"], ["zoom"], 16, 2.5, 19, 5],
          }}
          layout={{ "line-join": "round", "line-cap": "round" }}
          beforeId={SLOTS.floorPlans}
        />
      ) : null}
    </>
  );
}

const centerCache = new Map<string, Promise<Map<string, [number, number]>>>();

function loadCenters(url: string) {
  let pending = centerCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json() as Promise<{
          features: { properties?: { layer?: string; roomNumber?: unknown }; geometry?: { type: string; coordinates: unknown } }[];
        }>;
      })
      .then((plan) => {
        const centers = new Map<string, [number, number]>();
        for (const feature of plan.features) {
          if (feature.properties?.layer !== "room") continue;
          const key = normalizeRoomNumber(propertyRoomNumber(feature.properties.roomNumber));
          const center = geometryCenter(feature.geometry);
          if (key && center && !centers.has(key)) centers.set(key, center);
        }
        return centers;
      });
    pending.catch(() => centerCache.delete(url));
    centerCache.set(url, pending);
  }
  return pending;
}

function usePlanCenters(url: string) {
  const [centers, setCenters] = useState<Map<string, [number, number]>>(() => new Map());
  useEffect(() => {
    let cancelled = false;
    loadCenters(url)
      .then((next) => {
        if (!cancelled) setCenters(next);
      })
      .catch((error: unknown) => console.error("Floor plan rooms failed to load", error));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return centers;
}

// Dark label and pin above the selected room. Sits in the map, not the
// floor-plan source, so it stays above the fills.
export function RoomAvailabilityPin({ geojson }: { geojson: string }) {
  const { route } = useMapState();
  const { rooms } = useRoomsData();
  const centers = usePlanCenters(geojson);
  if (route.kind !== "rooms-map" || !route.roomId) return null;
  const key = normalizeRoomNumber(route.roomId) ?? route.roomId;
  const center = centers.get(key);
  if (!center) return null;
  const room = rooms.find((item) => sameRoom(item, route.roomId));
  const label = room ? roomTitle(room) : /^\d/.test(key) ? `Room ${key}` : key;
  return (
    <Marker
      longitude={center[0]}
      latitude={center[1]}
      anchor="bottom"
      className="pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <span className="flex flex-col items-center">
        <span className="rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-md">
          {label}
        </span>
        <PinIcon size="lg" className="text-foreground" />
      </span>
    </Marker>
  );
}
