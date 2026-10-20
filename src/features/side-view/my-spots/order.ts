import type { Favorite } from "@/lib/data/favorites";
import { rankSpaces, type CatalogSpace, type RankContext } from "@/lib/ranking";

export type RotationSort = "best" | "mine";

export type RotationCatalog = CatalogSpace & { id: string };

export type SortableFavorite<T extends RotationCatalog = RotationCatalog> = {
  favorite: Favorite;
  catalog: T;
  closed: boolean;
};

/** Best now is F3.4, then closed spots last. My order is favorites.position. */
export function sortRotation<T extends SortableFavorite>(
  items: readonly T[],
  mode: RotationSort,
  context: RankContext = {},
): T[] {
  if (mode === "mine") {
    return [...items].sort((a, b) => a.favorite.position - b.favorite.position || a.favorite.id - b.favorite.id);
  }
  const ranked = rankSpaces(
    items.map((item) => item.catalog),
    context,
  );
  const order = new Map(ranked.map((entry, index) => [entry.space.id, index]));
  return [...items].sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
    return (order.get(a.catalog.id) ?? 0) - (order.get(b.catalog.id) ?? 0);
  });
}

/** Pixel shift while a row is dragged from `from` toward `over`. Heights are the rows at drag start. */
export function rowShift(index: number, from: number, over: number, heights: readonly number[]): number {
  if (from === over || from < 0 || over < 0 || index < 0) return 0;
  const height = heights[from] ?? 0;
  if (index === from) {
    let distance = 0;
    if (over > from) {
      for (let cursor = from + 1; cursor <= over; cursor++) distance += heights[cursor] ?? 0;
    } else {
      for (let cursor = over; cursor < from; cursor++) distance -= heights[cursor] ?? 0;
    }
    return distance;
  }
  if (over > from && index > from && index <= over) return -height;
  if (over < from && index >= over && index < from) return height;
  return 0;
}

/** The row whose midpoint the pointer has passed, using positions captured at drag start. */
export function dropIndex(mids: readonly number[], clientY: number): number {
  let over = 0;
  for (let index = 0; index < mids.length; index++) {
    if (clientY > (mids[index] ?? 0)) over = index;
  }
  return over;
}

/** Moves the id at `from` to `to`. Null when the indexes are the same or out of range. */
export function moveIds(ids: readonly number[], from: number, to: number): number[] | null {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return null;
  const next = [...ids];
  const [id] = next.splice(from, 1);
  if (id == null) return null;
  next.splice(to, 0, id);
  return next;
}
