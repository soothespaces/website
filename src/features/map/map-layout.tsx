"use client";

import { useState } from "react";
import { CheckInHost } from "@/features/check-in/check-in-host";
import { LocationPrompt } from "@/features/check-in/location-prompt";
import { useMediaQuery } from "@/lib/use-media-query";
import { CampusMap } from "./lazy-campus-map";
import { MapDock } from "./map-dock";
import { MapExplorer } from "./map-explorer";
import { WIDE_QUERY } from "./map-layout-config";
import { MapSearchBar } from "./map-search-bar";
import { MapSearchScreen } from "./map-search-screen";
import { MapSheet } from "./map-sheet";
import "./map-layout.css";
import { MapStateProvider } from "./map-state";

// The map page, laid out like a maps app. Wide screens: a dock on the left
// (search and a compact list) beside the map. Phones: a floating search bar
// that opens full-screen search, and a sheet for what's selected. All of
// them share one useMapState().
export function MapLayout() {
  const wide = useMediaQuery(WIDE_QUERY);
  const [searching, setSearching] = useState(false);

  return (
    <MapStateProvider>
      <CheckInHost>
        <div className="flex h-full min-h-0 flex-1">
          <MapDock />
          <div className="relative min-w-0 flex-1">
            <CampusMap>
              <MapExplorer />
            </CampusMap>
            <MapSearchBar onOpen={() => setSearching(true)} />
            <MapSheet />
            <LocationPrompt />
          </div>
        </div>
        {/* Widening the window while searching leaves the dock to do the job. */}
        <MapSearchScreen open={searching && !wide} onOpenChange={setSearching} />
      </CheckInHost>
    </MapStateProvider>
  );
}
