"use client";

import { Marker } from "react-map-gl/maplibre";
import type { SpaceSpot } from "../use-map-data";

// A pin for each spot with listed study spaces, showing how many there are
// when it's more than one. Pins are buttons, so they can be reached and
// opened from the keyboard.
export function SpacePins({
  spots,
  selectedKey,
  onSelect,
}: {
  spots: SpaceSpot[];
  selectedKey: string | null;
  onSelect: (spot: SpaceSpot) => void;
}) {
  return spots.map((spot) => {
    const selected = spot.key === selectedKey;
    const count = spot.spaces.length;
    return (
      <Marker key={spot.key} longitude={spot.lng} latitude={spot.lat} anchor="center">
        <button
          type="button"
          aria-label={count > 1 ? `${spot.name}: ${count} study spaces` : `${spot.spaces[0].name}, ${spot.name}`}
          aria-pressed={selected}
          onClick={(event) => {
            // Keep the click from reaching the map, which would clear it.
            event.stopPropagation();
            onSelect(spot);
          }}
          className="group flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
        >
          <span
            aria-hidden="true"
            className={`flex items-center justify-center rounded-full border-2 border-card bg-primary text-[0.6875rem] font-semibold leading-none text-primary-foreground shadow-sm transition-transform group-hover:scale-110 motion-reduce:transition-none ${
              count > 1 ? "size-6" : "size-4"
            } ${selected ? "ring-2 ring-primary" : ""}`}
          >
            {count > 1 ? count : null}
          </span>
        </button>
      </Marker>
    );
  });
}
