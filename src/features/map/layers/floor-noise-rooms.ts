import type { SymbolLayerSpecification } from "maplibre-gl";
import { resolveAttributes, type AttributeSpace } from "@/lib/data/attributes";
import type { CheckInSummary, NoiseLevel } from "@/lib/data/check-ins";
import { isStaffRoom } from "./floor-staff-rooms";
import { normalizeRoomNumber } from "./room-match";
import { pointInRing, type Ring } from "./sheet-coords";

export const NOISE_LEVELS: NoiseLevel[] = ["quiet", "low_noise", "conversational", "loud"];

export const NOISE_BAR_IMAGES = ["noise-bars-1", "noise-bars-2", "noise-bars-3", "noise-bars-4"] as const;

export const NOISE_BARS: Record<NoiseLevel, number> = {
  quiet: 1,
  low_noise: 2,
  conversational: 3,
  loud: 4,
};

// The glyph hangs from its top edge, just under the centered room number.
// The number is placed first (its layer is higher) and its collision box
// reaches below the glyph's top, so a glyph that respected collisions would
// never show. It overlaps instead, the number paints over it where they meet,
// and it never pushes a number out. icon-size stays constant: an
// interpolation makes MapLibre reserve the next zoom's larger box.
export const NOISE_GLYPH_LAYOUT = {
  "icon-image": ["concat", "noise-bars-", ["to-string", ["get", "noiseBars"]]],
  "icon-size": 0.22,
  "icon-offset": [0, 12],
  "icon-padding": 0,
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
  "icon-anchor": "top",
} satisfies SymbolLayerSpecification["layout"];

// The glyph reads noiseBars off the same features as the fill. Untagged rooms
// keep their properties, so they stay white and get no icon.
// Lower ranks are placed first, so they keep the spot when labels collide.
// Tagged and bookable rooms beat a name, which beats a plain number.
// Staff, stairs, and corridors give way.
export const LABEL_RANK = { tagged: 0, bookable: 1, named: 2, room: 3, background: 4 } as const;

export function labelRank(
  properties: Record<string, unknown>,
  where: { building: string; floor: number },
  flags: { noise: boolean; bookable: boolean },
): number {
  if (flags.noise) return LABEL_RANK.tagged;
  if (flags.bookable) return LABEL_RANK.bookable;
  const number = typeof properties.roomNumber === "string" ? properties.roomNumber : "";
  if (isStaffRoom(properties, where) || isServiceRoom(number)) return LABEL_RANK.background;
  if (typeof properties.roomName === "string" && properties.roomName.trim()) return LABEL_RANK.named;
  return LABEL_RANK.room;
}

export function withNoiseBars<T extends { properties?: Record<string, unknown> }>(
  features: readonly T[],
  noiseByRoom: ReadonlyMap<string, NoiseLevel>,
): T[] {
  return features.map((feature) => {
    const number = feature.properties?.roomNumber;
    const level = typeof number === "string" ? noiseByRoom.get(number.trim()) : undefined;
    if (!level) return feature;
    return { ...feature, properties: { ...feature.properties, noiseBars: NOISE_BARS[level] } };
  });
}

function hexChannels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function inRoundRect(x: number, y: number, right: number, bottom: number, radius: number) {
  const cx = Math.min(Math.max(x, radius), right - radius);
  const cy = Math.min(Math.max(y, radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

// Four bars, short to tall, on a rounded card plate. Filled bars are the
// foreground; empty bars are the same color at 30% opacity, mixed onto the
// plate. The plate keeps the bars readable on a dark noise fill. The count
// is the level, so color is not the only cue.
export function noiseBarImage(
  filled: number,
  foreground: string,
  card: string,
): { width: number; height: number; data: Uint8Array } {
  const width = 48;
  const height = 48;
  const data = new Uint8Array(width * height * 4);
  const [fr, fg, fb] = hexChannels(foreground);
  const [cr, cg, cb] = hexChannels(card);
  const radius = 8;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inRoundRect(x + 0.5, y + 0.5, width - 1, height - 1, radius)) continue;
      const index = (y * width + x) * 4;
      data[index] = cr;
      data[index + 1] = cg;
      data[index + 2] = cb;
      data[index + 3] = 255;
    }
  }
  const barWidth = 8;
  const gap = 4;
  const heights = [12, 20, 30, 40];
  const bottom = 44;
  const left = Math.floor((width - (4 * barWidth + 3 * gap)) / 2);
  for (let bar = 0; bar < 4; bar++) {
    const mix = bar < filled ? 1 : 0.3;
    const barHeight = heights[bar] ?? 12;
    const x0 = left + bar * (barWidth + gap);
    for (let y = bottom - barHeight; y < bottom; y++) {
      for (let x = x0; x < x0 + barWidth; x++) {
        const index = (y * width + x) * 4;
        data[index] = Math.round(mix * fr + (1 - mix) * cr);
        data[index + 1] = Math.round(mix * fg + (1 - mix) * cg);
        data[index + 2] = Math.round(mix * fb + (1 - mix) * cb);
        data[index + 3] = 255;
      }
    }
  }
  return { width, height, data };
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
  if (!item.spaceId) return null;
  return spaces.find((space) => space.id === item.spaceId)?.noise ?? null;
}

/**
 * Which study rooms take which noise color.
 *
 * A space_locations room number wins, then an area that contains the room,
 * then a bookable room whose row stores a space. A missing link stays white.
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
