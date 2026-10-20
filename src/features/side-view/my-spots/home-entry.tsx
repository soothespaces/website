"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { useFavorites } from "@/lib/data/favorites";
import { useMapState } from "@/features/map/map-state";
import { useSpotDirectory } from "./directory";

// Stand-in for H5's chip row on today's search results. Signed-out visitors,
// and signed-in visitors with no saved spots, do not see the section. They
// open My spots from the URL or the account menu and get the sign-in prompt there.
export function YourSpotsHomeEntry({ onOpened }: { onOpened?: () => void }) {
  const { push, data } = useMapState();
  const { favorites, signedIn, loaded } = useFavorites();
  const directory = useSpotDirectory([]);
  const names =
    directory.spacesLoaded
      ? favorites.flatMap((favorite) => {
          if (favorite.spaceId) return [directory.spaces.get(favorite.spaceId)?.name ?? "Saved spot"];
          if (favorite.buildingSlug) return [data.buildingsBySlug.get(favorite.buildingSlug)?.name ?? "Saved building"];
          return [];
        })
      : [];

  if (!signedIn || !loaded || favorites.length === 0) return null;

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
