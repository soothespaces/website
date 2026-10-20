"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRoomSlots, type RoomSlot } from "@/lib/data/room-slots";
import { slotWindowStart } from "./room-copy";

export type RoomsData = {
  from: Date;
  /** Minutes from Detroit midnight where the eight slots begin. */
  start: number;
  rooms: RoomSlot[];
  loaded: boolean;
  error: string | null;
};

const RoomsDataContext = createContext<RoomsData | null>(null);

// One fetch for the rooms list, the floor-plan fills, and the drawer. The
// window moves with the clock so a long visit doesn't keep the first hour.
export function RoomsDataProvider({ buildingSlug, children }: { buildingSlug: string | null; children: ReactNode }) {
  const [from, setFrom] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setFrom(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const slots = useRoomSlots(buildingSlug, from);
  const start = slotWindowStart(from);
  const value = useMemo<RoomsData>(
    () => ({ from, start, rooms: slots.rooms, loaded: slots.loaded, error: slots.error }),
    [from, start, slots.rooms, slots.loaded, slots.error],
  );
  return <RoomsDataContext value={value}>{children}</RoomsDataContext>;
}

export function useRoomsData(): RoomsData {
  const value = useContext(RoomsDataContext);
  if (!value) throw new Error("useRoomsData must be used inside <RoomsDataProvider>");
  return value;
}
