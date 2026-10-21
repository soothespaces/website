"use client";

import { useEffect, useState } from "react";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { ArrivalBuilding } from "./arrival";

let pending: Promise<ArrivalBuilding[]> | null = null;

export function loadArrivalBuildings(): Promise<ArrivalBuilding[]> {
  if (!getSupabaseEnv()) return Promise.resolve([]);
  if (!pending) {
    const supabase = createClient();
    pending = readAll<ArrivalBuilding>((from, to) =>
      supabase.from("buildings").select("slug, name, lat, lng, footprint").order("slug").range(from, to),
    ).catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

// Footprints load the first time a fix exists, not when the map mounts.
export function useArrivalBuildings(enabled: boolean): ArrivalBuilding[] {
  const [buildings, setBuildings] = useState<ArrivalBuilding[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadArrivalBuildings()
      .then((rows) => {
        if (!cancelled) setBuildings(rows);
      })
      .catch((error: unknown) => {
        console.error("Buildings failed to load", error);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return buildings;
}
