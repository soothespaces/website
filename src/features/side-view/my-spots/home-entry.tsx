"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { useSession } from "@/lib/auth/use-session";
import { useFavorites } from "@/lib/data/favorites";
import { useMapState } from "@/features/map/map-state";

// See all on today's search results. Signed-out visitors get the link so they
// can open the sign-in prompt. Names come from the map's spaces, which already
// include ids, so Home does not read the spaces table again.
export function YourSpotsHomeEntry({ onOpened }: { onOpened?: () => void }) {
  const { loading } = useSession();
  const { push, data } = useMapState();
  const { favorites, signedIn, loaded } = useFavorites();

  if (loading) return null;
  if (signedIn && (!loaded || favorites.length === 0)) return null;

  const names = signedIn
    ? favorites.flatMap((favorite) => {
        if (favorite.spaceId) {
          return [data.spaces.find((space) => space.id === favorite.spaceId)?.name ?? "Saved spot"];
        }
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
