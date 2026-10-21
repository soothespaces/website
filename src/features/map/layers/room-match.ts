// Bookable rooms and classrooms join the floor-plan polygons by room number.
// BK4 will store a polygon id; `polygonId` wins when a room has one, and the
// number remains the match until that link exists.

export type RoomFill = "free" | "booked";

export type MatchableRoom = {
  id?: string;
  roomNumber: string | null;
  floor: number | null;
  /** Null when LibCal could not be read. */
  slots: readonly RoomFill[] | null;
  /** Status at the selected time. "Booked …" is booked now; "Free …" is free. */
  status?: string;
  polygonId?: string | null;
};

export type RoomMatchKey = { kind: "polygon"; value: string } | { kind: "number"; value: string };

/** Digits and letters only, so "2124a" and "2124A" are one room. */
export function normalizeRoomNumber(value: string | null | undefined): string | null {
  if (value == null) return null;
  const compact = String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact || !/\d/.test(compact)) return null;
  return compact;
}

export function roomMatchKey(room: Pick<MatchableRoom, "roomNumber" | "polygonId">): RoomMatchKey | null {
  if (room.polygonId) return { kind: "polygon", value: room.polygonId };
  const number = normalizeRoomNumber(room.roomNumber);
  return number ? { kind: "number", value: number } : null;
}

/** The id stored on the rooms-map route: the room number, or the slot id. */
export function roomRouteId(room: MatchableRoom): string | null {
  return normalizeRoomNumber(room.roomNumber) ?? room.id ?? null;
}

export function sameRoom(room: MatchableRoom, roomId: string | null | undefined): boolean {
  if (!roomId) return false;
  const key = roomRouteId(room);
  if (key != null && key === roomId) return true;
  if (room.id != null && room.id === roomId) return true;
  const wanted = normalizeRoomNumber(roomId);
  const mine = normalizeRoomNumber(room.roomNumber);
  return wanted != null && wanted === mine;
}

// A four-digit library number starts with its floor. "2124" is floor 2.
export function roomFloor(room: Pick<MatchableRoom, "floor" | "roomNumber">): number | null {
  if (typeof room.floor === "number" && Number.isInteger(room.floor)) return room.floor;
  const number = normalizeRoomNumber(room.roomNumber);
  const match = number?.match(/^(\d)\d{2,3}[A-Z]*$/);
  return match ? Number(match[1]) : null;
}

/**
 * Free or booked at the selected time. The status line is that instant
 * (a booking that ended earlier in this half hour is already free). Slots
 * still paint the whole half hour on the timeline. No slots means LibCal
 * could not be read, so the room stays neutral.
 */
export function fillNow(room: Pick<MatchableRoom, "slots" | "status">): RoomFill | null {
  if (room.slots == null) return null;
  if (room.status?.startsWith("Booked")) return "booked";
  if (room.status?.startsWith("Free")) return "free";
  const slot = room.slots[0];
  return slot === "free" || slot === "booked" ? slot : null;
}

export type RoomFillGroups = {
  free: string[];
  booked: string[];
  /** Every numbered room on the floor that can be selected, including unavailable. */
  selectable: string[];
};

export function matchRoomFills(rooms: readonly MatchableRoom[], floor: number): RoomFillGroups {
  const free: string[] = [];
  const booked: string[] = [];
  const selectable: string[] = [];
  const seen = new Set<string>();
  for (const room of rooms) {
    if (roomFloor(room) !== floor) continue;
    const key = roomMatchKey(room);
    // Polygon ids are not on the GeoJSON yet. Number keys are what the plan has.
    if (!key || key.kind !== "number" || seen.has(key.value)) continue;
    seen.add(key.value);
    selectable.push(key.value);
    const fill = fillNow(room);
    if (fill === "free") free.push(key.value);
    else if (fill === "booked") booked.push(key.value);
  }
  return { free, booked, selectable };
}

export function featureMatches(
  properties: Record<string, unknown> | null | undefined,
  key: RoomMatchKey,
): boolean {
  if (!properties || properties.layer !== "room") return false;
  if (key.kind === "polygon") return String(properties.polygonId ?? "") === key.value;
  return normalizeRoomNumber(propertyRoomNumber(properties.roomNumber)) === key.value;
}

export function propertyRoomNumber(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return null;
}

type LngLat = [number, number];

function isRing(value: unknown): value is LngLat[] {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.every((point) => Array.isArray(point) && point.length >= 2 && point.every((n) => typeof n === "number"))
  );
}

/** Area-weighted center of the largest outer ring. Furniture slivers lose to the room. */
export function geometryCenter(geometry: { type: string; coordinates: unknown } | null | undefined): LngLat | null {
  if (!geometry) return null;
  const rings: LngLat[][] = [];
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    const outer = geometry.coordinates[0];
    if (isRing(outer)) rings.push(outer);
  } else if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    for (const polygon of geometry.coordinates) {
      if (!Array.isArray(polygon)) continue;
      const outer = polygon[0];
      if (isRing(outer)) rings.push(outer);
    }
  }
  // Campus coordinates are large and a room is a tiny patch of them, so the
  // shoelace math is done around a local origin or the center drifts outside.
  const origin = rings[0]?.[0];
  if (!origin) return null;
  let best: LngLat | null = null;
  let bestArea = 0;
  for (const ring of rings) {
    const area = Math.abs(ringArea(ring, origin));
    const center = ringCentroid(ring, origin);
    if (center && area >= bestArea) {
      best = center;
      bestArea = area;
    }
  }
  return best;
}

function ringArea(ring: LngLat[], origin: LngLat) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i]![0] - origin[0];
    const y0 = ring[i]![1] - origin[1];
    const x1 = ring[i + 1]![0] - origin[0];
    const y1 = ring[i + 1]![1] - origin[1];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

function ringCentroid(ring: LngLat[], origin: LngLat): LngLat | null {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i]![0] - origin[0];
    const y0 = ring[i]![1] - origin[1];
    const x1 = ring[i + 1]![0] - origin[0];
    const y1 = ring[i + 1]![1] - origin[1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }
  if (area === 0) return null;
  return [origin[0] + x / (3 * area), origin[1] + y / (3 * area)];
}
