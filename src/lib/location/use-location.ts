"use client";

import { useCallback, useEffect, useState } from "react";
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

/**
 * Location permission for check-in (F3.6 / SOS-115).
 *
 * Reading `permission` on mount uses the Permissions API only. `request()`
 * is the one call that may show the browser prompt, and only after the
 * pre-prompt button. The fix stays in component state and is never uploaded.
 */
export function useLocation() {
  const [permission, setPermission] = useState<HookLocationPermission>("unknown");
  const [position, setPosition] = useState<Coordinates | null>(null);

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
    if (result.coords) setPosition(result.coords);
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
