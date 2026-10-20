"use client";

import type { ComponentType } from "react";
import { BuildingPanelScreen, SpacePanelScreen, type PanelScreenProps } from "./builtin-screens";
import type { PanelRoute } from "./panel-route";
import { RoomsScreen } from "./rooms/rooms-screen";

export type { PanelScreenProps };

export type PanelScreen = ComponentType<PanelScreenProps> & {
  /** Draws its own back button and scroll area, so the panel frame gets out of the way. */
  detailScreen?: boolean;
};

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], PanelScreen>> = {
  building: BuildingPanelScreen,
  space: SpacePanelScreen,
  rooms: RoomsScreen,
};
