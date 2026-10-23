import type { FloorRecord } from "@/features/floor-alignment/floors";

type Drawable = Pick<FloorRecord, "building" | "floor" | "sheet" | "usable" | "geojson" | "labeled"> &
  Partial<Pick<FloorRecord, "rooms">>;

/**
 * Floors the map can draw, by building slug, lowest floor first, one entry
 * per floor. A floor drawn on several MPrint sheets (Hatcher's north and
 * south wings) has an index record per sheet, all pointing at the floor's
 * one GeoJSON; the first usable sheet stands for the floor, and the floor
 * counts as labeled when any of its sheets is.
 */
export function plansByBuilding<T extends Drawable>(records: readonly T[]): Map<string, (T & { geojson: string })[]> {
  const byBuilding = new Map<string, (T & { geojson: string })[]>();
  for (const record of records) {
    if (!record.usable || !record.geojson) continue;
    const list = byBuilding.get(record.building) ?? [];
    const same = list.findIndex((plan) => plan.floor === record.floor);
    if (same === -1) {
      list.push({ ...record, geojson: record.geojson });
    } else {
      const first = list[same];
      list[same] = {
        ...first,
        labeled: first.labeled || record.labeled,
        ...(first.rooms != null || record.rooms != null ? { rooms: (first.rooms ?? 0) + (record.rooms ?? 0) } : {}),
      };
    }
    byBuilding.set(record.building, list);
  }
  for (const list of byBuilding.values()) list.sort((a, b) => a.floor - b.floor);
  return byBuilding;
}
