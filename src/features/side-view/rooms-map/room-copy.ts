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

export { slotWindowStart };

/** A Detroit wall-clock time. A skipped hour (spring forward) moves to the next one that exists. */
export function resolveDetroit(date: string, minutes: number): Date {
  let day = date;
  let minute = minutes;
  for (let attempt = 0; attempt < 6; attempt++) {
    while (minute >= 1440) {
      minute -= 1440;
      day = addDays(day, 1);
    }
    while (minute < 0) {
      minute += 1440;
      day = addDays(day, -1);
    }
    const instant = detroitInstant(day, minute);
    const got = detroitParts(instant);
    if (got.date === day && got.minutes === minute) return instant;
    minute += 30;
  }
  return detroitInstant(date, minutes);
}

/**
 * Eight half hours starting at `from`, as real instants. Each slot ends 30
 * minutes later, so a daylight-saving jump is a real half hour rather than
 * a wall-clock time that does not exist.
 */
export function detroitSlots(from: Date, count = SLOT_COUNT): { startsAt: string; endsAt: string }[] {
  const parts = detroitParts(from);
  let cursor = resolveDetroit(parts.date, slotWindowStart(from));
  const slots: { startsAt: string; endsAt: string }[] = [];
  for (let index = 0; index < count; index++) {
    const end = new Date(cursor.getTime() + 30 * 60_000);
    slots.push({ startsAt: cursor.toISOString(), endsAt: end.toISOString() });
    cursor = end;
  }
  return slots;
}
