"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { BackIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/feedback";
import { SpaceSearchField } from "@/features/spaces";
import { EMPTY_SPACE_FILTERS, spaceFiltersActive } from "@/features/map/space-filters";
import { useMapState } from "@/features/map/map-state";
import { ResultsPanel } from "@/features/map/panel/results-panel";
import type { PanelScreenProps } from "../builtin-screens";
import { browseAllLabel, matchesFilters } from "./places";
import { GroupSize } from "./group-size";
import { OpenNearby } from "./open-nearby";
import { QuickChips } from "./quick-chips";
import { Recommended } from "./recommended";
import { useHomeCatalog } from "./use-home-catalog";
import { YourSpots } from "./your-spots";

// The panel the map opens on. Typing a search, or Browse all, shows the
// existing list in this same screen.
export function HomeScreen({ density }: PanelScreenProps) {
  const { search, data, filters, setFilters } = useMapState();
  const catalog = useHomeCatalog();
  const [browsing, setBrowsing] = useState(false);
  const query = search.query.trim();
  const showList = browsing || query.length > 0;
  const filtered = useMemo(
    () => catalog.spaces.filter((space) => matchesFilters(space, filters)),
    [catalog.spaces, filters],
  );
  const filteredOut = catalog.loaded && spaceFiltersActive(filters) && filtered.length === 0;

  return (
    <div
      data-detail-scroll=""
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-1 pb-3"
    >
      {/* Wide screens use the dock's field, which stays put while typing. */}
      <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-card px-2 py-2 md:hidden">
        <SpaceSearchField value={search.query} onChange={search.setQuery} />
      </div>
      {showList ? (
        <div className="flex flex-col gap-1">
          {browsing && !query ? (
            <Button variant="ghost" size="sm" onClick={() => setBrowsing(false)} className="justify-start px-1">
              <BackIcon />
              Home
            </Button>
          ) : null}
          <ResultsPanel density={density} />
        </div>
      ) : (
        <>
          <GroupSize />
          <QuickChips />
          {catalog.loaded ? (
            filteredOut ? (
              <NoMatches onClear={() => setFilters(EMPTY_SPACE_FILTERS)} />
            ) : (
              <Recommended spaces={filtered} />
            )
          ) : (
            <HomeLoading />
          )}
          <YourSpots />
          {catalog.loaded && !filteredOut ? <OpenNearby spaces={filtered} /> : null}
          <Button variant="outline" className="w-full" onClick={() => setBrowsing(true)}>
            {browseAllLabel(data.loaded ? data.spaces.length : null)}
          </Button>
        </>
      )}
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <p className="text-sm">
      No spaces match.{" "}
      <Button variant="ghost" size="sm" onClick={onClear} className="h-auto min-h-0 px-1 py-0">
        Clear filters
      </Button>
    </p>
  );
}

function HomeLoading() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Loading study spaces</span>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
