import { fillNow, roomFloor, type MatchableRoom } from "@/features/map/layers/room-match";

// Which floor the rooms map opens on.
// A focused room wins, then the floor the user last left on, then the floor
// with the most rooms that are free right now. A tie goes to the floor with
// more bookable rooms, then the lowest floor. With no rooms, the first plan.
export function chooseRoomsMapFloor(input: {
  plans: readonly number[];
  rooms: readonly MatchableRoom[];
  focusedFloor?: number | null;
  rememberedFloor?: number | null;
}): number | null {
  const plans = [...new Set(input.plans)].filter((floor) => Number.isInteger(floor)).sort((a, b) => a - b);
  if (plans.length === 0) return null;
  const allowed = new Set(plans);
  if (input.focusedFloor != null && allowed.has(input.focusedFloor)) return input.focusedFloor;
  if (input.rememberedFloor != null && allowed.has(input.rememberedFloor)) return input.rememberedFloor;

  const counts = new Map<number, { free: number; total: number }>();
  for (const floor of plans) counts.set(floor, { free: 0, total: 0 });
  for (const room of input.rooms) {
    const floor = roomFloor(room);
    if (floor == null || !allowed.has(floor)) continue;
    const row = counts.get(floor);
    if (!row) continue;
    row.total += 1;
    if (fillNow(room) === "free") row.free += 1;
  }

  let best = plans[0]!;
  let bestFree = -1;
  let bestTotal = -1;
  for (const floor of plans) {
    const row = counts.get(floor)!;
    if (row.free > bestFree || (row.free === bestFree && row.total > bestTotal)) {
      best = floor;
      bestFree = row.free;
      bestTotal = row.total;
    }
  }
  return best;
}
