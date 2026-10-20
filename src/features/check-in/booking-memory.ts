import { detroitParts, formatClock } from "@/lib/detroit";

// A booking the user was looking at when they tapped Book (K3 / SOS-161).
// LibCal is read-only, so this is the only record that they might be there.

const KEY = "soothespaces:bookings";

export type SavedBooking = {
  roomName: string;
  roomNumber: string;
  buildingSlug: string;
  spaceId: string;
  start: string;
  end: string;
};

type Store = Pick<Storage, "getItem" | "setItem"> | undefined;

export function parseBookings(value: unknown): SavedBooking[] {
  if (!Array.isArray(value)) return [];
  const bookings: SavedBooking[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.roomName !== "string" || typeof record.roomNumber !== "string") continue;
    if (typeof record.buildingSlug !== "string" || typeof record.spaceId !== "string") continue;
    if (typeof record.start !== "string" || typeof record.end !== "string") continue;
    if (!record.spaceId || Number.isNaN(Date.parse(record.start)) || Number.isNaN(Date.parse(record.end))) continue;
    bookings.push({
      roomName: record.roomName,
      roomNumber: record.roomNumber,
      buildingSlug: record.buildingSlug,
      spaceId: record.spaceId,
      start: record.start,
      end: record.end,
    });
  }
  return bookings;
}

export function bookingKey(booking: SavedBooking): string {
  return `${booking.buildingSlug}\n${booking.roomNumber}\n${booking.start}`;
}

export function pruneBookings(bookings: readonly SavedBooking[], now: number): SavedBooking[] {
  return bookings.filter((booking) => Date.parse(booking.end) > now);
}

/** The booking whose window contains `now`, preferring the one that started latest. */
export function activeBooking(bookings: readonly SavedBooking[], now: number): SavedBooking | null {
  const active = pruneBookings(bookings, now).filter((booking) => Date.parse(booking.start) <= now);
  active.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  return active[0] ?? null;
}

export function withoutBooking(bookings: readonly SavedBooking[], booking: SavedBooking): SavedBooking[] {
  const key = bookingKey(booking);
  return bookings.filter((item) => bookingKey(item) !== key);
}

export function withBooking(bookings: readonly SavedBooking[], booking: SavedBooking, now: number): SavedBooking[] {
  return pruneBookings([...withoutBooking(bookings, booking), booking], now);
}

function sameMeridiem(clock: string): " AM" | " PM" | "" {
  if (clock.endsWith(" AM")) return " AM";
  if (clock.endsWith(" PM")) return " PM";
  return "";
}

/** "8 – 10 PM" when both clocks share a meridiem, otherwise "8 AM – 10 PM". */
export function formatBookingRange(startIso: string, endIso: string): string {
  const start = formatClock(detroitParts(new Date(startIso)).minutes);
  const end = formatClock(detroitParts(new Date(endIso)).minutes);
  const startMeridiem = sameMeridiem(start);
  const endMeridiem = sameMeridiem(end);
  const startLabel = startMeridiem && startMeridiem === endMeridiem ? start.slice(0, -startMeridiem.length) : start;
  return `${startLabel} – ${end}`;
}

export function bookingPill(startIso: string, endIso: string): string {
  return `Your booking · ${formatBookingRange(startIso, endIso)}`;
}

export function bookingTitle(booking: Pick<SavedBooking, "roomName" | "roomNumber">): string {
  const number = booking.roomNumber.trim().replace(/^room\s+/i, "");
  if (number) return `How's Room ${number}?`;
  const name = booking.roomName.trim();
  return name ? `How's ${name}?` : "How's this room?";
}

function browserStore(): Store {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function readBookings(storage: Store = browserStore()): SavedBooking[] {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return [];
    return parseBookings(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function writeBookings(bookings: readonly SavedBooking[], storage: Store = browserStore()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(bookings));
  } catch {
    // Storage can be unavailable. Skip the booking quietly.
  }
}

export function rememberBooking(booking: SavedBooking, now = Date.now(), storage?: Store): void {
  const store = storage ?? browserStore();
  writeBookings(withBooking(readBookings(store), booking, now), store);
}

export function forgetBooking(booking: SavedBooking, storage?: Store): void {
  const store = storage ?? browserStore();
  writeBookings(withoutBooking(readBookings(store), booking), store);
}

/** Drops bookings whose end has passed, then returns one that contains `now`. */
export function currentBooking(now = Date.now(), storage?: Store): SavedBooking | null {
  const store = storage ?? browserStore();
  const pruned = pruneBookings(readBookings(store), now);
  writeBookings(pruned, store);
  return activeBooking(pruned, now);
}
