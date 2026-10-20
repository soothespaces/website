"use client";

import type { ComponentType } from "react";
import { SpacePanelScreen, type PanelScreenProps } from "./builtin-screens";
import { BuildingPanelScreen } from "./building/building-screen";
import type { PanelRoute } from "./panel-route";

export type { PanelScreenProps };

export type PanelScreenComponent = ComponentType<PanelScreenProps> & { ownsChrome?: boolean };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel. `ownsChrome`
// means the screen draws its own back and close row.
export const panelRegistry: Partial<Record<PanelRoute["kind"], PanelScreenComponent>> = {
  building: BuildingPanelScreen,
  space: SpacePanelScreen,
};
