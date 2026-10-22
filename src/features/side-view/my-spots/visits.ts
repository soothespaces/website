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

function targetKey(target: FavoriteTarget): string {
  return target.kind === "space" ? `space:${target.spaceId}` : `building:${target.buildingSlug}`;
}

/**
 * History places that are not already favorites, most check-ins first.
 * A room and its parent space are one row, and their check-ins add together.
 * The space's own name wins when both are present. The phrase uses the later visit.
 */
export function visitRows(visits: readonly ResolvedVisit[], favorites: readonly Favorite[], now: Date): VisitRow[] {
  const byTarget = new Map<string, ResolvedVisit>();
  for (const visit of visits) {
    if (favorites.some((favorite) => sameTarget(favorite, visit.target))) continue;
    const key = targetKey(visit.target);
    const existing = byTarget.get(key);
    if (!existing) {
      byTarget.set(key, { ...visit });
      continue;
    }
    const later = visit.lastVisitedOn > existing.lastVisitedOn ? visit : existing;
    const named = visit.key.startsWith("space:") ? visit : existing.key.startsWith("space:") ? existing : later;
    byTarget.set(key, {
      ...named,
      checkInCount: existing.checkInCount + visit.checkInCount,
      lastVisitedOn: later.lastVisitedOn,
      buildingName: named.buildingName ?? later.buildingName,
    });
  }
  return [...byTarget.values()]
    .sort((a, b) => b.checkInCount - a.checkInCount || b.lastVisitedOn.localeCompare(a.lastVisitedOn) || a.name.localeCompare(b.name))
    .map((visit) => ({
      ...visit,
      meta: visitedMeta(visit.buildingName, visit.checkInCount, lastVisitedPhrase(visit.lastVisitedOn, now)),
    }));
}
