"use client";

import { useEffect, useState } from "react";
import { daysBetween, detroitParts, formatClock } from "@/lib/detroit";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { isUnavailable, parseAvailabilityResult, type AvailabilityResult } from "./libcal";
import { readAll } from "./read-all";

export const SLOT_COUNT = 8;
export const SLOT_MINUTES = 30;

export type SlotState = "free" | "booked";

export type RoomSlot = {
  id: string;
  name: string;
  roomNumber: string | null;
  floor: number | null;
  capacity: number | null;
  kind: "bookable" | "classroom";
  bookingUrl?: string;
  /** Null when LibCal couldn't be read. Classrooms always have slots. */
  slots: SlotState[] | null;
  status: string;
};

export type SlotBooking = { start: number; end: number };

export type BookableRoomInput = {
  instance: string;
  libcalItemId: number;
  name: string;
  roomNumber: string | null;
  floor: number | null;
  capacity: number | null;
  bookingUrl: string;
};

export type ClassroomRoomInput = {
  roomCode: string;
  roomNumber: string;
  floor: number | null;
  capacity: number | null;
  /** Meeting clock times on the window's Detroit date, "HH:MM:SS". */
  meetings: { starts: string; ends: string }[];
};

/** "2026-10-21 20:15:00" or "20:15:00" → minutes from midnight of `date`. */
export function minutesFrom(value: string, date: string): number | null {
  const stamped = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (stamped) {
    return daysBetween(date, stamped[1]!) * 1440 + Number(stamped[2]) * 60 + Number(stamped[3]);
  }
  const clock = /^(\d{2}):(\d{2})/.exec(value);
  if (!clock) return null;
  return Number(clock[1]) * 60 + Number(clock[2]);
}

export function floorFromLabel(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function slotsFor(bookings: readonly SlotBooking[], start: number): SlotState[] {
  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const slotStart = start + index * SLOT_MINUTES;
    const slotEnd = slotStart + SLOT_MINUTES;
    const booked = bookings.some((booking) => booking.start < slotEnd && booking.end > slotStart);
    return booked ? "booked" : "free";
  });
}

/** Join half-hour cells that touch, so 8:00–8:30 and 8:30–9:00 are one booking until 9. */
export function mergeBookings(bookings: readonly SlotBooking[]): SlotBooking[] {
  const sorted = [...bookings].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: SlotBooking[] = [];
  for (const booking of sorted) {
    const last = merged.at(-1);
    if (last && booking.start <= last.end) last.end = Math.max(last.end, booking.end);
    else merged.push({ start: booking.start, end: booking.end });
  }
  return merged;
}

/** Status at `at` (minutes from midnight). Never says "available". */
export function statusAt(bookings: readonly SlotBooking[], at: number): string {
  const merged = mergeBookings(bookings);
  const covering = merged.find((booking) => booking.start <= at && booking.end > at);
  if (covering) return `Booked until ${formatClock(covering.end)}`;
  const upcoming = merged.find((booking) => booking.start > at && booking.start < 1440);
  if (upcoming) return `Free until ${formatClock(upcoming.start)}`;
  return "Free for the rest of the day";
}

function presentRoom(room: RoomSlot & { bookings?: SlotBooking[] }): RoomSlot {
  return {
    id: room.id,
    name: room.name,
    roomNumber: room.roomNumber,
    floor: room.floor,
    capacity: room.capacity,
    kind: room.kind,
    ...(room.bookingUrl ? { bookingUrl: room.bookingUrl } : {}),
    slots: room.slots,
    status: room.status,
  };
}

function meetingBookings(meetings: ClassroomRoomInput["meetings"]): SlotBooking[] {
  const bookings: SlotBooking[] = [];
  for (const meeting of meetings) {
    const start = minutesFrom(meeting.starts, "1970-01-01");
    const end = minutesFrom(meeting.ends, "1970-01-01");
    if (start == null || end == null || end <= start) continue;
    bookings.push({ start, end });
  }
  return bookings;
}

function libcalBookings(intervals: { start: string; end: string }[], date: string): SlotBooking[] {
  const bookings: SlotBooking[] = [];
  for (const interval of intervals) {
    const start = minutesFrom(interval.start, date);
    const end = minutesFrom(interval.end, date);
    if (start == null || end == null || end <= start) continue;
    bookings.push({ start, end });
  }
  return bookings;
}

/**
 * Eight half-hour slots from `from` (rounded down) plus a status line.
 * A booking that only straddles the boundary marks both slots. A booking that
 * ends exactly when a slot starts does not mark that slot.
 */
export function buildRoomSlots(input: {
  from: Date;
  bookable: readonly BookableRoomInput[];
  availability: AvailabilityResult;
  classrooms: readonly ClassroomRoomInput[];
}): RoomSlot[] {
  const parts = detroitParts(input.from);
  const start = Math.floor(parts.minutes / SLOT_MINUTES) * SLOT_MINUTES;
  const bookedByItem = new Map<number, { start: string; end: string }[]>();
  if (!isUnavailable(input.availability)) {
    for (const item of input.availability.items) bookedByItem.set(item.libcalItemId, item.booked);
  }
  const unavailable = isUnavailable(input.availability);

  const rooms: RoomSlot[] = [];
  const bookableByRoom = new Map<string, RoomSlot & { bookings: SlotBooking[] }>();

  for (const room of input.bookable) {
    const id = `libcal:${room.instance}:${room.libcalItemId}`;
    if (unavailable) {
      const slot: RoomSlot = {
        id,
        name: room.name,
        roomNumber: room.roomNumber,
        floor: room.floor,
        capacity: room.capacity,
        kind: "bookable",
        bookingUrl: room.bookingUrl,
        slots: null,
        status: "Availability unavailable",
      };
      rooms.push(slot);
      if (room.roomNumber) bookableByRoom.set(room.roomNumber, { ...slot, bookings: [] });
      continue;
    }
    const bookings = mergeBookings(libcalBookings(bookedByItem.get(room.libcalItemId) ?? [], parts.date));
    const slot: RoomSlot & { bookings: SlotBooking[] } = {
      id,
      name: room.name,
      roomNumber: room.roomNumber,
      floor: room.floor,
      capacity: room.capacity,
      kind: "bookable",
      bookingUrl: room.bookingUrl,
      bookings,
      slots: slotsFor(bookings, start),
      status: statusAt(bookings, parts.minutes),
    };
    rooms.push(slot);
    if (room.roomNumber) bookableByRoom.set(room.roomNumber, slot);
  }

  for (const room of input.classrooms) {
    const bookings = meetingBookings(room.meetings);
    const existing = bookableByRoom.get(room.roomNumber);
    if (existing) {
      if (existing.slots == null) continue;
      const merged = mergeBookings([...existing.bookings, ...bookings]);
      existing.bookings = merged;
      existing.slots = slotsFor(merged, start);
      existing.status = statusAt(merged, parts.minutes);
      if (existing.floor == null) existing.floor = room.floor;
      if (existing.capacity == null) existing.capacity = room.capacity;
      continue;
    }
    rooms.push({
      id: `class:${room.roomCode}`,
      name: `Room ${room.roomNumber}`,
      roomNumber: room.roomNumber,
      floor: room.floor,
      capacity: room.capacity,
      kind: "classroom",
      slots: slotsFor(bookings, start),
      status: statusAt(bookings, parts.minutes),
    });
  }

  return rooms
    .map((room) => presentRoom(room))
    .sort(
      (a, b) =>
        (a.floor ?? 999) - (b.floor ?? 999) ||
        (a.roomNumber ?? "").localeCompare(b.roomNumber ?? "", undefined, { numeric: true }) ||
        a.name.localeCompare(b.name),
    );
}

export type RoomSlotsState = {
  rooms: RoomSlot[];
  loaded: boolean;
  error: string | null;
};

type BookableRecord = {
  instance: string;
  libcal_item_id: number;
  title: string;
  room_number: string | null;
  floor: number | null;
  capacity: number | null;
  booking_url: string;
};

type MeetingRecord = {
  room_code: string;
  room_number: string;
  starts: string;
  ends: string;
  weekdays: number[];
  first_day: string;
  last_day: string;
};

type ClassroomRecord = {
  room_code: string;
  room_number: string | null;
  floor_label: string | null;
  seats: number | null;
};

export function useRoomSlots(buildingSlug: string | null, from: Date): RoomSlotsState {
  const fromMinute = Math.floor(from.getTime() / 60_000);
  const requestKey = `${buildingSlug ?? ""}\n${fromMinute}`;
  const [state, setState] = useState<RoomSlotsState & { key: string }>(() => ({
    key: "",
    rooms: [],
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (!getSupabaseEnv() || !buildingSlug) return;
    const supabase = createClient();
    const windowFrom = new Date(fromMinute * 60_000);
    let cancelled = false;

    (async () => {
      try {
        const [bookable, availabilityResponse, classroomRows, meetings, classroomDetails] = await Promise.all([
          readAll<BookableRecord>((start, end) =>
            supabase
              .from("bookable_items")
              .select("instance, libcal_item_id, title, room_number, floor, capacity, booking_url")
              .eq("building_slug", buildingSlug)
              .eq("is_listed", true)
              .eq("kind", "space")
              .order("libcal_item_id")
              .range(start, end),
          ),
          fetch(`/api/rooms/availability?buildingSlug=${encodeURIComponent(buildingSlug)}`)
            .then(async (response) => (response.ok ? parseAvailabilityResult(await response.json()) : { status: "unavailable" as const }))
            .catch(() => ({ status: "unavailable" as const })),
          supabase.rpc("classroom_availability", { as_of: windowFrom.toISOString() }),
          readAll<MeetingRecord>((start, end) =>
            supabase
              .from("classroom_meetings")
              .select("room_code, room_number, starts, ends, weekdays, first_day, last_day")
              .eq("building_slug", buildingSlug)
              .order("room_code")
              .range(start, end),
          ),
          readAll<ClassroomRecord>((start, end) =>
            supabase
              .from("classrooms")
              .select("room_code, room_number, floor_label, seats")
              .eq("building_slug", buildingSlug)
              .order("room_code")
              .range(start, end),
          ),
        ]);
        if (classroomRows.error) throw classroomRows.error;

        const date = detroitParts(windowFrom).date;
        const weekday = detroitParts(windowFrom).weekday;
        const details = new Map(classroomDetails.map((row) => [row.room_code, row]));
        const meetingsByRoom = new Map<string, MeetingRecord[]>();
        for (const meeting of meetings) {
          if (date < meeting.first_day || date > meeting.last_day) continue;
          if (!meeting.weekdays.includes(weekday)) continue;
          const list = meetingsByRoom.get(meeting.room_code) ?? [];
          list.push(meeting);
          meetingsByRoom.set(meeting.room_code, list);
        }

        const classrooms: ClassroomRoomInput[] = [];
        const seen = new Set<string>();
        for (const row of classroomRows.data ?? []) {
          if (row.building_slug !== buildingSlug || !row.room_number || seen.has(row.room_code)) continue;
          seen.add(row.room_code);
          const detail = details.get(row.room_code);
          const roomMeetings = meetingsByRoom.get(row.room_code) ?? [];
          classrooms.push({
            roomCode: row.room_code,
            roomNumber: row.room_number,
            floor: floorFromLabel(detail?.floor_label ?? null),
            capacity: detail?.seats ?? null,
            meetings: roomMeetings.map((meeting) => ({ starts: meeting.starts, ends: meeting.ends })),
          });
        }

        const rooms = buildRoomSlots({
          from: windowFrom,
          bookable: bookable.map((room) => ({
            instance: room.instance,
            libcalItemId: room.libcal_item_id,
            name: room.title,
            roomNumber: room.room_number,
            floor: room.floor,
            capacity: room.capacity,
            bookingUrl: room.booking_url,
          })),
          availability: availabilityResponse,
          classrooms,
        });
        if (!cancelled) setState({ key: requestKey, rooms, loaded: true, error: null });
      } catch (error) {
        console.error("Room slots failed to load", error);
        if (!cancelled) setState({ key: requestKey, rooms: [], loaded: true, error: "Rooms failed to load." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buildingSlug, fromMinute, requestKey]);

  if (!getSupabaseEnv()) return { rooms: [], loaded: true, error: "Supabase isn't configured." };
  if (!buildingSlug) return { rooms: [], loaded: true, error: null };
  if (state.key !== requestKey) return { rooms: [], loaded: false, error: null };
  return { rooms: state.rooms, loaded: state.loaded, error: state.error };
}
