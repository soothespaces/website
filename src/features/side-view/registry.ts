"use client";

import type { ComponentType } from "react";
import { BuildingPanelScreen, SpacePanelScreen, type PanelScreenProps } from "./builtin-screens";
import { PhotosScreen } from "./photos/photos-screen";
import type { PanelRoute } from "./panel-route";

export type { PanelScreenProps };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], ComponentType<PanelScreenProps>>> = {
  building: BuildingPanelScreen,
  space: SpacePanelScreen,
  photos: PhotosScreen,
};

// These screens draw their own back button and title, and fill the frame so
// a footer stays visible. The selection panel hides its own header for them.
export const detailPanelKinds: ReadonlySet<PanelRoute["kind"]> = new Set(["photos"]);
