"use client";

import type { SpaceListDensity } from "@/features/spaces";
import { BuildingPanel } from "@/features/map/panel/building-panel";
import { useMapState } from "@/features/map/map-state";
import type { PanelRoute } from "./panel-route";

export type PanelScreenProps = {
  route: PanelRoute;
  density: SpaceListDensity;
};

// Today's building panel, addressed by the building route. A1 replaces this
// registration with the side-view screen.
export function BuildingPanelScreen({ route, density }: PanelScreenProps) {
  const { data } = useMapState();
  if (route.kind !== "building") return null;
  const known = route.slug ? data.buildingsBySlug.get(route.slug) : undefined;
  return (
    <BuildingPanel
      building={{
        kind: "building",
        slug: route.slug,
        recordNumber: route.recordNumber ?? known?.recordNumber ?? null,
        name: route.name || known?.name || "Building",
      }}
      density={density}
    />
  );
}
