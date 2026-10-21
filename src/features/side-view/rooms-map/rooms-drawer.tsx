"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { DetailScreen } from "@/components/ui/detail-screen";
import { SlotTimeline } from "@/components/ui/slot-timeline";
import { formatClock, hourTicks } from "@/components/ui/slot-times";
import { rememberBooking } from "@/features/check-in/booking-memory";
import type { PanelScreenProps } from "@/features/side-view/registry";
import { roomFloor, roomRouteId, sameRoom } from "@/features/map/layers/room-match";
import { useMapState } from "@/features/map/map-state";
import { useReducedMotion } from "@/lib/settings/use-reduced-motion";
import { cx } from "@/lib/cx";
import { SLOT_COUNT, SLOT_MINUTES, type RoomSlot } from "@/lib/data/room-slots";
import { useRoomsData } from "./rooms-data";
import { detroitSlots, roomAccessibleName, roomFooter, roomTitle, windowLabel } from "./room-copy";
import { detroitParts } from "@/lib/detroit";

const rowGrid = "grid grid-cols-[minmax(0,1fr)_minmax(7.5rem,46%)] items-center gap-x-3";

function TimeTicks({ start }: { start: number }) {
  const span = SLOT_COUNT * SLOT_MINUTES;
  const end = start + span;
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

function freeStart(room: RoomSlot, times: readonly { startsAt: string }[]): string | null {
  const index = room.slots?.findIndex((slot) => slot === "free") ?? -1;
  return index >= 0 ? (times[index]?.startsAt ?? null) : null;
}

function RoomMapRow({
  room,
  start,
  times,
  selected,
  selectedStart,
  onSelect,
  onSelectStart,
}: {
  room: RoomSlot;
  start: number;
  times: readonly { startsAt: string }[];
  selected: boolean;
  selectedStart: string | null;
  onSelect: () => void;
  onSelectStart: (startsAt: string) => void;
}) {
  const summaryId = useId();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!selected) return;
    document.getElementById(`rooms-map-row-${room.id}`)?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [selected, reducedMotion, room.id]);
  const free = room.status.startsWith("Free");
  return (
    <div id={`rooms-map-row-${room.id}`} className={cx("py-2", selected && "rounded-md bg-accent")}>
      <div className={rowGrid}>
        <Button
          variant="ghost"
          aria-current={selected ? "true" : undefined}
          aria-label={roomAccessibleName(room)}
          aria-describedby={room.slots ? summaryId : undefined}
          onClick={onSelect}
          className="h-auto min-h-11 w-full flex-col items-start justify-start gap-0.5 rounded-md px-2 py-1 text-left font-normal whitespace-normal"
        >
          <span className="font-medium">{roomTitle(room)}</span>
          <span className={cx("text-sm", free ? "text-foreground" : "text-muted-foreground")}>{room.status}</span>
        </Button>
        <SlotTimeline start={start} slots={room.slots} showTicks={false} summaryId={summaryId} />
      </div>
      {selected && room.slots ? (
        <div className="px-2 pt-2">
          <SlotTimeline
            start={start}
            slots={room.slots}
            showTicks={false}
            selectable
            starts={times.map((slot) => slot.startsAt)}
            selectedStart={selectedStart}
            onSelectStart={onSelectStart}
          />
        </div>
      ) : null}
    </div>
  );
}

// The rooms-map screen. Wide layouts show it in the side panel; phones show
// the same screen in the sheet over the map.
export function RoomsDrawer({ route }: PanelScreenProps) {
  const { data, floorPlans, setRoomsMap, back } = useMapState();
  const { from, start, rooms, loaded, error } = useRoomsData();
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const times = detroitSlots(from);
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
  const selectedFree = selected ? freeStart(selected, times) : null;
  const chosen =
    selected?.slots &&
    times.some((slot, index) => slot.startsAt === chosenStart && selected.slots?.[index] === "free")
      ? chosenStart
      : selectedFree;
  const chosenSlot = times.find((slot) => slot.startsAt === chosen) ?? null;
  const label = windowLabel(detroitParts(from).minutes);

  return (
    <DetailScreen
      title={`${place} rooms`}
      backTo="Rooms"
      onBack={back}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm">{selected ? roomFooter(selected) : "Select a room"}</p>
          {selected?.bookingUrl ? (
            <Button asChild>
              <a
                href={selected.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (!selected.roomNumber || !chosenSlot) return;
                  rememberBooking({
                    buildingSlug: route.slug,
                    roomNumber: selected.roomNumber,
                    spaceId: selected.spaceId ?? null,
                    startsAt: chosenSlot.startsAt,
                    endsAt: chosenSlot.endsAt,
                    bookingUrl: selected.bookingUrl,
                    roomName: roomTitle(selected),
                  });
                }}
              >
                Book
              </a>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
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
        <section aria-labelledby="rooms-map-floor" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="rooms-map-floor" className="text-sm font-medium">
              Floor {route.floor} rooms
            </h2>
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
              const isSelected = sameRoom(room, route.roomId);
              return (
                <RoomMapRow
                  key={room.id}
                  room={room}
                  start={start}
                  times={times}
                  selected={isSelected}
                  selectedStart={isSelected ? chosen : null}
                  onSelect={() => setRoomsMap({ roomId: id })}
                  onSelectStart={setChosenStart}
                />
              );
            })}
          </div>
        </section>
      </div>
    </DetailScreen>
  );
}
