"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  distanceToBuildingMeters,
  findNearestBuilding,
  getLocationPermissionState,
  isInsideBuilding,
  requestOneShotPosition,
  toHookPermission,
  type BuildingLatLng,
  type Coordinates,
  type GeoPoint,
  type HookLocationPermission,
  type OneShotPositionResult,
} from "./index";

// One fix for every caller. The map's locate button and `request()` both write it,
// so Open now re-sorts whichever one obtained the position. Nothing here asks
// for a fix on its own.
let sharedPosition: Coordinates | null = null;
const positionListeners = new Set<() => void>();

function subscribePosition(listener: () => void) {
  positionListeners.add(listener);
  return () => positionListeners.delete(listener);
}

function readPosition() {
  return sharedPosition;
}

function serverPosition() {
  return null;
}

export function rememberPosition(next: Coordinates | null) {
  if (sharedPosition?.latitude === next?.latitude && sharedPosition?.longitude === next?.longitude) return;
  sharedPosition = next;
  for (const listener of positionListeners) listener();
}

/**
 * Location permission for check-in (F3.6 / SOS-115).
 *
 * Reading `permission` on mount uses the Permissions API only. `request()`
 * is the one call that may show the browser prompt, and only after the
 * pre-prompt button. The fix stays in memory and is never uploaded.
 */
export function useLocation() {
  const [permission, setPermission] = useState<HookLocationPermission>("unknown");
  const position = useSyncExternalStore(subscribePosition, readPosition, serverPosition);

  useEffect(() => {
    let cancelled = false;
    void getLocationPermissionState().then((status) => {
      if (!cancelled) setPermission(toHookPermission(status));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async (): Promise<OneShotPositionResult> => {
    const result = await requestOneShotPosition();
    setPermission(toHookPermission(result.status));
    if (result.coords) rememberPosition(result.coords);
    return result;
  }, []);

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
    (building: GeoPoint | BuildingLatLng | null | undefined): boolean => isInsideBuilding(position, building),
    [position],
  );

  return { permission, request, position, distanceTo, nearestBuilding, insideBuilding };
}
