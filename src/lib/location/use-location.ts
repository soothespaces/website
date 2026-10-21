"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  distanceToBuildingMeters,
  findNearestBuilding,
  isInsideBuilding,
  type BuildingLatLng,
  type GeoPoint,
} from "./index";
import { ensureStarted, getServerSnapshot, getSnapshot, requestFix, subscribe } from "./store";

/**
 * Location permission for check-in (F3.6 / SOS-115).
 *
 * One store serves every caller. Reading it uses the Permissions API only.
 * `request()` is the call that may show the browser prompt, and only after
 * the pre-prompt button. The fix stays in memory and is never uploaded.
 */
export function useLocation() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void ensureStarted();
  }, []);

  const position = snap.fix;

  const request = useCallback(() => requestFix(), []);

  const distanceTo = useCallback(
    (lat: number, lng: number): number | null =>
      distanceToBuildingMeters(position, { latitude: lat, longitude: lng }),
    [position],
  );

  const nearestBuilding = useCallback(
    <T extends GeoPoint | BuildingLatLng>(buildings: readonly T[]): T | null =>
      findNearestBuilding(position, buildings),
    [position],
  );

  const insideBuilding = useCallback(
    (building: ((GeoPoint | BuildingLatLng) & { footprint?: unknown }) | null | undefined): boolean =>
      isInsideBuilding(position, building),
    [position],
  );

  return { permission: snap.permission, request, position, distanceTo, nearestBuilding, insideBuilding };
}
