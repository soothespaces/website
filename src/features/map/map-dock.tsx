"use client";

import { SpaceSearchField } from "@/features/spaces";
import { useMediaQuery } from "@/lib/use-media-query";
import { WIDE_QUERY } from "./map-layout-config";
import { useMapState } from "./map-state";
import { panelRegistry } from "@/features/side-view/registry";
import { ResultsPanel } from "./panel/results-panel";
import { SelectionPanel } from "./panel/selection-panel";

// Wide screens: a column on the left of the map that's always there, with
// search on top and the results, or what's selected, below.
export function MapDock() {
  const wide = useMediaQuery(WIDE_QUERY);
  const { search, route } = useMapState();
  // Home stays the search results until its screen registers. The panel
  // scrolls inside itself so a covered screen keeps its place.
  const showResults = route.kind === "home" && !panelRegistry.home;
  // The home screen owns the search field. Other screens keep it pinned here.
  const homeOpen = route.kind === "home" && Boolean(panelRegistry.home);
  return (
    <aside
      aria-label="Study spaces"
      className="hidden w-80 shrink-0 flex-col border-r border-border bg-background md:flex lg:w-96"
    >
      {homeOpen ? null : (
        <div className="border-b border-border p-3">
          <SpaceSearchField value={search.query} onChange={search.setQuery} />
        </div>
      )}
      {/* Rendered only on wide screens, so the phone sheet and this never
          both hold the panel (and its ids). */}
      {wide ? (
        showResults ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <ResultsPanel density="compact" />
          </div>
        ) : (
          <SelectionPanel density="compact" />
        )
      ) : null}
    </aside>
  );
}
