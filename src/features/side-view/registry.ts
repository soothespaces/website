"use client";

import type { ComponentType } from "react";
import { BuildingPanelScreen, type PanelScreenProps } from "./builtin-screens";
import type { PanelRoute } from "./panel-route";
import { SpaceScreen } from "./space/space-screen";

export type { PanelScreenProps };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], ComponentType<PanelScreenProps>>> = {
  building: BuildingPanelScreen,
  space: SpaceScreen,
};

// These screens draw their own back control. The shared panel header would
// stack a second Back (and a Close the space board does not have) above it.
export const panelScreenChrome = new Set<PanelRoute["kind"]>(["space"]);
