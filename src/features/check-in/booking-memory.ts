import { detroitParts, formatClock } from "@/lib/detroit";

// A booking the user was looking at when they tapped Book (K3 / SOS-161).
// LibCal is read-only, so this is the only record that they might be there.

const KEY = "soothespaces:bookings";

export type SavedBooking = {
  roomName: string;
  roomNumber: string;
  buildingSlug: string;
  spaceId: string | null;
  startsAt: string;
  endsAt: string;
  bookingUrl?: string;
};

export type BookingInput = {
  buildingSlug: string;
  roomNumber: string;
  spaceId: string | null;
  startsAt: string;
  endsAt: string;
  bookingUrl?: string;
  roomName?: string;
};

type Store = Pick<Storage, "getItem" | "setItem"> | undefined;

export function parseBookings(value: unknown): SavedBooking[] {
  if (!Array.isArray(value)) return [];
  const bookings: SavedBooking[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const startsAt = typeof record.startsAt === "string" ? record.startsAt : typeof record.start === "string" ? record.start : null;
    const endsAt = typeof record.endsAt === "string" ? record.endsAt : typeof record.end === "string" ? record.end : null;
    const spaceId = record.spaceId === null ? null : typeof record.spaceId === "string" ? record.spaceId : undefined;
    if (typeof record.roomNumber !== "string" || typeof record.buildingSlug !== "string") continue;
    if (spaceId === undefined || !startsAt || !endsAt) continue;
    if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) continue;
    bookings.push({
      roomName: typeof record.roomName === "string" ? record.roomName : "",
      roomNumber: record.roomNumber,
      buildingSlug: record.buildingSlug,
      spaceId,
      startsAt,
      endsAt,
      ...(typeof record.bookingUrl === "string" ? { bookingUrl: record.bookingUrl } : {}),
    });
  }
  return bookings;
}

export function bookingKey(booking: SavedBooking): string {
  return `${booking.buildingSlug}\n${booking.roomNumber}\n${booking.startsAt}`;
}

export function pruneBookings(bookings: readonly SavedBooking[], now: number): SavedBooking[] {
  return bookings.filter((booking) => Date.parse(booking.endsAt) > now);
}

/** The booking whose window contains `now`, preferring the one that started latest. */
export function activeBooking(bookings: readonly SavedBooking[], now: number): SavedBooking | null {
  const active = pruneBookings(bookings, now).filter((booking) => Date.parse(booking.startsAt) <= now);
  active.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
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
  if (/^\d/.test(number)) return `How's Room ${number}?`;
  const name = booking.roomName.trim();
  return name ? `How's ${name}?` : number ? `How's ${number}?` : "How's this room?";
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

const savedListeners = new Set<() => void>();

export function onBookingSaved(listener: () => void): () => void {
  savedListeners.add(listener);
  return () => savedListeners.delete(listener);
}

export function rememberBooking(booking: BookingInput, now = Date.now(), storage?: Store): void {
  const store = storage ?? browserStore();
  const saved: SavedBooking = {
    roomName: booking.roomName ?? "",
    roomNumber: booking.roomNumber,
    buildingSlug: booking.buildingSlug,
    spaceId: booking.spaceId,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    ...(booking.bookingUrl ? { bookingUrl: booking.bookingUrl } : {}),
  };
  writeBookings(withBooking(readBookings(store), saved, now), store);
  if (storage == null) {
    for (const listener of savedListeners) listener();
  }
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
