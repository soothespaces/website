"use client";

import { useEffect, useState } from "react";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { CheckInSpace } from "./spaces";

type SpaceRecord = {
  id: string;
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  building:
    | { slug: string; name: string; lat: number | null; lng: number | null }
    | { slug: string; name: string; lat: number | null; lng: number | null }[]
    | null;
};

let pending: Promise<CheckInSpace[]> | null = null;

function oneBuilding(building: SpaceRecord["building"]) {
  if (Array.isArray(building)) return building[0] ?? null;
  return building;
}

function toSpace(record: SpaceRecord): CheckInSpace {
  const building = oneBuilding(record.building);
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    lat: record.lat,
    lng: record.lng,
    buildingSlug: building?.slug ?? null,
    buildingName: building?.name ?? null,
    buildingLat: building?.lat ?? null,
    buildingLng: building?.lng ?? null,
  };
}

export function loadCheckInSpaces(): Promise<CheckInSpace[]> {
  if (!getSupabaseEnv()) return Promise.resolve([]);
  if (!pending) {
    const supabase = createClient();
    pending = readAll<SpaceRecord>((from, to) =>
      supabase
        .from("spaces")
        .select("id, slug, name, lat, lng, building:buildings(slug, name, lat, lng)")
        .eq("is_listed", true)
        .order("name")
        .range(from, to),
    )
      .then((rows) => rows.map(toSpace))
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

export function useCheckInSpaces(active: boolean): { spaces: CheckInSpace[]; loaded: boolean; error: string | null } {
  const [spaces, setSpaces] = useState<CheckInSpace[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadCheckInSpaces()
      .then((rows) => {
        if (cancelled) return;
        setSpaces(rows);
        setLoaded(true);
        setError(null);
      })
      .catch((loadError: unknown) => {
        console.error("Check-in spaces failed to load", loadError);
        if (!cancelled) {
          setLoaded(true);
          setError("Spaces failed to load.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { spaces, loaded, error };
}
