"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

export type Entrance = Pick<
  Tables["building_entrances"]["Row"],
  | "id"
  | "building_record_number"
  | "building_slug"
  | "lat"
  | "lng"
  | "floor_label"
  | "accessible"
  | "automatic"
  | "location_description"
  | "notes"
>;

export type MapSpace = Pick<
  Tables["spaces"]["Row"],
  "slug" | "name" | "summary" | "floor_label" | "noise_level" | "features" | "lat" | "lng"
> & { building: Pick<Tables["buildings"]["Row"], "slug" | "name" | "lat" | "lng"> | null };

// The spaces at one spot: a building's spaces share its coordinates, and a
// space with coordinates of its own gets a spot to itself.
export type SpaceSpot = {
  key: string;
  name: string;
  lng: number;
  lat: number;
  spaces: MapSpace[];
};

// Our building for each FO building record number (FO's loc_ObjectNum, also
// buildings.official_id or mguide's extra.buildingRecordNumber).
export type BuildingIndex = Map<string, { slug: string; name: string }>;

const PAGE = 1000; // PostgREST's default row cap on Supabase

// Reads every row a query returns, a page at a time.
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

// Groups spaces by where their pin goes. Spaces don't have coordinates yet,
// so most share their building's.
function spotsFor(spaces: MapSpace[]): SpaceSpot[] {
  const spots = new Map<string, SpaceSpot>();
  for (const space of spaces) {
    const own = space.lat != null && space.lng != null;
    const lat = own ? space.lat : space.building?.lat;
    const lng = own ? space.lng : space.building?.lng;
    if (lat == null || lng == null) continue;
    const key = own ? `space:${space.slug}` : `building:${space.building!.slug}`;
    const spot = spots.get(key) ?? { key, name: own ? space.name : space.building!.name, lat, lng, spaces: [] };
    spot.spaces.push(space);
    spots.set(key, spot);
  }
  return [...spots.values()];
}

export type MapData = {
  entrances: Entrance[];
  spaces: SpaceSpot[];
  buildings: BuildingIndex;
  // Set when Supabase isn't configured or a read failed; the map still works
  // without these layers.
  error: string | null;
};

const EMPTY: MapData = { entrances: [], spaces: [], buildings: new Map(), error: null };

// The public reference data the map draws from Supabase: accessible
// entrances, listed study spaces by pin, and building names for FO's
// buildings.
export function useMapData(): MapData {
  const [data, setData] = useState<MapData>(() =>
    getSupabaseEnv() ? EMPTY : { ...EMPTY, error: "Supabase isn't configured." },
  );

  useEffect(() => {
    if (!getSupabaseEnv()) return;
    const supabase = createClient();
    let cancelled = false;

    Promise.all([
      readAll<Entrance>((from, to) =>
        supabase
          .from("building_entrances")
          .select(
            "id, building_record_number, building_slug, lat, lng, floor_label, accessible, automatic, location_description, notes",
          )
          .eq("accessible", true)
          .order("id")
          .range(from, to),
      ),
      readAll<MapSpace>((from, to) =>
        supabase
          .from("spaces")
          .select(
            "slug, name, summary, floor_label, noise_level, features, lat, lng, building:buildings(slug, name, lat, lng)",
          )
          .eq("is_listed", true)
          .order("name")
          .range(from, to),
      ),
      readAll<{ slug: string; name: string; official_id: string | null; record: string | null }>((from, to) =>
        supabase
          .from("buildings")
          .select("slug, name, official_id, record:extra->>buildingRecordNumber")
          .order("slug")
          .range(from, to),
      ),
    ])
      .then(([entrances, spaces, rows]) => {
        const buildings: BuildingIndex = new Map();
        for (const row of rows) {
          for (const id of [row.official_id, row.record]) {
            if (id && !buildings.has(id)) buildings.set(id, { slug: row.slug, name: row.name });
          }
        }
        if (!cancelled) setData({ entrances, spaces: spotsFor(spaces), buildings, error: null });
      })
      .catch((error: unknown) => {
        console.error("Map data failed to load", error);
        if (!cancelled) setData({ ...EMPTY, error: "Map data failed to load." });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
