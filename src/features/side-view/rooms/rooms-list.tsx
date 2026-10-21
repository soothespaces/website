"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { DetailScreen } from "@/components/ui/detail-screen";
import { MapIcon } from "@/components/ui/icons";
import { detroitParts } from "@/lib/detroit";
import { slotWindowStart, type RoomSlot } from "@/lib/data/room-slots";
import {
  ROOM_SIZES,
  chooseRoomsMapFloor,
  groupRoomsByFloor,
  isRoomSize,
  periodLabel,
  roomColumns,
  roomMatchesSize,
  type RoomSize,
} from "./room-list";
import { RoomRow } from "./room-row";
import { TimelineTicks } from "./timeline-ticks";

export function RoomsList({
  buildingName,
  rooms,
  loaded,
  error,
  size,
  onSizeChange,
  now,
  onBack,
  planFloors,
  onViewFloorPlan,
}: {
  buildingName: string;
  rooms: readonly RoomSlot[];
  loaded: boolean;
  error: string | null;
  size: RoomSize;
  onSizeChange: (size: RoomSize) => void;
  now: Date;
  onBack: () => void;
  planFloors: readonly number[];
  onViewFloorPlan: (floor: number) => void;
}) {
  const start = slotWindowStart(now);
  const listId = useId();
  const period = periodLabel(detroitParts(now).minutes);
  const filtered = rooms.filter((room) => roomMatchesSize(room.capacity, size));
  const groups = groupRoomsByFloor(filtered);
  const floor = loaded ? chooseRoomsMapFloor(rooms, planFloors) : null;

  let body = null;
  if (!loaded) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Loading rooms…
      </p>
    );
  } else if (error && rooms.length === 0) {
    body = (
      <p role="alert" className="text-sm text-muted-foreground">
        {error}
      </p>
    );
  } else if (filtered.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        {rooms.length === 0 ? "No rooms to book in this building." : "No rooms for this size."}
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2">
        <div className={roomColumns}>
          <span />
          <TimelineTicks start={start} />
        </div>
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`${listId}-floor-${group.floor ?? "other"}`} className="flex flex-col">
            <h2 id={`${listId}-floor-${group.floor ?? "other"}`} className="pt-2 text-sm font-semibold">
              {group.label}
            </h2>
            <ul className="divide-y divide-border">
              {group.rooms.map((room) => (
                <li key={room.id}>
                  <RoomRow room={room} start={start} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <RoomsLegend />
      </div>
    );
  }

  return (
    <DetailScreen
      title="Book a room"
      subtitle={buildingName}
      backTo={buildingName}
      onBack={onBack}
      className="h-auto min-h-0 flex-auto"
    >
      <div className="flex flex-col gap-4">
        <ChipGroup
          type="single"
          label="Room size"
          labelHidden
          value={size}
          onValueChange={(value) => {
            if (isRoomSize(value)) onSizeChange(value);
          }}
          className="[&_[role=radio]]:px-2.5 [&_[role=radiogroup]]:gap-1.5"
        >
          {ROOM_SIZES.map((option) => (
            <Chip key={option.value} value={option.value}>
              {option.label}
            </Chip>
          ))}
        </ChipGroup>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{period}</p>
          {floor == null ? null : (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => onViewFloorPlan(floor)}>
              <MapIcon />
              View on floor plan
            </Button>
          )}
        </div>
        {body}
      </div>
    </DetailScreen>
  );
}

function RoomsLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="slot-free size-3.5 rounded-sm bg-slot-free" />
        Free
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="slot-booked size-3.5 rounded-sm bg-destructive" />
        Booked
      </span>
      <span>Tap a room to book it on LibCal</span>
    </div>
  );
}
