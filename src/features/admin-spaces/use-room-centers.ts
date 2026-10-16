"use client";

import { useEffect, useState } from "react";
import { ringCenter, type Ring } from "./space";

type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
type PlanFile = { features: { properties?: { layer?: string; roomNumber?: string }; geometry: Geometry }[] };

export type RoomCenters = Map<string, [number, number]>;

const cache = new Map<string, Promise<RoomCenters>>();

// The middle of each numbered room on a floor plan, read from the plan's
// GeoJSON (the browser has usually fetched it for the map already). A room
// drawn as several shapes gets the middle of all of them.
function load(url: string) {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json() as Promise<PlanFile>;
      })
      .then((plan) => {
        const points = new Map<string, [number, number][]>();
        for (const f of plan.features) {
          const number = f.properties?.roomNumber;
          if (f.properties?.layer !== "room" || !number) continue;
          const outer = f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]);
          const list = points.get(number) ?? [];
          for (const ring of outer) if (ring?.length) list.push(ringCenter(ring));
          points.set(number, list);
        }
        return new Map([...points].map(([number, list]) => [number, ringCenter(list)]));
      });
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return promise;
}

/** Room centers for each plan URL given, filled in as the files load. */
export function useRoomCenters(urls: string[]) {
  const [centers, setCenters] = useState<Record<string, RoomCenters>>({});
  const key = urls.join("|");
  useEffect(() => {
    let cancelled = false;
    for (const url of key ? key.split("|") : []) {
      load(url)
        .then((rooms) => {
          if (!cancelled) setCenters((current) => (current[url] ? current : { ...current, [url]: rooms }));
        })
        .catch((error: unknown) => console.error("Floor plan failed to load", error));
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return centers;
}
