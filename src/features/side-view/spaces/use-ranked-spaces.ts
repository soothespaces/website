"use client";

import { useMemo } from "react";
import { useMapState } from "@/features/map/map-state";
import type { CatalogSpace, RankContext } from "@/lib/ranking";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import { groupSpacesByFloor, rankWithinFloors, type FloorGroup, type FloorSource } from "./space-floors";

/**
 * Orders the spaces already chosen for the list. Preferences and group size
 * reorder rows inside a floor; they do not remove floors or spaces.
 */
export function useRankedSpaces<T extends FloorSource & CatalogSpace>(spaces: readonly T[]): FloorGroup<T>[] {
  const { study } = useStudyPreferences();
  const { groupSize } = useMapState();
  return useMemo(() => {
    const context: RankContext = {
      preferences: study,
      groupSize: groupSize ?? undefined,
    };
    return rankWithinFloors(groupSpacesByFloor(spaces), context);
  }, [spaces, study, groupSize]);
}
