"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth/use-session";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { readAll } from "./read-all";

export type FavoriteTarget = { kind: "space"; spaceId: string } | { kind: "building"; buildingSlug: string };

export type Favorite = {
  id: number;
  spaceId: string | null;
  buildingSlug: string | null;
  position: number;
  createdAt: string;
};

export type FavoriteMutation = { ok: true } | { ok: false; error: "needs-sign-in" | "failed" };

type FavoriteRecord = {
  id: number;
  space_id: string | null;
  building_slug: string | null;
  position: number;
  created_at: string;
};

const FAVORITE_SELECT = "id, space_id, building_slug, position, created_at";

export function toFavorite(record: FavoriteRecord): Favorite {
  return {
    id: record.id,
    spaceId: record.space_id,
    buildingSlug: record.building_slug,
    position: record.position,
    createdAt: record.created_at,
  };
}

export function sameTarget(favorite: Favorite, target: FavoriteTarget): boolean {
  return target.kind === "space" ? favorite.spaceId === target.spaceId : favorite.buildingSlug === target.buildingSlug;
}

export function nextPosition(favorites: readonly Favorite[]): number {
  return favorites.reduce((max, favorite) => Math.max(max, favorite.position), -1) + 1;
}

/** Appends at the end. `position` is one past the current max. */
export function withAddedFavorite(favorites: readonly Favorite[], favorite: Omit<Favorite, "position">): Favorite[] {
  return [...favorites, { ...favorite, position: nextPosition(favorites) }];
}

export function withoutFavorite(favorites: readonly Favorite[], target: FavoriteTarget): Favorite[] {
  return favorites.filter((favorite) => !sameTarget(favorite, target));
}

/**
 * Rewrites `position` to 0..n-1 in `ids` order. Ids the list doesn't have are
 * skipped. Favorites left out of `ids` keep their relative order after those.
 */
/**
 * Writes positions one at a time. If a later write fails, the ones that
 * succeeded are put back, so the table is not left half reordered.
 */
export async function writeFavoritePositions(
  favorites: readonly Favorite[],
  previous: readonly Favorite[],
  update: (id: number, position: number) => Promise<void>,
): Promise<void> {
  const applied: Favorite[] = [];
  try {
    for (const favorite of favorites) {
      if (favorite.id < 0) continue;
      await update(favorite.id, favorite.position);
      applied.push(favorite);
    }
  } catch (error) {
    for (const favorite of applied) {
      const prior = previous.find((row) => row.id === favorite.id);
      if (prior) await update(favorite.id, prior.position);
    }
    throw error;
  }
}

export function reorderFavorites(favorites: readonly Favorite[], ids: readonly number[]): Favorite[] {
  const byId = new Map(favorites.map((favorite) => [favorite.id, favorite]));
  const listed = ids.flatMap((id) => {
    const favorite = byId.get(id);
    return favorite ? [favorite] : [];
  });
  const listedIds = new Set(listed.map((favorite) => favorite.id));
  const rest = favorites.filter((favorite) => !listedIds.has(favorite.id));
  return [...listed, ...rest].map((favorite, position) => ({ ...favorite, position }));
}

/**
 * The optimistic list plus the list to put back if the write fails.
 * Rollback is the caller's previous array, unchanged.
 */
export function optimisticFavorites(
  favorites: readonly Favorite[],
  action: { type: "add"; favorite: Omit<Favorite, "position"> } | { type: "remove"; target: FavoriteTarget } | { type: "reorder"; ids: readonly number[] },
): { next: Favorite[]; previous: Favorite[] } {
  const previous = [...favorites];
  if (action.type === "add") return { next: withAddedFavorite(previous, action.favorite), previous };
  if (action.type === "remove") return { next: withoutFavorite(previous, action.target), previous };
  return { next: reorderFavorites(previous, action.ids), previous };
}

type Snapshot = {
  userId: string | null;
  favorites: Favorite[];
  loaded: boolean;
};

const EMPTY_FAVORITES: Favorite[] = [];
const EMPTY: Snapshot = { userId: null, favorites: EMPTY_FAVORITES, loaded: false };
let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();
// Bumped on every local change so a load that started earlier can't overwrite it.
let generation = 0;
let requestedUser: string | null | undefined;
let loadPromise: Promise<void> | null = null;
const inflightAdds = new Map<number, { cancelled: boolean }>();

function emit(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY;
}

export type FavoritesApi = {
  favorites: Favorite[];
  loaded: boolean;
  signedIn: boolean;
  isFavorite: (target: FavoriteTarget) => boolean;
  add: (target: FavoriteTarget) => Promise<FavoriteMutation>;
  remove: (target: FavoriteTarget) => Promise<FavoriteMutation>;
  reorder: (ids: number[]) => Promise<FavoriteMutation>;
};

function insertRow(target: FavoriteTarget, position: number): {
  space_id: string | null;
  building_slug: string | null;
  position: number;
} {
  if (target.kind === "space") return { space_id: target.spaceId, building_slug: null, position };
  return { space_id: null, building_slug: target.buildingSlug, position };
}

// One read per signed-in user, shared by every heart that mounts the hook.
function ensureFavorites(userId: string | null) {
  if (!userId || !getSupabaseEnv()) {
    if (requestedUser === userId && snapshot.loaded && snapshot.userId === userId) return;
    generation += 1;
    requestedUser = userId;
    loadPromise = null;
    emit({ userId, favorites: EMPTY_FAVORITES, loaded: true });
    return;
  }
  if (requestedUser === userId && (snapshot.userId === userId && snapshot.loaded || loadPromise)) return;
  requestedUser = userId;
  const loadGeneration = generation;
  const supabase = createClient();
  loadPromise = readAll<FavoriteRecord>((from, to) =>
    supabase.from("favorites").select(FAVORITE_SELECT).order("position").order("id").range(from, to),
  )
    .then((rows) => {
      if (loadGeneration !== generation || requestedUser !== userId) return;
      emit({ userId, favorites: rows.map(toFavorite), loaded: true });
    })
    .catch((error: unknown) => {
      console.error("Favorites failed to load", error);
      if (loadGeneration !== generation || requestedUser !== userId) return;
      emit({ userId, favorites: EMPTY_FAVORITES, loaded: true });
    })
    .finally(() => {
      if (requestedUser === userId) loadPromise = null;
    });
}

/**
 * One module-level list, so a heart on the building panel and Your spots
 * stay in sync. Signed out: an empty list, and add reports needs-sign-in.
 */
export function useFavorites(): FavoritesApi {
  const toast = useToast();
  const { user, loading } = useSession();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading) return;
    ensureFavorites(userId);
  }, [loading, userId]);

  const fail = useCallback(
    (title: string) => {
      toast({ title, description: "Try again in a moment." });
      return { ok: false, error: "failed" } as const;
    },
    [toast],
  );

  const add = useCallback(
    async (target: FavoriteTarget): Promise<FavoriteMutation> => {
      if (!userId) return { ok: false, error: "needs-sign-in" };
      if (snapshot.favorites.some((favorite) => sameTarget(favorite, target))) return { ok: true };
      const tempId = -Date.now();
      const { next } = optimisticFavorites(snapshot.favorites, {
        type: "add",
        favorite: { id: tempId, spaceId: target.kind === "space" ? target.spaceId : null, buildingSlug: target.kind === "building" ? target.buildingSlug : null, createdAt: new Date().toISOString() },
      });
      const position = next.find((favorite) => favorite.id === tempId)?.position ?? nextPosition(snapshot.favorites);
      const inflight = { cancelled: false };
      inflightAdds.set(tempId, inflight);
      generation += 1;
      emit({ userId, favorites: next, loaded: true });
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from("favorites").insert(insertRow(target, position)).select(FAVORITE_SELECT).single();
        if (error) throw error;
        inflightAdds.delete(tempId);
        if (inflight.cancelled) {
          const { error: deleteError } = await supabase.from("favorites").delete().eq("id", data.id);
          if (deleteError) throw deleteError;
          emit({ ...snapshot, favorites: snapshot.favorites.filter((favorite) => favorite.id !== tempId && favorite.id !== data.id) });
          return { ok: true };
        }
        emit({
          ...snapshot,
          favorites: snapshot.favorites.map((favorite) => (favorite.id === tempId ? toFavorite(data) : favorite)),
        });
        return { ok: true };
      } catch (error) {
        console.error("Favorite add failed", error);
        inflightAdds.delete(tempId);
        if (!inflight.cancelled) emit({ ...snapshot, favorites: snapshot.favorites.filter((favorite) => favorite.id !== tempId) });
        return fail("Couldn't save that spot");
      }
    },
    [fail, userId],
  );

  const remove = useCallback(
    async (target: FavoriteTarget): Promise<FavoriteMutation> => {
      if (!userId) return { ok: false, error: "needs-sign-in" };
      const current = snapshot.favorites.find((favorite) => sameTarget(favorite, target));
      if (!current) return { ok: true };
      const inflight = inflightAdds.get(current.id);
      if (inflight) {
        inflight.cancelled = true;
        generation += 1;
        emit({ userId, favorites: withoutFavorite(snapshot.favorites, target), loaded: true });
        return { ok: true };
      }
      const { next } = optimisticFavorites(snapshot.favorites, { type: "remove", target });
      generation += 1;
      emit({ userId, favorites: next, loaded: true });
      try {
        const supabase = createClient();
        const { error } = await supabase.from("favorites").delete().eq("id", current.id);
        if (error) throw error;
        return { ok: true };
      } catch (error) {
        console.error("Favorite remove failed", error);
        const restored = snapshot.favorites.some((favorite) => favorite.id === current.id)
          ? snapshot.favorites
          : [...snapshot.favorites, current].sort((a, b) => a.position - b.position || a.id - b.id);
        emit({ ...snapshot, favorites: restored });
        return fail("Couldn't update your spots");
      }
    },
    [fail, userId],
  );

  const reorder = useCallback(
    async (ids: number[]): Promise<FavoriteMutation> => {
      if (!userId) return { ok: false, error: "needs-sign-in" };
      const { next, previous } = optimisticFavorites(snapshot.favorites, { type: "reorder", ids });
      generation += 1;
      emit({ userId, favorites: next, loaded: true });
      try {
        const supabase = createClient();
        await writeFavoritePositions(next, previous, async (id, position) => {
          const { error } = await supabase.from("favorites").update({ position }).eq("id", id);
          if (error) throw error;
        });
        return { ok: true };
      } catch (error) {
        console.error("Favorite reorder failed", error);
        emit({ ...snapshot, favorites: previous });
        return fail("Couldn't reorder your spots");
      }
    },
    [fail, userId],
  );

  const visible = snap.userId === userId ? snap.favorites : EMPTY_FAVORITES;
  const isFavorite = useCallback((target: FavoriteTarget) => visible.some((favorite) => sameTarget(favorite, target)), [visible]);

  return {
    favorites: visible,
    loaded: !loading && snap.userId === userId && snap.loaded,
    signedIn: userId != null,
    isFavorite,
    add,
    remove,
    reorder,
  };
}
