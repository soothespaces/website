import { daysBetween, detroitParts } from "@/lib/detroit";

// K3 reads this when the app opens again. LibCal is read-only (ADR 0008), so
// the Book link only remembers which room and window the person was looking at.
export const PENDING_BOOKING_KEY = "soothe.pending-booking";

export type PendingBooking = {
  roomName: string;
  roomNumber: string | null;
  buildingSlug: string;
  spaceId: string | null;
  /** ISO timestamps for the timeline window that was on screen. */
  start: string;
  end: string;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** UTC instant for a Detroit civil date plus minutes from that local midnight. */
export function detroitInstant(date: string, minutes: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  let utc = Date.UTC(year!, (month ?? 1) - 1, day ?? 1, 0, 0, 0);
  for (let pass = 0; pass < 4; pass++) {
    const parts = detroitParts(new Date(utc));
    const got = parts.minutes + daysBetween(date, parts.date) * 1440;
    const delta = got - minutes;
    if (delta === 0) return new Date(utc);
    utc -= delta * 60_000;
  }
  return new Date(utc);
}

/** The eight half-hour slots on screen, starting at the current half hour. */
export function bookingWindow(from: Date): { start: string; end: string } {
  const parts = detroitParts(from);
  const startMinutes = Math.floor(parts.minutes / 30) * 30;
  return {
    start: detroitInstant(parts.date, startMinutes).toISOString(),
    end: detroitInstant(parts.date, startMinutes + 8 * 30).toISOString(),
  };
}

export function recordPendingBooking(booking: PendingBooking, storage: StorageLike | null = browserStorage()) {
  if (!storage) return;
  try {
    storage.setItem(PENDING_BOOKING_KEY, JSON.stringify(booking));
  } catch {
    // Private mode and blocked storage still leave the LibCal tab to open.
  }
}

export function readPendingBooking(storage: StorageLike | null = browserStorage()): PendingBooking | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBooking>;
    if (typeof parsed.buildingSlug !== "string" || typeof parsed.start !== "string" || typeof parsed.end !== "string") {
      return null;
    }
    return {
      roomName: typeof parsed.roomName === "string" ? parsed.roomName : "",
      roomNumber: typeof parsed.roomNumber === "string" ? parsed.roomNumber : null,
      buildingSlug: parsed.buildingSlug,
      spaceId: typeof parsed.spaceId === "string" ? parsed.spaceId : null,
      start: parsed.start,
      end: parsed.end,
    };
  } catch {
    return null;
  }
}
