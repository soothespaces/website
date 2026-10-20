import { detroitParts } from "@/lib/detroit";

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

export function slotWindowStart(from: Date): number {
  return Math.floor(detroitParts(from).minutes / 30) * 30;
}
