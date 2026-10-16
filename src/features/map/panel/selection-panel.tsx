"use client";

import type { SpaceListDensity } from "@/features/spaces";
import { type MapSelection, useMapState } from "../map-state";
import { BuildingPanel } from "./building-panel";
import { PanelHeader } from "./panel-header";
import { SpacePanel } from "./space-panel";

// What's selected, with Back and Close. Shared by the dock and the phone
// sheet, which only differ in the frame around it.
export function SelectionPanel({ selection, density }: { selection: MapSelection; density: SpaceListDensity }) {
  const { canGoBack, back, clear } = useMapState();
  return (
    <div className="flex flex-col gap-1">
      <PanelHeader canGoBack={canGoBack} onBack={back} onClose={clear} />
      {selection.kind === "building" ? (
        <BuildingPanel building={selection} density={density} />
      ) : (
        <SpacePanel slug={selection.slug} />
      )}
    </div>
  );
}
