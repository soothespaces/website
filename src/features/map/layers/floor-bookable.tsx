"use client";

import { useEffect, useState } from "react";
import type { FilterSpecification } from "maplibre-gl";
import { Layer, useMap } from "react-map-gl/maplibre";
import { FLOOR_ROOM_LINES } from "./floor-staff";
import { BOOKABLE_PATTERN, bookableStripeImage } from "./floor-bookable-pattern";

function roomNumberFilter(rooms: readonly string[]): FilterSpecification {
  return [
    "all",
    ["==", ["get", "layer"], "room"],
    ["in", ["get", "roomNumber"], ["literal", [...rooms]]],
  ] as unknown as FilterSpecification;
}

function useBookablePattern() {
  const map = useMap().current?.getMap();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!map) return;
    const add = () => {
      // Replace a stand-in if one landed first. Theme changes wipe images.
      if (map.hasImage(BOOKABLE_PATTERN)) {
        const current = map.getImage(BOOKABLE_PATTERN);
        if ((current?.data?.width ?? 0) >= 8) {
          setReady(true);
          return;
        }
        map.removeImage(BOOKABLE_PATTERN);
      }
      map.addImage(BOOKABLE_PATTERN, bookableStripeImage());
      setReady(true);
    };
    add();
    map.on("styleimagemissing", add);
    map.on("styledata", add);
    return () => {
      map.off("styleimagemissing", add);
      map.off("styledata", add);
    };
  }, [map]);
  return ready;
}

// White diagonal stripes over bookable rooms, above the noise fill so the
// color shows between the stripes. Not the booked cross-hatch.
export function FloorBookableLayer({
  minzoom,
  rooms,
  source,
}: {
  minzoom: number;
  rooms: readonly string[];
  source?: string;
}) {
  const ready = useBookablePattern();
  if (!source || !ready || rooms.length === 0) return null;
  return (
    <Layer
      id="floor-plan-bookable"
      type="fill"
      source={source}
      minzoom={minzoom}
      filter={roomNumberFilter(rooms)}
      paint={{ "fill-pattern": BOOKABLE_PATTERN }}
      beforeId={FLOOR_ROOM_LINES}
    />
  );
}
