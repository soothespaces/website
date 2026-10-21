import { distanceMeters } from "@/lib/geo";

// A listed study space the check-in sheet can point at. Coordinates fall
// back to the building, which is where most spaces are pinned today.
export type CheckInSpace = {
  id: string;
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  buildingSlug: string | null;
  buildingName: string | null;
  buildingLat: number | null;
  buildingLng: number | null;
};

export function toCheckInSpace(space: {
  id: string;
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  building: { slug: string; name: string; lat: number | null; lng: number | null } | null;
}): CheckInSpace {
  return {
    id: space.id,
    slug: space.slug,
    name: space.name,
    lat: space.lat,
    lng: space.lng,
    buildingSlug: space.building?.slug ?? null,
    buildingName: space.building?.name ?? null,
    buildingLat: space.building?.lat ?? null,
    buildingLng: space.building?.lng ?? null,
  };
}

export const WHERE_LIMIT = 3;
export const ELSEWHERE = "elsewhere";

export function spacePoint(space: CheckInSpace): { lat: number; lng: number } | null {
  if (space.lat != null && space.lng != null) return { lat: space.lat, lng: space.lng };
  if (space.buildingLat != null && space.buildingLng != null) {
    return { lat: space.buildingLat, lng: space.buildingLng };
  }
  return null;
}

function distanceTo(origin: { lat: number; lng: number } | null, space: CheckInSpace): number | null {
  if (!origin) return null;
  const point = spacePoint(space);
  if (!point) return null;
  return distanceMeters(origin, point);
}

/**
 * Up to `limit` spaces, nearest first. Restricted to one building when
 * `buildingSlug` is set. `preferId` stays in the row even when it isn't
 * one of the nearest, and leads the row.
 */
export function nearestSpaces(
  spaces: readonly CheckInSpace[],
  options: {
    buildingSlug?: string | null;
    origin?: { lat: number; lng: number } | null;
    preferId?: string | null;
    limit?: number;
  } = {},
): CheckInSpace[] {
  const limit = options.limit ?? WHERE_LIMIT;
  const pool = options.buildingSlug ? spaces.filter((space) => space.buildingSlug === options.buildingSlug) : [...spaces];
  const ranked = [...pool].sort((a, b) => {
    const left = distanceTo(options.origin ?? null, a);
    const right = distanceTo(options.origin ?? null, b);
    if (left == null && right == null) return a.name.localeCompare(b.name);
    if (left == null) return 1;
    if (right == null) return -1;
    if (left !== right) return left - right;
    return a.name.localeCompare(b.name);
  });
  const top = ranked.slice(0, limit);
  // Keep nearest-first order. A chosen space that missed the cut replaces
  // the last row so it can stay selected without shuffling the others.
  if (options.preferId && !top.some((space) => space.id === options.preferId)) {
    const preferred = pool.find((space) => space.id === options.preferId) ?? spaces.find((space) => space.id === options.preferId);
    if (preferred) {
      if (top.length < limit) top.push(preferred);
      else top[top.length - 1] = preferred;
    }
  }
  return top;
}

export function searchSpaces(spaces: readonly CheckInSpace[], query: string, limit = 8): CheckInSpace[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return spaces
    .filter((space) => {
      const haystack = `${space.name} ${space.buildingName ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    })
    .slice(0, limit);
}
