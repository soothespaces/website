"use client";

import type { ComponentType } from "react";
import { BuildingPanelScreen, SpacePanelScreen, type PanelScreenProps } from "./builtin-screens";
import type { PanelRoute } from "./panel-route";
import { SpacesScreen } from "./spaces/spaces-screen";

export type { PanelScreenProps };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], ComponentType<PanelScreenProps>>> = {
  building: BuildingPanelScreen,
  space: SpacePanelScreen,
  spaces: SpacesScreen,
};

// Detail screens draw their own back button and scroll their own body.
export const panelFillsFrame: ReadonlySet<PanelRoute["kind"]> = new Set(["spaces"]);
