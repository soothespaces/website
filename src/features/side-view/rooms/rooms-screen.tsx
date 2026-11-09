"use client";

import { rememberBooking } from "@/features/check-in/booking-memory";
import { bookingRoomNumber, detroitSlots, roomTitle } from "@/features/side-view/rooms-map/room-copy";
import { useEffect, useState } from "react";
import { useMapState } from "@/features/map/map-state";
import { useRoomSlots, type RoomSlot } from "@/lib/data/room-slots";
import type { PanelScreenProps } from "../builtin-screens";
import { roomSizeFromGroup, type RoomSize } from "./room-list";
import { RoomsList } from "./rooms-list";

// The rooms route. DetailScreen draws the back button and scrolls the list,
// so the selection panel lets this frame fill the dock. The phone sheet still
// dismisses with a downward swipe; this screen does not add its own Close.
export function RoomsScreen({ route }: PanelScreenProps) {
  const { data, back, push, groupSize, floorPlans, rememberedFloor } = useMapState();
  const now = useNow();
  const [sizeOverride, setSizeOverride] = useState<RoomSize | null>(null);
  const [focusedRoom, setFocusedRoom] = useState<RoomSlot | null>(null);
  const slug = route.kind === "rooms" ? route.slug : null;
  const slots = useRoomSlots(slug, now);
  const size = sizeOverride ?? roomSizeFromGroup(groupSize);

  if (route.kind !== "rooms") return null;
  const known = data.buildingsBySlug.get(route.slug);
  const buildingName = known?.shortName || known?.name || "";
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
      rememberedFloor={rememberedFloor}
      focusedRoom={focusedRoom}
      onFocusRoom={setFocusedRoom}
      onBookRoom={(room) => rememberListBooking(room, route.slug, now)}
      onViewFloorPlan={(floor, roomId) =>
        push(roomId ? { kind: "rooms-map", slug: route.slug, floor, roomId } : { kind: "rooms-map", slug: route.slug, floor })
      }
    />
  );
}

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

// SOS-161: opening LibCal from the list saves the slot the visitor was
// looking at, the first free half hour, so "How's Room 2124?" can follow
// (QA-050). The rooms map's Book button does the same with its chosen slot.
function rememberListBooking(room: RoomSlot, buildingSlug: string, now: Date) {
  const roomNumber = bookingRoomNumber(room);
  if (!roomNumber || !room.slots) return;
  const times = detroitSlots(now);
  const index = room.slots.findIndex((slot, i) => slot === "free" && times[i]?.startsAt);
  const slot = index >= 0 ? times[index] : null;
  if (!slot?.startsAt || !slot.endsAt) return;
  rememberBooking({
    buildingSlug,
    roomNumber,
    spaceId: room.spaceId ?? null,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    bookingUrl: room.bookingUrl,
    roomName: roomTitle(room),
  });
}
