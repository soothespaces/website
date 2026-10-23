"use client";

import { useEffect, useState } from "react";
import type { FloorRecord } from "@/features/floor-alignment/floors";
import { plansByBuilding } from "./floor-plan-index";

export type FloorPlan = Pick<FloorRecord, "building" | "floor" | "geojson" | "labeled"> &
  Partial<Pick<FloorRecord, "rooms" | "buildingName" | "sheet" | "width" | "height" | "corners">> & {
    geojson: string;
  };

// Floor plans the map can draw, by building slug, lowest floor first. Read
// from public/floor-plans/index.json (scripts/mprint/pipeline.py writes it);
// only aligned floors with vector GeoJSON are included, one plan per floor.
export function useFloorIndex() {
  const [index, setIndex] = useState<Map<string, FloorPlan[]>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    fetch("/floor-plans/index.json")
      .then((response) => (response.ok ? response.json() : { floors: [] }))
      .then(({ floors }: { floors: FloorRecord[] }) => {
        if (!cancelled) setIndex(plansByBuilding(floors));
      })
      .catch((error: unknown) => console.error("Floor plan index failed to load", error));
    return () => {
      cancelled = true;
    };
  }, []);

  return index;
}
