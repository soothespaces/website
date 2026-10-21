"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Layer, useMap } from "react-map-gl/maplibre";
import type { FilterSpecification } from "maplibre-gl";
import { CHECK_IN_CONSENSUS_MIN } from "@/lib/data/attributes";
import {
  overviewMap,
  presentSummary,
  parseCheckInSummary,
  type CheckInSummary,
  type NoiseLevel,
} from "@/lib/data/check-ins";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";
import { FLOOR_ROOM_LINES } from "./floor-staff";
import type { FloorPlan } from "../use-floor-index";
import type { MapColors } from "../use-map-colors";
import {
  assignRoomNoise,
  bookableRoomNumbers,
  groupByNoise,
  LOUD_DOTS,
  loudDotImage,
  NOISE_FILL_OPACITY,
  NOISE_LEVELS,
  resolvedNoise,
  splitPlanRooms,
  type BookableRoomRef,
  type FloorSpace,
  type RoomPoint,
} from "./floor-noise-rooms";
import { geometryCenter } from "./room-match";
import { parseArea } from "./sheet-coords";

type NoiseToken = "noise-quiet" | "noise-low" | "noise-conversational" | "noise-loud";

const NOISE_TOKEN: Record<NoiseLevel, NoiseToken> = {
  quiet: "noise-quiet",
  low_noise: "noise-low",
  conversational: "noise-conversational",
  loud: "noise-loud",
};

export type FloorColoring = {
  byNoise: Record<NoiseLevel, string[]>;
  bookableRooms: string[];
  staffRooms: string[];
  otherRooms: string[];
  rooms: RoomPoint[];
  loaded: boolean;
};

const EMPTY_NOISE: Record<NoiseLevel, string[]> = { quiet: [], low_noise: [], conversational: [], loud: [] };

const EMPTY: FloorColoring = {
  byNoise: EMPTY_NOISE,
  bookableRooms: [],
  staffRooms: [],
  otherRooms: [],
  rooms: [],
  loaded: false,
};

type SpaceRow = {
  id: string;
  name: string;
  floor: number | null;
  noise_level: Database["public"]["Enums"]["noise_level"] | null;
  light_level: Database["public"]["Enums"]["light_level"] | null;
  features: Database["public"]["Enums"]["space_feature"][] | null;
  capacity: number | null;
  source: Database["public"]["Enums"]["space_source"];
  edited_fields: string[] | null;
  is_listed: boolean;
  locations: { floor: number; room_number: string | null; area: unknown }[] | null;
};

type BookableRow = {
  title: string;
  room_number: string | null;
  floor: number | null;
  space_id: string | null;
};

type PlanFeature = { properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } };

const cache = new Map<string, FloorColoring>();
const inflight = new Map<string, Promise<FloorColoring>>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(key: string, data: FloorColoring) {
  cache.set(key, data);
  inflight.delete(key);
  for (const listener of listeners) listener();
}

function useLoudDots(color: string) {
  const map = useMap().current?.getMap();
  const painted = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!map || !color) return;
    const add = () => {
      if (map.hasImage(LOUD_DOTS) && painted.current === color) {
        setReady(true);
        return;
      }
      if (map.hasImage(LOUD_DOTS)) map.removeImage(LOUD_DOTS);
      map.addImage(LOUD_DOTS, loudDotImage(color));
      painted.current = color;
      setReady(true);
    };
    add();
    map.on("styledata", add);
    return () => {
      map.off("styledata", add);
    };
  }, [map, color]);
  return ready;
}

function roomNumberFilter(rooms: readonly string[]): FilterSpecification {
  return [
    "all",
    ["==", ["get", "layer"], "room"],
    ["in", ["get", "roomNumber"], ["literal", [...rooms]]],
  ] as unknown as FilterSpecification;
}

function toSpace(row: SpaceRow, summary: CheckInSummary | null): FloorSpace {
  const features = row.features ?? [];
  const attributes = {
    noiseLevel: row.noise_level,
    lightLevel: row.light_level,
    features,
    capacity: row.capacity,
    source: row.source,
    editedFields: row.edited_fields ?? [],
  };
  return {
    id: row.id,
    name: row.name,
    listed: row.is_listed,
    floor: row.floor,
    noise: resolvedNoise(attributes, summary),
    bookable: features.includes("bookable"),
    locations: (row.locations ?? []).map((location) => ({
      floor: location.floor,
      roomNumber: location.room_number,
      area: parseArea(location.area),
    })),
  };
}

function roomsFromPlan(features: PlanFeature[]): RoomPoint[] {
  const rooms: RoomPoint[] = [];
  for (const feature of features) {
    if (feature.properties?.layer !== "room") continue;
    const number = feature.properties.roomNumber;
    if (typeof number !== "string" || !number.trim()) continue;
    const geometry = feature.geometry;
    const center = geometry?.type ? geometryCenter({ type: geometry.type, coordinates: geometry.coordinates }) : null;
    if (!center) continue;
    rooms.push({ roomNumber: number.trim(), lng: center[0], lat: center[1] });
  }
  return rooms;
}

async function loadFloorColoring(plan: FloorPlan): Promise<FloorColoring> {
  const env = getSupabaseEnv();
  const planResponse = await fetch(plan.geojson).catch(() => null);
  const collection = planResponse?.ok ? ((await planResponse.json()) as { features?: PlanFeature[] }) : null;
  const features = collection?.features ?? [];
  const rooms = roomsFromPlan(features);
  if (!env) {
    const split = splitPlanRooms(features.map((feature) => ({ properties: feature.properties ?? {} })), plan, new Map());
    return { byNoise: EMPTY_NOISE, bookableRooms: [], ...split, rooms, loaded: true };
  }

  const supabase = createClient();
  const [spaceRows, bookableRows] = await Promise.all([
    readAll<SpaceRow>((from, to) =>
      supabase
        .from("spaces")
        .select(
          "id, name, floor, noise_level, light_level, features, capacity, source, edited_fields, is_listed, locations:space_locations(floor, room_number, area)",
        )
        .eq("building_slug", plan.building)
        .order("name")
        .range(from, to),
    ),
    readAll<BookableRow>((from, to) =>
      supabase
        .from("bookable_items")
        .select("title, room_number, floor, space_id")
        .eq("building_slug", plan.building)
        .eq("is_listed", true)
        .eq("kind", "space")
        .order("room_number")
        .range(from, to),
    ),
  ]);

  // One overview for the campus, then a summary only for spaces that might
  // have a check-in consensus. Most floors have none, and a summary per space
  // would hold the colors back.
  const summaries = new Map<string, CheckInSummary | null>();
  const { data: overview } = await supabase.rpc("check_in_overview", { target_kind: "space" });
  const needsSummary = [...overviewMap(overview).values()].filter(
    (row) => row.checkInCount >= CHECK_IN_CONSENSUS_MIN && spaceRows.some((space) => space.id === row.targetId),
  );
  await Promise.all(
    needsSummary.map(async (row) => {
      const { data, error } = await supabase.rpc("check_in_summary", { target_kind: "space", target_id: row.targetId });
      summaries.set(row.targetId, error ? null : presentSummary(parseCheckInSummary(data)));
    }),
  );

  const spaces = spaceRows.map((row) => toSpace(row, summaries.get(row.id) ?? null));
  const bookable: BookableRoomRef[] = bookableRows.map((row) => ({
    title: row.title,
    roomNumber: row.room_number,
    floor: row.floor,
    spaceId: row.space_id,
  }));
  const noiseByRoom = assignRoomNoise({
    floor: plan.floor,
    spaces,
    bookable,
    rooms,
  });
  const drawn = new Map(rooms.map((room) => [room.roomNumber.toUpperCase(), room.roomNumber]));
  const stripes = bookableRoomNumbers(bookable, plan.floor).map((room) => drawn.get(room.toUpperCase()) ?? room);
  const split = splitPlanRooms(
    features.map((feature) => ({ properties: feature.properties ?? {} })),
    plan,
    noiseByRoom,
  );
  return {
    byNoise: groupByNoise(noiseByRoom),
    bookableRooms: stripes,
    ...split,
    rooms,
    loaded: true,
  };
}

const LOADED_EMPTY: FloorColoring = { ...EMPTY, loaded: true };

export function useFloorColoring(plan: FloorPlan | null): FloorColoring {
  const key = plan ? `${plan.building}:${plan.floor}:${plan.geojson}` : "";
  const coloring = useSyncExternalStore(
    subscribe,
    () => (key ? (cache.get(key) ?? EMPTY) : LOADED_EMPTY),
    () => (key ? EMPTY : LOADED_EMPTY),
  );

  useEffect(() => {
    if (!plan || !key || cache.has(key) || inflight.has(key)) return;
    const pending = loadFloorColoring(plan)
      .then((data) => {
        publish(key, data);
        return data;
      })
      .catch((error: unknown) => {
        console.error("Floor coloring failed to load", error);
        publish(key, LOADED_EMPTY);
        return LOADED_EMPTY;
      });
    inflight.set(key, pending);
  }, [key, plan]);

  return coloring;
}

// Study-room fill by resolved noise. Sits on the floor-plan source, above the
// white room fill and under bookable stripes, staff grey and the outlines.
export function FloorNoiseLayer({
  colors,
  minzoom,
  byNoise,
  source,
}: {
  colors: MapColors;
  minzoom: number;
  byNoise: Record<NoiseLevel, string[]>;
  source?: string;
}) {
  const loudReady = useLoudDots(colors["noise-loud"]);
  if (!source) return null;
  return (
    <>
      {NOISE_LEVELS.map((level) => {
        const rooms = byNoise[level];
        if (rooms.length === 0) return null;
        return (
          <Layer
            key={level}
            id={`floor-plan-noise-${level}`}
            type="fill"
            source={source}
            minzoom={minzoom}
            filter={roomNumberFilter(rooms)}
            paint={
              level === "loud" && loudReady
                ? { "fill-pattern": LOUD_DOTS, "fill-opacity": NOISE_FILL_OPACITY }
                : { "fill-color": colors[NOISE_TOKEN[level]], "fill-opacity": NOISE_FILL_OPACITY }
            }
            beforeId={FLOOR_ROOM_LINES}
          />
        );
      })}
    </>
  );
}
