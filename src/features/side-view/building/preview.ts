import { detroitParts } from "@/lib/detroit";

// Free soonest, then the longest free stretch. "Availability unavailable"
// stays in the list but sorts after rooms we could read.
export function previewOrder(status: string, nowMinutes: number): { known: boolean; freeAt: number; freeFor: number } {
  if (status === "Free for the rest of the day") return { known: true, freeAt: 0, freeFor: 1440 - nowMinutes };
  const free = /^Free until (.+)$/.exec(status);
  if (free) {
    const end = clockToMinutes(free[1]);
    if (end == null) return { known: true, freeAt: 0, freeFor: 0 };
    const until = end > nowMinutes ? end : end + 1440;
    return { known: true, freeAt: 0, freeFor: until - nowMinutes };
  }
  const booked = /^Booked until (.+)$/.exec(status);
  if (booked) {
    const end = clockToMinutes(booked[1]);
    if (end == null) return { known: true, freeAt: 1440, freeFor: 0 };
    const until = end > nowMinutes ? end : end + 1440;
    return { known: true, freeAt: until - nowMinutes, freeFor: 0 };
  }
  return { known: false, freeAt: 0, freeFor: 0 };
}

export function rankPreview<T extends { name: string; status: string }>(rooms: readonly T[], now: Date): T[] {
  const nowMinutes = detroitParts(now).minutes;
  return [...rooms].sort((a, b) => {
    const left = previewOrder(a.status, nowMinutes);
    const right = previewOrder(b.status, nowMinutes);
    if (left.known !== right.known) return left.known ? -1 : 1;
    if (left.freeAt !== right.freeAt) return left.freeAt - right.freeAt;
    if (left.freeFor !== right.freeFor) return right.freeFor - left.freeFor;
    return a.name.localeCompare(b.name);
  });
}

function clockToMinutes(label: string): number | null {
  if (label === "midnight") return 1440;
  const match = /^(\d{1,2})(?::(\d{2}))? (AM|PM)$/.exec(label);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (match[3] === "AM") hour = hour === 12 ? 0 : hour;
  else hour = hour === 12 ? 12 : hour + 12;
  return hour * 60 + minute;
}
