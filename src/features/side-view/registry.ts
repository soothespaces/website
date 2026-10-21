"use client";

import type { ComponentType } from "react";
import type { PanelScreenProps } from "./builtin-screens";
import { BuildingPanelScreen } from "./building/building-screen";
import { HomeScreen } from "./home/home-screen";
import { HoursScreen } from "./hours/hours-screen";
import { PhotosScreen } from "./photos/photos-screen";
import type { PanelRoute } from "./panel-route";
import { PreferencesScreen } from "./preferences/preferences-screen";
import { RoomsScreen } from "./rooms/rooms-screen";
import { SpaceScreen } from "./space/space-screen";
import { SpacesScreen } from "./spaces/spaces-screen";

export type { PanelScreenProps };

// One screen per route kind. A Wave 1 ticket adds its component here; kinds
// with no entry render a placeholder in the selection panel.
export const panelRegistry: Partial<Record<PanelRoute["kind"], ComponentType<PanelScreenProps>>> = {
  home: HomeScreen,
  building: BuildingPanelScreen,
  space: SpaceScreen,
  hours: HoursScreen,
  photos: PhotosScreen,
  spaces: SpacesScreen,
  rooms: RoomsScreen,
  preferences: PreferencesScreen,
};

// These screens draw their own back button and title (Home needs none), and
// fill the frame so a footer stays visible. The selection panel hides its own
// header for them.
export const detailPanelKinds: ReadonlySet<PanelRoute["kind"]> = new Set([
  "home",
  "building",
  "hours",
  "photos",
  "spaces",
  "space",
  "rooms",
  "preferences",
]);
