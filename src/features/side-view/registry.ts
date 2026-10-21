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

// Screens that draw their own back control. The selection panel hides its
// header for these. Preferences (#52) uses the same set; union the kinds
// when that branch lands.
export const detailPanelKinds: ReadonlySet<PanelRoute["kind"]> = new Set(["space"]);
