"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detroitParts } from "@/lib/detroit";
import { slotWindowStart, useRoomSlots, type RoomSlot } from "@/lib/data/room-slots";

export type RoomsData = {
  from: Date;
  /** Minutes from Detroit midnight where the eight slots begin. */
  start: number;
  rooms: RoomSlot[];
  loaded: boolean;
  error: string | null;
};

const RoomsDataContext = createContext<RoomsData | null>(null);

function sameHalfHour(a: Date, b: Date) {
  const left = detroitParts(a);
  const right = detroitParts(b);
  return left.date === right.date && Math.floor(left.minutes / 30) === Math.floor(right.minutes / 30);
}

// One fetch for the floor-plan fills and the drawer. The window stays put
// until the half hour changes, so LibCal is not fetched every minute.
export function RoomsDataProvider({ buildingSlug, children }: { buildingSlug: string | null; children: ReactNode }) {
  const [from, setFrom] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      setFrom((current) => {
        const next = new Date();
        return sameHalfHour(current, next) ? current : next;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  const slots = useRoomSlots(buildingSlug, from);
  // While a new half hour is loading, keep the window the rooms were built for.
  const shownFrom = slots.asOf ?? from;
  const start = slotWindowStart(shownFrom);
  const value = useMemo<RoomsData>(
    () => ({ from: shownFrom, start, rooms: slots.rooms, loaded: slots.loaded, error: slots.error }),
    [shownFrom, start, slots.rooms, slots.loaded, slots.error],
  );
  return <RoomsDataContext value={value}>{children}</RoomsDataContext>;
}

export function useRoomsData(): RoomsData {
  const value = useContext(RoomsDataContext);
  if (!value) throw new Error("useRoomsData must be used inside <RoomsDataProvider>");
  return value;
}
