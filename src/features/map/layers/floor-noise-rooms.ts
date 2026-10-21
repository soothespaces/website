import { resolveAttributes, type AttributeSpace } from "@/lib/data/attributes";
import type { CheckInSummary, NoiseLevel } from "@/lib/data/check-ins";
import { isStaffRoom } from "./floor-staff-rooms";
import { normalizeRoomNumber } from "./room-match";
import { pointInRing, type Ring } from "./sheet-coords";

export const NOISE_LEVELS: NoiseLevel[] = ["quiet", "low_noise", "conversational", "loud"];

export const LOUD_DOTS = "noise-loud-dots";

// Loud is not told by color alone: a darker dot on the fill. The grid is 8px
// and the tile is 16, so the dots continue across tile edges.
export function loudDotImage(hex: string): { width: number; height: number; data: Uint8Array } {
  const size = 16;
  const color = hex.trim();
  const channel = (index: number) => parseInt(color.slice(1 + index * 2, 3 + index * 2), 16);
  const base = [0, 1, 2].map(channel);
  const mark = base.map((value) => Math.round(value * 0.45));
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x % 8) - 3;
      const dy = (y % 8) - 3;
      const [r, g, b] = dx * dx + dy * dy <= 2 ? mark : base;
      const index = (y * size + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

// Solid enough to read as a fill, light enough that room numbers stay clear.
export const NOISE_FILL_OPACITY = 0.72;

const NOISE_FROM_LABEL: Record<string, NoiseLevel> = {
  Quiet: "quiet",
  "Low noise": "low_noise",
  Conversational: "conversational",
  Loud: "loud",
};

export function noiseFromLabel(label: string | null | undefined): NoiseLevel | null {
  if (!label) return null;
  return NOISE_FROM_LABEL[label] ?? null;
}

export type FloorSpace = {
  id: string;
  name: string;
  listed: boolean;
  floor: number | null;
  noise: NoiseLevel | null;
  bookable: boolean;
  locations: { floor: number; roomNumber: string | null; area: Ring | null }[];
};

export type BookableRoomRef = {
  roomNumber: string | null;
  floor: number | null;
  spaceId: string | null;
  title: string;
};

export type RoomPoint = { roomNumber: string; lng: number; lat: number };

// Corridor, stair, elevator, vestibule, lobby, open-to-below, and the
// men's/women's restroom suffixes printed on the sheets (2030M, 2036W).
const SERVICE_CLASS = /^(\d)([CSEVLF])(\d{2})([A-Z])?$/;
const RESTROOM = /^\d{3,4}[MW]$/;

export function isServiceRoom(roomNumber: string): boolean {
  const raw = roomNumber.trim().toUpperCase();
  if (!raw) return true;
  if (raw === "ROOF" || raw === "UP" || raw === "DN" || raw.includes("BELOW")) return true;
  return SERVICE_CLASS.test(raw) || RESTROOM.test(raw);
}

export function resolvedNoise(attributes: AttributeSpace, summary: CheckInSummary | null): NoiseLevel | null {
  return noiseFromLabel(resolveAttributes(attributes, summary).noise?.value ?? null);
}

type Claim = { noise: NoiseLevel | null; rank: number; listed: boolean };

function claim(claims: Map<string, Claim>, room: string, noise: NoiseLevel, rank: number, listed: boolean) {
  const key = room.trim();
  if (!key || !noise) return;
  const current = claims.get(key);
  if (!current || rank > current.rank || (rank === current.rank && listed && !current.listed && current.noise)) {
    claims.set(key, { noise, rank, listed });
    return;
  }
  if (rank === current.rank && listed === current.listed && current.noise && current.noise !== noise) {
    claims.set(key, { noise: null, rank, listed });
  }
}

function bookableNoise(item: BookableRoomRef, spaces: readonly FloorSpace[]): NoiseLevel | null {
  if (item.spaceId) return spaces.find((space) => space.id === item.spaceId)?.noise ?? null;
  const candidates = spaces.filter((space) => space.listed && space.bookable && space.noise);
  const booth = /booth/i.test(item.title);
  const pool = candidates.filter((space) => /booth/i.test(space.name) === booth);
  const onFloor = pool.filter((space) => space.floor === item.floor);
  if (onFloor.length === 1) return onFloor[0].noise;
  if (pool.length === 1) return pool[0].noise;
  return null;
}

/**
 * Which study rooms take which noise color.
 *
 * A space_locations room number wins, then an area that contains the room,
 * then a bookable_items row (its space_id, or the one listed bookable space
 * of that kind). Rooms with none of those stay white: a floor-wide space
 * does not paint every polygon on its floor.
 */
export function assignRoomNoise({
  floor,
  spaces,
  bookable,
  rooms,
}: {
  floor: number;
  spaces: readonly FloorSpace[];
  bookable: readonly BookableRoomRef[];
  rooms: readonly RoomPoint[];
}): Map<string, NoiseLevel> {
  const canonical = new Map(
    rooms.flatMap((room) => {
      const key = normalizeRoomNumber(room.roomNumber);
      return key ? [[key, room.roomNumber] as const] : [];
    }),
  );
  const asDrawn = (room: string) => {
    const key = normalizeRoomNumber(room);
    return (key && canonical.get(key)) || room.trim();
  };
  const claims = new Map<string, Claim>();

  for (const space of spaces) {
    if (!space.noise) continue;
    for (const location of space.locations) {
      if (location.floor !== floor) continue;
      if (location.roomNumber) claim(claims, asDrawn(location.roomNumber), space.noise, 3, space.listed);
      if (!location.area) continue;
      for (const room of rooms) {
        if (pointInRing(room.lng, room.lat, location.area)) claim(claims, room.roomNumber, space.noise, 2, space.listed);
      }
    }
  }

  for (const item of bookable) {
    if (item.floor !== floor || !item.roomNumber) continue;
    const noise = bookableNoise(item, spaces);
    if (noise) claim(claims, asDrawn(item.roomNumber), noise, 1, true);
  }

  const assigned = new Map<string, NoiseLevel>();
  for (const [room, entry] of claims) {
    if (entry.noise) assigned.set(room, entry.noise);
  }
  return assigned;
}

export function groupByNoise(assigned: ReadonlyMap<string, NoiseLevel>): Record<NoiseLevel, string[]> {
  const grouped: Record<NoiseLevel, string[]> = { quiet: [], low_noise: [], conversational: [], loud: [] };
  for (const [room, noise] of assigned) grouped[noise].push(room);
  for (const rooms of Object.values(grouped)) rooms.sort();
  return grouped;
}

export function bookableRoomNumbers(items: readonly BookableRoomRef[], floor: number): string[] {
  const rooms = new Set<string>();
  for (const item of items) {
    if (item.floor !== floor || !item.roomNumber?.trim()) continue;
    rooms.add(item.roomNumber.trim());
  }
  return [...rooms].sort();
}

export type PlanRoomFeature = { properties: Record<string, unknown> };

export function splitPlanRooms(
  features: readonly PlanRoomFeature[],
  where: { building: string; floor: number },
  noiseByRoom: ReadonlyMap<string, NoiseLevel>,
) {
  const staffRooms: string[] = [];
  const otherRooms: string[] = [];
  for (const feature of features) {
    if (feature.properties.layer !== "room") continue;
    const number = typeof feature.properties.roomNumber === "string" ? feature.properties.roomNumber.trim() : "";
    if (isStaffRoom(feature.properties, where)) {
      if (number) staffRooms.push(number);
      continue;
    }
    if (number && noiseByRoom.has(number)) continue;
    otherRooms.push(number);
  }
  return { staffRooms: [...new Set(staffRooms)].sort(), otherRooms };
}
