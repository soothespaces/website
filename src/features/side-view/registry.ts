"use client";

import type { ComponentType } from "react";
import { BuildingPanelScreen, SpacePanelScreen, type PanelScreenProps } from "./builtin-screens";
import type { PanelRoute } from "./panel-route";
import { RoomsScreen } from "./rooms/rooms-screen";
import { RoomsDrawer } from "./rooms-map/rooms-drawer";

export type { PanelScreenProps };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], ComponentType<PanelScreenProps>>> = {
  building: BuildingPanelScreen,
  space: SpacePanelScreen,
  rooms: RoomsScreen,
  "rooms-map": RoomsDrawer,
};
