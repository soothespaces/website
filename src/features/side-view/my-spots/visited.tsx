"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { HeartFilledIcon, HeartIcon } from "@/components/ui/icons";
import { useFavorites, type FavoriteTarget } from "@/lib/data/favorites";
import type { HistoryPlace, MyHistoryState } from "@/lib/data/my-history";
import { useMapState } from "@/features/map/map-state";
import { useSpotDirectory, type DirectoryRoom, type DirectorySpace, type SpotDirectory } from "./directory";
import { visitRows, type ResolvedVisit } from "./visits";

// J5. Places from the signed-in user's own check-in history that are not favorites yet.
export function Visited({ now, history }: { now: Date; history: MyHistoryState }) {
  const { favorites } = useFavorites();
  const roomIds = useMemo(
    () => history.places.filter((place) => place.targetKind === "room").map((place) => place.targetId),
    [history.places],
  );
  const directory = useSpotDirectory(roomIds);
  const { data } = useMapState();

  if (!history.loaded || !directory.spacesLoaded || (roomIds.length > 0 && !directory.roomsLoaded)) {
    return (
      <div role="status">
        <span className="sr-only">Loading places you’ve checked in</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-12 w-full" />
      </div>
    );
  }

  if (history.error) {
    return (
      <section className="flex flex-col gap-1">
        <h2 className="text-base">Places you’ve checked in</h2>
        <p className="text-sm text-muted-foreground">{history.error}</p>
      </section>
    );
  }

  if (!history.places.length) return null;

  const rows = visitRows(resolveVisits(history.places, directory, data.buildingsBySlug), favorites, now);
  if (!rows.length) return null;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-base">Places you’ve checked in</h2>
        <p className="text-sm text-muted-foreground">Only you can see this. Add the ones you keep coming back to.</p>
      </div>
      <ul className="flex flex-col" aria-label="Places you’ve checked in">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold break-words">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.meta}</p>
            </div>
            <AddButton name={row.name} target={row.target} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddButton({ name, target }: { name: string; target: FavoriteTarget }) {
  const { add, isFavorite } = useFavorites();
  const added = isFavorite(target);
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={added || pending}
      aria-label={added ? `${name} added to your spots` : `Add ${name} to your spots`}
      onClick={() => {
        if (added || pending) return;
        setPending(true);
        void add(target).finally(() => setPending(false));
      }}
    >
      {added ? <HeartFilledIcon className="text-destructive" /> : <HeartIcon />}
      {added ? "Added" : "Add"}
    </Button>
  );
}

function resolveVisits(
  places: readonly HistoryPlace[],
  directory: SpotDirectory,
  buildings: ReturnType<typeof useMapState>["data"]["buildingsBySlug"],
): ResolvedVisit[] {
  const visits: ResolvedVisit[] = [];
  for (const place of places) {
    if (place.targetKind === "space") {
      const space = directory.spaces.get(place.targetId);
      visits.push({
        key: `space:${place.targetId}`,
        name: space?.name ?? "Checked-in spot",
        buildingName: buildingName(space?.buildingSlug ?? null, buildings),
        checkInCount: place.checkInCount,
        lastVisitedOn: place.lastVisitedOn,
        target: { kind: "space", spaceId: place.targetId },
      });
      continue;
    }
    const room = directory.rooms.get(place.targetId);
    // A room can be saved only when it belongs to a study space. Favorites are spaces or whole buildings.
    if (!room?.spaceId) continue;
    const space = directory.spaces.get(room.spaceId);
    visits.push({
      key: `room:${place.targetId}`,
      name: roomLabel(room, space),
      buildingName: buildingName(space?.buildingSlug ?? room.buildingSlug, buildings),
      checkInCount: place.checkInCount,
      lastVisitedOn: place.lastVisitedOn,
      target: { kind: "space", spaceId: room.spaceId },
    });
  }
  return visits;
}

function roomLabel(room: DirectoryRoom, space: DirectorySpace | undefined): string {
  if (space?.name) return space.name;
  const named = room.name?.trim();
  if (named) return named;
  return `Room ${room.roomNumber}`;
}

function buildingName(
  slug: string | null,
  buildings: ReturnType<typeof useMapState>["data"]["buildingsBySlug"],
): string | null {
  if (!slug) return null;
  return buildings.get(slug)?.name ?? null;
}
