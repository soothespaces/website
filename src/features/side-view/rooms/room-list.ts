import type { GroupSize } from "@/lib/ranking";
import type { RoomSlot } from "@/lib/data/room-slots";

export type RoomSize = "any" | GroupSize;

export const ROOM_SIZES: { value: RoomSize; label: string }[] = [
  { value: "any", label: "Any size" },
  { value: "just_me", label: "Just me" },
  { value: "2_3", label: "2–3" },
  { value: "4_plus", label: "4+" },
];

/** Shared by the hour ticks and each room row so the columns stay aligned. */
export const roomColumns = "grid w-full grid-cols-[minmax(5.5rem,0.9fr)_minmax(0,1.25fr)] gap-x-3";

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

export function isFreeNow(room: Pick<RoomSlot, "status" | "slots">): boolean {
  if (room.slots == null) return false;
  return room.status.startsWith("Free");
}

/**
 * Floor to open on the rooms map: the plan floor with the most rooms free
 * right now. Ties keep the lower floor. With no free rooms, the first plan
 * floor that has rooms. With no rooms on a plan, the first plan floor.
 * Null when the building has no vector plan.
 */
export function chooseRoomsMapFloor(
  rooms: readonly Pick<RoomSlot, "floor" | "status" | "slots">[],
  planFloors: readonly number[],
): number | null {
  if (planFloors.length === 0) return null;
  const plans = [...new Set(planFloors)].sort((a, b) => a - b);
  const stats = new Map<number, { free: number; total: number }>();
  for (const floor of plans) stats.set(floor, { free: 0, total: 0 });
  for (const room of rooms) {
    if (room.floor == null) continue;
    const stat = stats.get(room.floor);
    if (!stat) continue;
    stat.total += 1;
    if (isFreeNow(room)) stat.free += 1;
  }
  const withRooms = plans.filter((floor) => (stats.get(floor)?.total ?? 0) > 0);
  const pool = withRooms.length > 0 ? withRooms : plans;
  return pool.reduce((best, floor) => {
    const free = stats.get(floor)?.free ?? 0;
    const bestFree = stats.get(best)?.free ?? 0;
    return free > bestFree ? floor : best;
  });
}
