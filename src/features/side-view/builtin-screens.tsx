"use client";

import type { SpaceListDensity } from "@/features/spaces";
import { SpacePanel } from "@/features/map/panel/space-panel";
import type { PanelRoute } from "./panel-route";

export type PanelScreenProps = {
  route: PanelRoute;
  density: SpaceListDensity;
};

// `route.id` is the space slug. G1 replaces this registration.
export function SpacePanelScreen({ route }: PanelScreenProps) {
  if (route.kind !== "space") return null;
  return <SpacePanel slug={route.id} />;
}
