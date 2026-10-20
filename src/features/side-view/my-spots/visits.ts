import { sameTarget, type Favorite, type FavoriteTarget } from "@/lib/data/favorites";
import { lastVisitedPhrase, visitedMeta } from "./copy";

export type ResolvedVisit = {
  key: string;
  name: string;
  buildingName: string | null;
  checkInCount: number;
  lastVisitedOn: string;
  target: FavoriteTarget;
};

export type VisitRow = ResolvedVisit & { meta: string };

/**
 * History places that are not already favorites, most check-ins first.
 * Two history rows that save the same spot collapse to the busier one.
 */
export function visitRows(visits: readonly ResolvedVisit[], favorites: readonly Favorite[], now: Date): VisitRow[] {
  const ordered = [...visits].sort(
    (a, b) => b.checkInCount - a.checkInCount || b.lastVisitedOn.localeCompare(a.lastVisitedOn) || a.name.localeCompare(b.name),
  );
  const seen = new Set<string>();
  const rows: VisitRow[] = [];
  for (const visit of ordered) {
    if (favorites.some((favorite) => sameTarget(favorite, visit.target))) continue;
    const key = visit.target.kind === "space" ? `space:${visit.target.spaceId}` : `building:${visit.target.buildingSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      ...visit,
      meta: visitedMeta(visit.buildingName, visit.checkInCount, lastVisitedPhrase(visit.lastVisitedOn, now)),
    });
  }
  return rows;
}
