import type { RoomSlot } from "@/lib/data/room-slots";

export type RoomStatusTone = "free" | "booked";

export type RoomStatusLine = {
  text: string;
  /** Free now is dark text. Booked now, and a missing LibCal read, are muted. */
  tone: RoomStatusTone;
};

const UNTIL = /\buntil\s+(.+)$/;

function timeAfterUntil(status: string): string | null {
  const match = UNTIL.exec(status);
  const time = match?.[1]?.trim();
  return time ? time : null;
}

/**
 * The line under a room name. Bookable rooms keep the slot model's wording.
 * A classroom says "Class until 4 PM" (with the course when we know it) or
 * "Free until 3 PM, then EECS 281". Never "available".
 */
export function roomStatusLine(
  room: Pick<RoomSlot, "kind" | "status" | "slots" | "currentCourse" | "nextCourse">,
): RoomStatusLine {
  if (room.kind === "bookable" && room.slots == null) {
    return { text: "Availability unavailable", tone: "booked" };
  }
  if (room.kind === "classroom") {
    const until = timeAfterUntil(room.status);
    if (room.status.startsWith("Booked")) {
      // SOS-132: "Class until 4 PM". The course belongs on the free line
      // ("then EECS 281"), and with no time the room's own status stands
      // (QA-051).
      return { text: until ? `Class until ${until}` : room.status, tone: "booked" };
    }
    const next = room.nextCourse?.trim();
    if (room.status.startsWith("Free until") && until && next) {
      return { text: `Free until ${until}, then ${next}`, tone: "free" };
    }
  }
  return { text: room.status, tone: room.status.startsWith("Free") ? "free" : "booked" };
}

/** Accessible name for a LibCal row. The app never books (ADR 0008). */
export function roomBookingLabel(name: string): string {
  return `Book ${name} on LibCal`;
}

/** Only an http(s) LibCal page. Anything else stays plain text. */
export function roomIsBookableLink(room: Pick<RoomSlot, "kind" | "bookingUrl">): boolean {
  if (room.kind !== "bookable" || !room.bookingUrl) return false;
  try {
    const url = new URL(room.bookingUrl);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
