"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { SPACE_SUMMARY_SELECT, type SpaceSummary } from "@/features/spaces";
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

export type MapSpace = SpaceSummary;

// The spaces at one spot: a building's spaces share its coordinates, and a
// space with coordinates of its own gets a spot to itself.
export type SpaceSpot = {
  key: string;
  name: string;
  lng: number;
  lat: number;
  spaces: MapSpace[];
};

export type MapBuilding = {
  slug: string;
  name: string;
  shortName: string | null;
  lat: number | null;
  lng: number | null;
};

// Our building for each FO building record number (FO's loc_ObjectNum, also
// buildings.official_id or mguide's extra.buildingRecordNumber).
export type BuildingIndex = Map<string, MapBuilding>;

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
  // Listed study spaces, by name.
  spaces: MapSpace[];
  // The same spaces grouped by where their pin goes.
  spots: SpaceSpot[];
  buildings: BuildingIndex;
  // Our buildings by slug, with their FO record number when known.
  buildingsBySlug: Map<string, MapBuilding & { recordNumber: string | null }>;
  // False until the first read finishes (or fails).
  loaded: boolean;
  // Set when Supabase isn't configured or a read failed; the map still works
  // without these layers.
  error: string | null;
};

const EMPTY: MapData = {
  entrances: [],
  spaces: [],
  spots: [],
  buildings: new Map(),
  buildingsBySlug: new Map(),
  loaded: false,
  error: null,
};

// The public reference data the map draws from Supabase: accessible
// entrances, listed study spaces by pin, and building names for FO's
// buildings.
export function useMapData(): MapData {
  const [data, setData] = useState<MapData>(() =>
    getSupabaseEnv() ? EMPTY : { ...EMPTY, loaded: true, error: "Supabase isn't configured." },
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
          .select(SPACE_SUMMARY_SELECT)
          .eq("is_listed", true)
          .order("name")
          .range(from, to),
      ),
      readAll<{
        slug: string;
        name: string;
        short_name: string | null;
        lat: number | null;
        lng: number | null;
        official_id: string | null;
        record: string | null;
      }>((from, to) =>
        supabase
          .from("buildings")
          .select("slug, name, short_name, lat, lng, official_id, record:extra->>buildingRecordNumber")
          .order("slug")
          .range(from, to),
      ),
    ])
      .then(([entrances, spaces, rows]) => {
        const buildings: BuildingIndex = new Map();
        const buildingsBySlug: MapData["buildingsBySlug"] = new Map();
        for (const { slug, name, short_name, lat, lng, official_id, record } of rows) {
          const building = { slug, name, shortName: short_name, lat, lng };
          for (const id of [official_id, record]) {
            if (id && !buildings.has(id)) buildings.set(id, building);
          }
          buildingsBySlug.set(slug, { ...building, recordNumber: official_id ?? record });
        }
        if (!cancelled) {
          setData({ entrances, spaces, spots: spotsFor(spaces), buildings, buildingsBySlug, loaded: true, error: null });
        }
      })
      .catch((error: unknown) => {
        console.error("Map data failed to load", error);
        if (!cancelled) setData({ ...EMPTY, loaded: true, error: "Map data failed to load." });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
