// Room labels disagree across sources: "2124", "Room 2124", "room 2124".
// One comparison for photos, spaces and (later) bookable rooms.

export function normalizeRoomNumber(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^room\s+/i, "").trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function sameRoomNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeRoomNumber(a);
  const right = normalizeRoomNumber(b);
  return left != null && left === right;
}
