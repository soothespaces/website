"use client";

import type { ComponentType } from "react";
import { BuildingPanelScreen, SpacePanelScreen, type PanelScreenProps } from "./builtin-screens";
import { MySpotsScreen } from "./my-spots/my-spots-screen";
import type { PanelRoute } from "./panel-route";

export type { PanelScreenProps };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], ComponentType<PanelScreenProps>>> = {
  building: BuildingPanelScreen,
  space: SpacePanelScreen,
  "my-spots": MySpotsScreen,
};

// DetailScreen draws its own back button and title, so the panel frame
// does not add a second header on top of these routes.
export const SELF_CHROME_KINDS = new Set<PanelRoute["kind"]>(["my-spots"]);
