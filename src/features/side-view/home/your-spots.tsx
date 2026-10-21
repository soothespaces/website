"use client";

import { HeartFilledIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { useMapState } from "@/features/map/map-state";
import type { MapData } from "@/features/map/use-map-data";
import { useFavorites, type Favorite } from "@/lib/data/favorites";

// Signed out, or signed in with nothing saved: the row is absent.
export function YourSpots() {
  const { data, push, select } = useMapState();
  const { favorites, signedIn, loaded } = useFavorites();
  if (!signedIn || !loaded) return null;

  const spots = favorites.flatMap((favorite) => {
    const spot = spotFor(favorite, data);
    if (!spot) return [];
    return [{ ...spot, onOpen: () => select(spot.selection) }];
  });
  if (spots.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title="Your spots" action={{ label: "See all", onClick: () => push({ kind: "my-spots" }) }} />
      <div className="flex flex-wrap gap-2">
        {spots.map((spot) => (
          <Button
            key={spot.key}
            variant="outline"
            onClick={(event) => {
              event.currentTarget.blur();
              spot.onOpen();
            }}
            className="h-auto max-w-full min-h-9 rounded-full px-3 text-sm font-medium whitespace-normal"
          >
            <HeartFilledIcon size="sm" className="text-destructive" />
            {spot.name}
          </Button>
        ))}
      </div>
    </section>
  );
}

function spotFor(favorite: Favorite, data: MapData) {
  if (favorite.spaceId) {
    const space = data.spaces.find((item) => item.id === favorite.spaceId);
    if (!space) return null;
    return { key: `space:${favorite.id}`, name: space.name, selection: { kind: "space" as const, slug: space.slug } };
  }
  if (favorite.buildingSlug) {
    const building = data.buildingsBySlug.get(favorite.buildingSlug);
    if (!building) return null;
    return {
      key: `building:${favorite.id}`,
      name: building.shortName || building.name,
      selection: {
        kind: "building" as const,
        slug: building.slug,
        recordNumber: building.recordNumber,
        name: building.name,
      },
    };
  }
  return null;
}
