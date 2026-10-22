import type { GroupSize } from "@/lib/ranking";
import type { RoomSlot } from "@/lib/data/room-slots";

export { chooseRoomsMapFloor } from "../rooms-map/choose-floor";

export type RoomSize = "any" | GroupSize;

export const ROOM_SIZES: { value: RoomSize; label: string }[] = [
  { value: "any", label: "Any size" },
  { value: "just_me", label: "Just me" },
  { value: "2_3", label: "2–3" },
  { value: "4_plus", label: "4+" },
];

/**
 * Shared by the hour ticks and each room row so the columns stay aligned.
 * The timeline stays at least 11rem so 8 PM, 9 PM, 10 PM and 11 PM don't
 * sit on top of each other when the dock is 320px. The name column wraps.
 */
export const roomColumns =
  "grid w-full grid-cols-[minmax(4.5rem,1fr)_minmax(11rem,1.6fr)] gap-x-2";

export function roomSizeFromGroup(groupSize: GroupSize | null): RoomSize {
  return groupSize ?? "any";
}

export function isRoomSize(value: string): value is RoomSize {
  return ROOM_SIZES.some((size) => size.value === value);
}

/** A room fits the chip when its capacity is at least the group. Unknown capacity only matches Any size. */
export function roomMatchesSize(capacity: number | null, size: RoomSize): boolean {
  if (size === "any") return true;
  if (capacity == null || !Number.isFinite(capacity)) return false;
  if (size === "just_me") return capacity >= 1;
  if (size === "2_3") return capacity >= 2;
  return capacity >= 4;
}

/** "Tonight", "Today", or "This afternoon" from minutes past Detroit midnight. */
export function periodLabel(minutes: number): "Today" | "This afternoon" | "Tonight" {
  const minute = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  if (minute >= 12 * 60 && minute < 17 * 60) return "This afternoon";
  if (minute >= 5 * 60 && minute < 12 * 60) return "Today";
  return "Tonight";
}

export type FloorGroup = {
  floor: number | null;
  label: string;
  rooms: RoomSlot[];
};

export function groupRoomsByFloor(rooms: readonly RoomSlot[]): FloorGroup[] {
  const byFloor = new Map<number | null, RoomSlot[]>();
  for (const room of rooms) {
    const list = byFloor.get(room.floor) ?? [];
    list.push(room);
    byFloor.set(room.floor, list);
  }
  return [...byFloor.entries()]
    .sort((a, b) => (a[0] ?? 999) - (b[0] ?? 999))
    .map(([floor, list]) => ({
      floor,
      label: floor == null ? "Other" : `Floor ${floor}`,
      rooms: list,
    }));
}

