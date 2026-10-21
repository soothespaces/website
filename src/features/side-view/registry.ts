"use client";

import type { ComponentType } from "react";
import { BuildingPanelScreen, SpacePanelScreen, type PanelScreenProps } from "./builtin-screens";
import { HoursScreen } from "./hours/hours-screen";
import type { PanelRoute } from "./panel-route";

export type { PanelScreenProps };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], ComponentType<PanelScreenProps>>> = {
  building: BuildingPanelScreen,
  space: SpacePanelScreen,
  hours: HoursScreen,
};

// Screens that draw their own back button and title. The selection panel
// hides its header for these and, when the frame has a fixed height, lets
// them fill it. Other detail screens add their kind here.
export const detailPanelKinds: ReadonlySet<PanelRoute["kind"]> = new Set(["hours"]);
