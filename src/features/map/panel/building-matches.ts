import type { MapBuilding } from "../use-map-data";

const LIMIT = 8;

// Buildings whose name or short name has every word of the query, in name
// order. A footprint is otherwise only a click target on the canvas, so
// search is how a keyboard or screen reader reaches one (QA-011).
export function matchBuildings<T extends Pick<MapBuilding, "slug" | "name" | "shortName">>(
  query: string,
  buildings: Iterable<T>,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches: T[] = [];
  for (const building of buildings) {
    const haystack = `${building.name} ${building.shortName ?? ""}`.toLowerCase();
    if (words.every((word) => haystack.includes(word))) matches.push(building);
  }
  return matches
    .sort((a, b) => (a.shortName ?? a.name).localeCompare(b.shortName ?? b.name))
    .slice(0, LIMIT);
}
