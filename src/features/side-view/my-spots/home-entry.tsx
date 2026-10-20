"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { useFavorites } from "@/lib/data/favorites";
import { useMapState } from "@/features/map/map-state";
import { useSpotDirectory } from "./directory";

// The way into Your spots from today's Home (the search results), until H5
// draws the chip row. See all stays available when signed out.
export function YourSpotsHomeEntry({ onOpened }: { onOpened?: () => void }) {
  const { push, data } = useMapState();
  const { favorites, signedIn, loaded } = useFavorites();
  const directory = useSpotDirectory([]);
  const names =
    signedIn && loaded && directory.spacesLoaded
      ? favorites.flatMap((favorite) => {
          if (favorite.spaceId) return [directory.spaces.get(favorite.spaceId)?.name ?? "Saved spot"];
          if (favorite.buildingSlug) return [data.buildingsBySlug.get(favorite.buildingSlug)?.name ?? "Saved building"];
          return [];
        })
      : [];

  return (
    <div className="px-3 pb-3">
      <SectionHeader
        title="Your spots"
        action={{
          label: "See all",
          onClick: () => {
            push({ kind: "my-spots" });
            onOpened?.();
          },
        }}
      />
      {names.length > 0 ? <p className="mt-1 text-sm text-muted-foreground">{names.join(" · ")}</p> : null}
    </div>
  );
}
