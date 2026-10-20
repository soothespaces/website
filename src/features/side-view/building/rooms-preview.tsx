"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import { useRoomSlots } from "@/lib/data/room-slots";
import { cx } from "@/lib/cx";
import { roomMeta, roomName, seeAllRooms } from "./copy";
import { replaceHash } from "./navigate";
import { rankPreview } from "./preview";

// Two bookable rooms that free up soonest, longest stretch first. No
// bookable items means no section. A LibCal miss keeps the rows and says so.
export function RoomsPreview({ slug }: { slug: string | null }) {
  const { push } = useMapState();
  const [from] = useState(() => new Date());
  const slots = useRoomSlots(slug, from);
  const bookable = slots.rooms.filter((room) => room.kind === "bookable");
  const rows = rankPreview(bookable, from).slice(0, 2);

  if (!slug) return null;
  if (!slots.loaded) return <p className="sr-only">Loading rooms</p>;
  if (bookable.length === 0) return null;

  const openList = () => push({ kind: "rooms", slug });
  const openRoom = (roomNumber: string | null, id: string) => {
    push({ kind: "rooms", slug });
    const token = roomNumber && /^[\w.-]+$/.test(roomNumber) ? roomNumber : id;
    replaceHash(`room-${token}`);
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Book a room" action={{ label: seeAllRooms(bookable.length), onClick: openList }} />
      <ul className="@container grid grid-cols-1 gap-2 @min-[20.5rem]:grid-cols-2">
        {rows.map((room) => {
          const meta = roomMeta(room.floor, room.capacity);
          const free = room.status.startsWith("Free");
          return (
            <li key={room.id}>
              <Button
                variant="ghost"
                onClick={() => openRoom(room.roomNumber, room.id)}
                className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal rounded-xl border border-border p-3 text-left font-normal hover:bg-accent"
              >
                <span className="text-sm font-semibold">{roomName(room.name, room.roomNumber)}</span>
                {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
                <span className={cx("text-sm", free ? "text-primary" : "text-muted-foreground")}>{room.status}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
