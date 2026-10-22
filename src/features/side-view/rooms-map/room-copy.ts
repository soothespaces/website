import { addDays, detroitInstant, detroitParts } from "@/lib/detroit";
import { SLOT_COUNT, slotWindowStart } from "@/lib/data/room-slots";

export function roomTitle(room: { name: string; roomNumber: string | null }): string {
  const number = room.roomNumber?.trim();
  if (number && /^\d/.test(number)) return `Room ${number}`;
  const booth = room.name.match(/\bBOOTH\s*(\d+)\b/i);
  if (booth) return `Booth ${booth[1]}`;
  if (number) return `Room ${number}`;
  return room.name;
}

export function seatPhrase(capacity: number | null): string | null {
  if (capacity == null) return null;
  return capacity === 1 ? "1 seat" : `${capacity} seats`;
}

export function roomFooter(room: { name: string; roomNumber: string | null; capacity: number | null; status: string }) {
  return [roomTitle(room), seatPhrase(room.capacity), room.status].filter(Boolean).join(" · ");
}

export function roomAccessibleName(room: { name: string; roomNumber: string | null; status: string }) {
  return `${roomTitle(room)}, ${room.status}`;
}

/** "Tonight", "This afternoon", or "Today", from Detroit minutes-from-midnight. */
export function windowLabel(minutes: number): string {
  const minute = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  if (minute >= 17 * 60 || minute < 5 * 60) return "Tonight";
  if (minute >= 12 * 60) return "This afternoon";
  return "Today";
}

export type DetroitSlot = {
  /** Null when this wall-clock half hour does not exist, such as 2:00 AM on a spring-forward night. */
  startsAt: string | null;
  endsAt: string | null;
};

function wallClock(date: string, minutes: number): { day: string; minute: number } {
  let day = date;
  let minute = minutes;
  while (minute >= 1440) {
    minute -= 1440;
    day = addDays(day, 1);
  }
  while (minute < 0) {
    minute += 1440;
    day = addDays(day, -1);
  }
  return { day, minute };
}

/** A Detroit wall-clock time, or null when that clock time does not occur. */
export function resolveDetroit(date: string, minutes: number): Date | null {
  const wall = wallClock(date, minutes);
  const instant = detroitInstant(wall.day, wall.minute);
  const got = detroitParts(instant);
  if (got.date !== wall.day || got.minutes !== wall.minute) return null;
  return instant;
}

/**
 * The same half hours `slotsFor` indexes: wall-clock `start + i*30`.
 * A half hour the clocks skip has no instant, so it cannot be booked.
 */
export function detroitSlots(from: Date, count = SLOT_COUNT): DetroitSlot[] {
  const parts = detroitParts(from);
  const start = slotWindowStart(from);
  return Array.from({ length: count }, (_, index) => {
    const starts = resolveDetroit(parts.date, start + index * 30);
    const ends = resolveDetroit(parts.date, start + (index + 1) * 30);
    if (!starts || !ends || ends.getTime() <= starts.getTime()) return { startsAt: null, endsAt: null };
    return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
  });
}

/** Room number for a booking. Booths print the number in the title, not the field. */
export function bookingRoomNumber(room: { name: string; roomNumber: string | null }): string | null {
  const number = room.roomNumber?.trim();
  if (number) return number;
  const booth = room.name.match(/\bBOOTH\s*(\d+)\b/i);
  return booth ? `BOOTH${booth[1]}` : null;
}
