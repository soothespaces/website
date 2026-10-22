"use client";

import { useEffect, useState } from "react";
import type { FloorRecord } from "@/features/floor-alignment/floors";

export type FloorPlan = Pick<FloorRecord, "building" | "floor" | "geojson" | "labeled"> &
  Partial<Pick<FloorRecord, "rooms" | "buildingName" | "sheet" | "width" | "height" | "corners">> & {
    geojson: string;
  };

// Floor plans the map can draw, by building slug, lowest floor first. Read
// from public/floor-plans/index.json (scripts/mprint/pipeline.py writes it);
// only aligned floors with vector GeoJSON are included.
export function useFloorIndex() {
  const [index, setIndex] = useState<Map<string, FloorPlan[]>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    fetch("/floor-plans/index.json")
      .then((response) => (response.ok ? response.json() : { floors: [] }))
      .then(({ floors }: { floors: FloorRecord[] }) => {
        const byBuilding = new Map<string, FloorPlan[]>();
        for (const record of floors) {
          if (!record.usable || !record.geojson) continue;
          const list = byBuilding.get(record.building) ?? [];
          list.push({ ...record, geojson: record.geojson });
          byBuilding.set(record.building, list);
        }
        for (const list of byBuilding.values()) list.sort((a, b) => a.floor - b.floor);
        if (!cancelled) setIndex(byBuilding);
      })
      .catch((error: unknown) => console.error("Floor plan index failed to load", error));
    return () => {
      cancelled = true;
    };
  }, []);

  return index;
}
