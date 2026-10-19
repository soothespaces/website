import assert from "node:assert/strict";
import test from "node:test";
import { nextPosition, optimisticFavorites, reorderFavorites, type Favorite } from "./favorites.ts";

function spot(id: number, position: number, spaceId: string | null = `space-${id}`, buildingSlug: string | null = null): Favorite {
  return { id, position, spaceId, buildingSlug, createdAt: "2026-10-01T00:00:00Z" };
}

test("reorder rewrites positions and keeps leftovers in their old order", () => {
  const favorites = [spot(1, 0), spot(2, 1), spot(3, 2), spot(4, 3)];
  const next = reorderFavorites(favorites, [3, 1, 99]);
  assert.deepEqual(
    next.map((favorite) => [favorite.id, favorite.position]),
    [
      [3, 0],
      [1, 1],
      [2, 2],
      [4, 3],
    ],
  );
});

test("add appends at max + 1 and rollback restores the previous list", () => {
  const favorites = [spot(1, 0), spot(2, 4)];
  const { next, previous } = optimisticFavorites(favorites, {
    type: "add",
    favorite: { id: -1, spaceId: "space-9", buildingSlug: null, createdAt: "2026-10-19T00:00:00Z" },
  });
  assert.equal(next.at(-1)?.position, 5);
  assert.equal(nextPosition(favorites), 5);
  assert.deepEqual(previous, favorites);
  assert.notEqual(next, previous);

  const removed = optimisticFavorites(next, { type: "remove", target: { kind: "space", spaceId: "space-9" } });
  assert.deepEqual(
    removed.next.map((favorite) => favorite.id),
    favorites.map((favorite) => favorite.id),
  );
  assert.deepEqual(removed.previous, next);
  assert.deepEqual(optimisticFavorites(favorites, { type: "reorder", ids: [2, 1] }).previous, favorites);
});
