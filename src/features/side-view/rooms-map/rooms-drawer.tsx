"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { SlotTimeline } from "@/components/ui/slot-timeline";
import { formatClock, hourTicks } from "@/components/ui/slot-times";
import { bookingWindow, recordPendingBooking } from "@/features/check-in/booking-memory";
import type { PanelScreenProps } from "@/features/side-view/registry";
import { roomFloor, roomRouteId, sameRoom } from "@/features/map/layers/room-match";
import { useMapState } from "@/features/map/map-state";
import { useReducedMotion } from "@/lib/settings/use-reduced-motion";
import { cx } from "@/lib/cx";
import type { RoomSlot } from "@/lib/data/room-slots";
import { useRoomsData } from "./rooms-data";
import { roomAccessibleName, roomFooter, roomTitle, windowLabel } from "./room-copy";
import { detroitParts } from "@/lib/detroit";

function TimeTicks({ start }: { start: number }) {
  const ticks = hourTicks(start, 8, 30);
  const span = 8 * 30;
  return (
    <div className="relative mb-1 h-4" aria-hidden="true">
      {ticks.map((tick, index) => (
        <span
          key={tick}
          className={cx(
            "absolute top-0 text-xs whitespace-nowrap text-muted-foreground",
            index === 0 ? "" : index === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
          )}
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
  onSelect,
}: {
  room: RoomSlot;
  start: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!selected) return;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [selected, reducedMotion]);
  const free = room.status.startsWith("Free");
  return (
    <Button
      ref={ref}
      variant="ghost"
      aria-current={selected ? "true" : undefined}
      aria-label={roomAccessibleName(room)}
      onClick={onSelect}
      className={cx(
        "h-auto w-full flex-col items-stretch justify-start gap-1 rounded-md px-2 py-2 text-left font-normal whitespace-normal",
        selected && "bg-accent",
      )}
    >
      <span className="font-medium">{roomTitle(room)}</span>
      <span className={cx("text-sm", free ? "text-foreground" : "text-muted-foreground")}>{room.status}</span>
      <SlotTimeline start={start} slots={room.slots} showTicks={false} />
    </Button>
  );
}

// The rooms-map screen. Wide layouts show it in the side panel; phones show
// the same screen in the sheet over the map.
export function RoomsDrawer({ route }: PanelScreenProps) {
  const { data, floorPlans, setRoomsMap } = useMapState();
  const { from, start, rooms, loaded, error } = useRoomsData();
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
          <TimeTicks start={start} />
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
                  onSelect={() => setRoomsMap({ roomId: id })}
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
                const span = bookingWindow(from);
                recordPendingBooking({
                  roomName: roomTitle(selected),
                  roomNumber: selected.roomNumber,
                  buildingSlug: route.slug,
                  spaceId: null,
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
