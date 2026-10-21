"use client";

import { useEffect, useState } from "react";
import { useMapState } from "@/features/map/map-state";
import { useRoomSlots } from "@/lib/data/room-slots";
import type { PanelScreenProps } from "../builtin-screens";
import { roomSizeFromGroup, type RoomSize } from "./room-list";
import { RoomsList } from "./rooms-list";

// The rooms route. DetailScreen draws the back button and scrolls the list,
// so the selection panel lets this frame fill the dock. The phone sheet still
// dismisses with a downward swipe; this screen does not add its own Close.
export function RoomsScreen({ route }: PanelScreenProps) {
  const { data, back, push, groupSize, floorPlans } = useMapState();
  const now = useNow();
  const [sizeOverride, setSizeOverride] = useState<RoomSize | null>(null);
  const slug = route.kind === "rooms" ? route.slug : null;
  const slots = useRoomSlots(slug, now);
  const size = sizeOverride ?? roomSizeFromGroup(groupSize);

  if (route.kind !== "rooms") return null;
  const known = data.buildingsBySlug.get(route.slug);
  const buildingName = known?.shortName || known?.name || "Building";
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

// Move the slot window when the minute changes, and when the tab is shown
// again, so a list left open does not keep yesterday's status.
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          refresh();
          schedule();
        },
        60_000 - (Date.now() % 60_000),
      );
    };
    schedule();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
    };
  }, []);
  return now;
}
