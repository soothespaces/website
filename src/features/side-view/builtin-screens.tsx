"use client";

import type { SpaceListDensity } from "@/features/spaces";
import type { PanelRoute } from "./panel-route";

export type PanelScreenProps = {
  route: PanelRoute;
  density: SpaceListDensity;
};
