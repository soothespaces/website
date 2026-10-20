"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PanelScreenProps } from "@/features/side-view/registry";
import { roomFloor, roomRouteId } from "@/features/map/layers/room-match";
import { useMapState } from "@/features/map/map-state";
import type { RoomSlot } from "@/lib/data/room-slots";
import { useRoomsData } from "@/features/side-view/rooms-map/rooms-data";
import { roomAccessibleName, roomTitle, windowLabel } from "@/features/side-view/rooms-map/room-copy";
import { detroitParts } from "@/lib/detroit";
import { cx } from "@/lib/cx";
import { ViewOnFloorPlan } from "./view-on-floor-plan";

// The Rooms route, enough for "View on floor plan" and a focused row.
// Size chips and LibCal row links land with the rest of the Rooms screen.
export function RoomsScreen({ route }: PanelScreenProps) {
  const { data, floorPlans } = useMapState();
  const { from, rooms, loaded, error } = useRoomsData();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  if (route.kind !== "rooms") return null;

  const plans = floorPlans.get(route.slug) ?? [];
  const building = data.buildingsBySlug.get(route.slug);
  const place = plans[0]?.buildingName || building?.name || "Building";
  const focused = rooms.find((room) => roomRouteId(room) === focusedId) ?? null;
  const floors = new Map<number, RoomSlot[]>();
  for (const room of rooms) {
    const floor = roomFloor(room);
    if (floor == null) continue;
    const list = floors.get(floor) ?? [];
    list.push(room);
    floors.set(floor, list);
  }

  return (
    <div className="flex flex-col gap-3 px-3 pb-4">
      <div>
        <p className="text-sm text-muted-foreground">{place}</p>
        <h2 className="text-lg">Book a room</h2>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{windowLabel(detroitParts(from).minutes)}</span>
        <ViewOnFloorPlan slug={route.slug} focused={focused} />
      </div>
      {!loaded ? <p className="text-sm text-muted-foreground">Loading rooms…</p> : null}
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      {[...floors.entries()].map(([floor, list]) => (
        <section key={floor} aria-labelledby={`rooms-floor-${floor}`} className="flex flex-col gap-1">
          <h3 id={`rooms-floor-${floor}`} className="text-sm font-medium">
            Floor {floor}
          </h3>
          {list.map((room) => {
            const id = roomRouteId(room);
            if (!id) return null;
            const selected = id === focusedId;
            return (
              <Button
                key={room.id ?? id}
                variant="ghost"
                aria-pressed={selected}
                aria-label={roomAccessibleName(room)}
                onFocus={() => setFocusedId(id)}
                className={cx(
                  "h-auto w-full flex-col items-start justify-start gap-0.5 rounded-md px-2 py-2 text-left font-normal whitespace-normal",
                  selected && "bg-accent",
                )}
              >
                <span className="font-medium">{roomTitle(room)}</span>
                <span className="text-sm text-muted-foreground">{room.status}</span>
              </Button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
