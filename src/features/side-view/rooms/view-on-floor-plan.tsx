"use client";

import { Button } from "@/components/ui/button";
import { MapIcon } from "@/components/ui/icons";
import { roomFloor, roomRouteId, type MatchableRoom } from "@/features/map/layers/room-match";
import { useMapState } from "@/features/map/map-state";
import { chooseRoomsMapFloor } from "@/features/side-view/rooms-map/choose-floor";
import { useRoomsData } from "@/features/side-view/rooms-map/rooms-data";

// Outline pill on the Rooms screen. Hidden when this building has no vector
// floor plan (the index in useFloorIndex). A focused room opens on its
// floor; otherwise the last rooms-map floor, or the floor with the most
// rooms free right now.
export function ViewOnFloorPlan({ slug, focused }: { slug: string; focused: MatchableRoom | null }) {
  const { floorPlans, rememberedFloor, push } = useMapState();
  const { rooms } = useRoomsData();
  const plans = floorPlans.get(slug) ?? [];
  if (plans.length === 0) return null;
  const floor = chooseRoomsMapFloor({
    plans: plans.map((plan) => plan.floor),
    rooms,
    focusedFloor: focused ? roomFloor(focused) : null,
    rememberedFloor,
  });
  if (floor == null) return null;
  const roomId = focused && roomFloor(focused) === floor ? roomRouteId(focused) : null;

  return (
    <Button
      variant="outline"
      className="rounded-full"
      onClick={() =>
        push({
          kind: "rooms-map",
          slug,
          floor,
          ...(roomId ? { roomId } : {}),
        })
      }
    >
      <MapIcon />
      View on floor plan
    </Button>
  );
}
