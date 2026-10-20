"use client";

import { useState } from "react";
import { useMapState } from "@/features/map/map-state";
import { useRoomSlots } from "@/lib/data/room-slots";
import type { PanelScreenProps } from "../builtin-screens";
import { roomSizeFromGroup, type RoomSize } from "./room-list";
import { RoomsList } from "./rooms-list";

// The rooms route. DetailScreen draws the back button and scrolls the list,
// so the selection panel lets this frame fill the dock.
export function RoomsScreen({ route }: PanelScreenProps) {
  const { data, back, push, groupSize, floorPlans } = useMapState();
  const [now] = useState(() => new Date());
  const [sizeOverride, setSizeOverride] = useState<RoomSize | null>(null);
  const slug = route.kind === "rooms" ? route.slug : null;
  const slots = useRoomSlots(slug, now);
  const size = sizeOverride ?? roomSizeFromGroup(groupSize);

  if (route.kind !== "rooms") return null;
  const buildingName = data.buildingsBySlug.get(route.slug)?.name ?? "Building";
  const plans = floorPlans.get(route.slug) ?? [];

  return (
    <RoomsList
      buildingName={buildingName}
      rooms={slots.rooms}
      loaded={slots.loaded}
      error={slots.error}
      size={size}
      onSizeChange={setSizeOverride}
      now={now}
      onBack={back}
      planFloors={plans.map((plan) => plan.floor)}
      onViewFloorPlan={(floor) => push({ kind: "rooms-map", slug: route.slug, floor })}
    />
  );
}

RoomsScreen.detailScreen = true;
