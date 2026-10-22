"use client";

import { useEffect, useMemo, useState } from "react";
import { useMapState } from "@/features/map/map-state";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";
import { readAll } from "@/lib/data/read-all";

type Noise = Database["public"]["Enums"]["noise_level"];
type Light = Database["public"]["Enums"]["light_level"];
type Feature = Database["public"]["Enums"]["space_feature"];

export type DirectorySpace = {
  id: string;
  slug: string;
  name: string;
  buildingSlug: string;
  floorLabel: string | null;
  noiseLevel: Noise | null;
  lightLevel: Light | null;
  features: Feature[];
  capacity: number | null;
  lat: number | null;
  lng: number | null;
};

export type DirectoryRoom = {
  id: string;
  name: string | null;
  roomNumber: string;
  spaceId: string | null;
  buildingSlug: string | null;
};

type RoomRecord = {
  id: string;
  name: string | null;
  room_number: string;
  space_id: string | null;
  floor_plans: { building_slug: string } | { building_slug: string }[] | null;
};

export type SpotDirectory = {
  spaces: Map<string, DirectorySpace>;
  rooms: Map<string, DirectoryRoom>;
  spacesLoaded: boolean;
  roomsLoaded: boolean;
  error: string | null;
};

const EMPTY_ROOMS = new Map<string, DirectoryRoom>();
const roomCache = new Map<string, Map<string, DirectoryRoom>>();

function buildingSlugOf(floorPlans: RoomRecord["floor_plans"]): string | null {
  if (!floorPlans) return null;
  if (Array.isArray(floorPlans)) return floorPlans[0]?.building_slug ?? null;
  return floorPlans.building_slug;
}

async function loadRooms(ids: readonly string[]): Promise<Map<string, DirectoryRoom>> {
  const key = [...ids].sort().join(",");
  const cached = roomCache.get(key);
  if (cached) return cached;
  if (!ids.length || !getSupabaseEnv()) {
    roomCache.set(key, EMPTY_ROOMS);
    return EMPTY_ROOMS;
  }
  const supabase = createClient();
  const rows = await readAll<RoomRecord>((from, to) =>
    supabase.from("room_zones").select("id, name, room_number, space_id, floor_plans(building_slug)").in("id", [...ids]).range(from, to),
  );
  const rooms = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        roomNumber: row.room_number,
        spaceId: row.space_id,
        buildingSlug: buildingSlugOf(row.floor_plans),
      } satisfies DirectoryRoom,
    ]),
  );
  roomCache.set(key, rooms);
  return rooms;
}

/** Map spaces, plus the room zones a check-in history mentions. */
export function useSpotDirectory(roomIds: readonly string[]): SpotDirectory {
  const { data } = useMapState();
  const roomKey = [...roomIds].sort().join(",");
  const spaces = useMemo(() => {
    const next = new Map<string, DirectorySpace>();
    for (const space of data.spaces) {
      next.set(space.id, {
        id: space.id,
        slug: space.slug,
        name: space.name,
        buildingSlug: space.building?.slug ?? "",
        floorLabel: space.floor_label,
        noiseLevel: space.noise_level,
        lightLevel: space.light_level ?? null,
        features: space.features ?? [],
        capacity: space.capacity ?? null,
        lat: space.lat,
        lng: space.lng,
      });
    }
    return next;
  }, [data.spaces]);
  const [roomState, setRoomState] = useState<{ key: string; rooms: Map<string, DirectoryRoom> }>({
    key: "",
    rooms: EMPTY_ROOMS,
  });
  const [error, setError] = useState<string | null>(null);
  const roomsCached = !roomKey || roomCache.has(roomKey);

  useEffect(() => {
    if (!roomKey || roomCache.has(roomKey)) return;
    let cancelled = false;
    loadRooms(roomKey.split(","))
      .then((next) => {
        if (!cancelled) setRoomState({ key: roomKey, rooms: next });
      })
      .catch((loadError: unknown) => {
        console.error("Checked-in rooms failed to load", loadError);
        if (!cancelled) {
          setError("Checked-in rooms failed to load.");
          setRoomState({ key: roomKey, rooms: EMPTY_ROOMS });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [roomKey]);

  return {
    spaces,
    rooms: roomsCached ? (roomCache.get(roomKey) ?? EMPTY_ROOMS) : roomState.key === roomKey ? roomState.rooms : EMPTY_ROOMS,
    spacesLoaded: data.loaded,
    roomsLoaded: roomsCached || roomState.key === roomKey,
    error,
  };
}
