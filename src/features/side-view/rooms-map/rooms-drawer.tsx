"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { SlotTimeline } from "@/components/ui/slot-timeline";
import { formatClock, hourTicks } from "@/components/ui/slot-times";
import { rememberBooking } from "@/features/check-in/booking-memory";
import type { PanelScreenProps } from "@/features/side-view/registry";
import { roomFloor, roomRouteId, sameRoom } from "@/features/map/layers/room-match";
import { useMapState } from "@/features/map/map-state";
import { useReducedMotion } from "@/lib/settings/use-reduced-motion";
import { cx } from "@/lib/cx";
import type { RoomSlot } from "@/lib/data/room-slots";
import { SLOT_COUNT, SLOT_MINUTES } from "@/lib/data/room-slots";
import { useRoomsData } from "./rooms-data";
import { roomAccessibleName, roomFooter, roomTitle, slotRange, windowLabel } from "./room-copy";
import { detroitParts } from "@/lib/detroit";

const rowGrid = "grid grid-cols-[minmax(0,1fr)_minmax(7.5rem,46%)] items-center gap-x-3";

function TimeTicks({ start }: { start: number }) {
  const span = SLOT_COUNT * SLOT_MINUTES;
  const end = start + span;
  // The closing hour sits past the last block, so it is left off.
  const ticks = hourTicks(start, SLOT_COUNT, SLOT_MINUTES).filter((tick) => tick < end);
  return (
    <div className="relative h-4 min-w-0" aria-hidden="true">
      {ticks.map((tick) => (
        <span
          key={tick}
          className="absolute top-0 text-xs whitespace-nowrap text-muted-foreground"
          style={{ left: `${((tick - start) / span) * 100}%` }}
        >
          {formatClock(tick)}
        </span>
      ))}
    </div>
  );
}

function RoomMapRow({
  room,
  start,
  selected,
  selectedSlot,
  onSelect,
  onSlotSelect,
}: {
  room: RoomSlot;
  start: number;
  selected: boolean;
  selectedSlot: number;
  onSelect: () => void;
  onSlotSelect: (index: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!selected) return;
    const row = document.getElementById(`rooms-map-row-${room.id}`);
    row?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [selected, reducedMotion, room.id]);
  const free = room.status.startsWith("Free");
  return (
    <div id={`rooms-map-row-${room.id}`} className={cx(rowGrid, "py-2", selected && "rounded-md bg-accent")}>
      <Button
        variant="ghost"
        aria-current={selected ? "true" : undefined}
        aria-label={roomAccessibleName(room)}
        onClick={onSelect}
        className="h-auto min-h-0 w-full flex-col items-start justify-start gap-0.5 rounded-md px-2 py-1 text-left font-normal whitespace-normal"
      >
        <span className="font-medium">{roomTitle(room)}</span>
        <span className={cx("text-sm", free ? "text-foreground" : "text-muted-foreground")}>{room.status}</span>
      </Button>
      <SlotTimeline
        start={start}
        slots={room.slots}
        showTicks={false}
        selectedSlot={selected ? selectedSlot : undefined}
        onSlotSelect={room.slots ? onSlotSelect : undefined}
      />
    </div>
  );
}

// The rooms-map screen. Wide layouts show it in the side panel; phones show
// the same screen in the sheet over the map.
export function RoomsDrawer({ route }: PanelScreenProps) {
  const { data, floorPlans, setRoomsMap } = useMapState();
  const { from, start, rooms, loaded, error } = useRoomsData();
  const [picked, setPicked] = useState<{ roomId: string; slot: number } | null>(null);
  useEffect(() => {
    if (route.kind !== "rooms-map") return;
    const list = floorPlans.get(route.slug);
    if (!list?.length || list.some((plan) => plan.floor === route.floor)) return;
    setRoomsMap({ floor: list[0]!.floor });
  }, [route, floorPlans, setRoomsMap]);
  if (route.kind !== "rooms-map") return null;
  const plans = floorPlans.get(route.slug) ?? [];
  const building = data.buildingsBySlug.get(route.slug);
  const place = plans[0]?.buildingName || building?.name || "Building";
  const onFloor = rooms.filter((room) => roomFloor(room) === route.floor);
  const selected = rooms.find((room) => sameRoom(room, route.roomId)) ?? null;
  const selectedId = selected ? roomRouteId(selected) : null;
  const slotIndex = picked && selectedId && picked.roomId === selectedId ? picked.slot : 0;
  const label = windowLabel(detroitParts(from).minutes);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-3">
        <div className="px-2">
          <h2 className="text-lg">{place} rooms</h2>
        </div>
        {plans.length > 0 ? (
          <ChipGroup
            type="single"
            label="Floor"
            value={String(route.floor)}
            onValueChange={(value) => setRoomsMap({ floor: Number(value) })}
          >
            {plans.map((plan) => (
              <Chip key={plan.floor} value={String(plan.floor)}>
                Floor {plan.floor}
              </Chip>
            ))}
          </ChipGroup>
        ) : null}
        <section aria-labelledby="rooms-map-floor" className="flex flex-col gap-2 px-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="rooms-map-floor" className="text-sm font-medium">
              Floor {route.floor} rooms
            </h3>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <ul className="flex gap-3 text-sm" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="slot-free inline-block size-3 rounded-sm bg-slot-free" />
              Free
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="slot-booked inline-block size-3 rounded-sm bg-destructive" />
              Booked
            </li>
          </ul>
          <div className={rowGrid}>
            <span />
            <TimeTicks start={start} />
          </div>
          {!loaded ? <p className="text-sm text-muted-foreground">Loading rooms…</p> : null}
          {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
          {loaded && !error && onFloor.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookable rooms on this floor.</p>
          ) : null}
          <div className="flex flex-col">
            {onFloor.map((room) => {
              const id = roomRouteId(room);
              if (!id) return null;
              return (
                <RoomMapRow
                  key={room.id}
                  room={room}
                  start={start}
                  selected={sameRoom(room, route.roomId)}
                  selectedSlot={slotIndex}
                  onSelect={() => {
                    setRoomsMap({ roomId: id });
                    setPicked({ roomId: id, slot: 0 });
                  }}
                  onSlotSelect={(slot) => {
                    setRoomsMap({ roomId: id });
                    setPicked({ roomId: id, slot });
                  }}
                />
              );
            })}
          </div>
        </section>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-3 py-3">
        <p className="min-w-0 text-sm">{selected ? roomFooter(selected) : "Select a room"}</p>
        {selected?.bookingUrl ? (
          <Button asChild>
            <a
              href={selected.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (!selected.roomNumber || !selected.spaceId) return;
                const span = slotRange(from, slotIndex);
                rememberBooking({
                  roomName: roomTitle(selected),
                  roomNumber: selected.roomNumber,
                  buildingSlug: route.slug,
                  spaceId: selected.spaceId,
                  start: span.start,
                  end: span.end,
                });
              }}
            >
              Book
            </a>
          </Button>
        ) : null}
      </footer>
    </div>
  );
}
