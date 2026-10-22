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

/** A Detroit wall-clock time. Minutes may run past midnight into the next date. */
export function resolveDetroit(date: string, minutes: number): Date {
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
  return detroitInstant(day, minute);
}

/**
 * The same half hours `slotsFor` indexes: wall-clock `start + i*30`, not
 * thirty real minutes. A daylight-saving jump stays in its own cell.
 */
export function detroitSlots(from: Date, count = SLOT_COUNT): { startsAt: string; endsAt: string }[] {
  const parts = detroitParts(from);
  const start = slotWindowStart(from);
  return Array.from({ length: count }, (_, index) => ({
    startsAt: resolveDetroit(parts.date, start + index * 30).toISOString(),
    endsAt: resolveDetroit(parts.date, start + (index + 1) * 30).toISOString(),
  }));
}

/** Room number for a booking. Booths print the number in the title, not the field. */
export function bookingRoomNumber(room: { name: string; roomNumber: string | null }): string | null {
  const number = room.roomNumber?.trim();
  if (number) return number;
  const booth = room.name.match(/\bBOOTH\s*(\d+)\b/i);
  return booth ? `BOOTH${booth[1]}` : null;
}
