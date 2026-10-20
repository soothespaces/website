"use client";

import { useEffect, useState } from "react";
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

type SpaceRecord = {
  id: string;
  slug: string;
  name: string;
  building_slug: string;
  floor_label: string | null;
  noise_level: Noise | null;
  light_level: Light | null;
  features: Feature[];
  capacity: number | null;
  lat: number | null;
  lng: number | null;
};

type RoomRecord = {
  id: string;
  name: string | null;
  room_number: string;
  space_id: string | null;
  floor_plans: { building_slug: string } | { building_slug: string }[] | null;
};

const SPACE_SELECT =
  "id, slug, name, building_slug, floor_label, noise_level, light_level, features, capacity, lat, lng";

export type SpotDirectory = {
  spaces: Map<string, DirectorySpace>;
  rooms: Map<string, DirectoryRoom>;
  spacesLoaded: boolean;
  roomsLoaded: boolean;
  error: string | null;
};

const EMPTY_SPACES = new Map<string, DirectorySpace>();
const EMPTY_ROOMS = new Map<string, DirectoryRoom>();

let spacesSnapshot: { spaces: Map<string, DirectorySpace>; error: string | null } | null = null;
let spacesPromise: Promise<{ spaces: Map<string, DirectorySpace>; error: string | null }> | null = null;
const roomCache = new Map<string, Map<string, DirectoryRoom>>();

function toSpace(record: SpaceRecord): DirectorySpace {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    buildingSlug: record.building_slug,
    floorLabel: record.floor_label,
    noiseLevel: record.noise_level,
    lightLevel: record.light_level,
    features: record.features ?? [],
    capacity: record.capacity,
    lat: record.lat,
    lng: record.lng,
  };
}

function buildingSlugOf(floorPlans: RoomRecord["floor_plans"]): string | null {
  if (!floorPlans) return null;
  if (Array.isArray(floorPlans)) return floorPlans[0]?.building_slug ?? null;
  return floorPlans.building_slug;
}

function loadSpaces() {
  if (spacesSnapshot) return Promise.resolve(spacesSnapshot);
  if (spacesPromise) return spacesPromise;
  if (!getSupabaseEnv()) {
    spacesSnapshot = { spaces: EMPTY_SPACES, error: null };
    return Promise.resolve(spacesSnapshot);
  }
  const supabase = createClient();
  spacesPromise = readAll<SpaceRecord>((from, to) =>
    supabase.from("spaces").select(SPACE_SELECT).eq("is_listed", true).order("name").range(from, to),
  )
    .then((rows) => {
      const spaces = new Map(rows.map((row) => [row.id, toSpace(row)]));
      spacesSnapshot = { spaces, error: null };
      return spacesSnapshot;
    })
    .catch((error: unknown) => {
      console.error("Study spaces failed to load", error);
      spacesPromise = null;
      return { spaces: EMPTY_SPACES, error: "Study spaces failed to load." };
    });
  return spacesPromise;
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

/** Listed spaces, plus the room zones a check-in history mentions. Shared across the screen. */
export function useSpotDirectory(roomIds: readonly string[]): SpotDirectory {
  const roomKey = [...roomIds].sort().join(",");
  const [spaces, setSpaces] = useState<Map<string, DirectorySpace>>(spacesSnapshot?.spaces ?? EMPTY_SPACES);
  const [spacesLoaded, setSpacesLoaded] = useState(spacesSnapshot != null || !getSupabaseEnv());
  const [roomState, setRoomState] = useState<{ key: string; rooms: Map<string, DirectoryRoom> }>({
    key: "",
    rooms: EMPTY_ROOMS,
  });
  const [error, setError] = useState<string | null>(spacesSnapshot?.error ?? null);
  const roomsCached = !roomKey || roomCache.has(roomKey);

  useEffect(() => {
    let cancelled = false;
    loadSpaces().then((result) => {
      if (cancelled) return;
      setSpaces(result.spaces);
      setError(result.error);
      setSpacesLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    spacesLoaded,
    roomsLoaded: roomsCached || roomState.key === roomKey,
    error,
  };
}
