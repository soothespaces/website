import { resolveAttributes } from "@/lib/data/attributes";
import {
  isOpenNow,
  openStatus,
  resolveOpeningHours,
  type OpeningHourRow,
  type OpeningHours,
} from "@/lib/data/opening-hours";
import { distanceToBuildingMeters, type GeoPoint } from "@/lib/location";
import { rankSpaces, supportsGroupSize, toRankableSpace, type GroupSize } from "@/lib/ranking";
import { detroitParts } from "@/lib/detroit";
import { hasStudyPreferences, type StudyPreferences } from "@/lib/settings/model";

export { hasStudyPreferences };
import type { SpaceSummary } from "@/features/spaces";
import { EMPTY_SPACE_FILTERS, type SpaceFilters } from "@/features/map/space-filters";

/** A listed space plus the facts Home sorts and filters on. */
export type HomeSpace = SpaceSummary & {
  open: boolean;
  /** "Open 24 hours", "Open until 11 PM", or null when hours are unknown. */
  openLabel: string | null;
  openLate: boolean;
  bookable: boolean;
  dim: boolean;
};

export type RecommendedPick = {
  space: HomeSpace;
  /** Null when the user has no study preferences, so the line stays hidden. */
  matchesLine: string | null;
};

export type HourIndex = {
  bySpace: Map<string, OpeningHourRow[]>;
  byBuilding: Map<string, OpeningHourRow[]>;
};

const ELEVEN_PM = 23 * 60;
/** About 3 mph, so a few blocks reads as a few minutes. */
const METERS_PER_WALK_MINUTE = 80;

const NOISE_RANK: Record<NonNullable<SpaceSummary["noise_level"]>, number> = {
  quiet: 0,
  low_noise: 1,
  conversational: 2,
  loud: 3,
};

export function selectedGroupSize(groupSize: GroupSize | null): GroupSize {
  return groupSize ?? "just_me";
}

export function browseAllLabel(count: number | null): string {
  if (count == null) return "Browse all study spaces";
  const noun = count === 1 ? "space" : "spaces";
  return `Browse all ${count} study ${noun}`;
}

export function buildingLabel(building: SpaceSummary["building"]): string | null {
  if (!building) return null;
  const short = building.short_name?.trim();
  return short || building.name;
}

export function placeMeta(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export function walkLabel(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  const minutes = Math.max(1, Math.round(meters / METERS_PER_WALK_MINUTE));
  return `${minutes} min walk`;
}

/** Meters from the walker to the space pin, or its building when the space has none. */
export function spaceMeters(space: SpaceSummary, origin: GeoPoint | null): number | null {
  if (!origin) return null;
  const own = space.lat != null && space.lng != null;
  const point = own ? { lat: space.lat, lng: space.lng } : space.building;
  return distanceToBuildingMeters(origin, point);
}

export function indexHours(rows: readonly OpeningHourRow[]): HourIndex {
  const bySpace = new Map<string, OpeningHourRow[]>();
  const byBuilding = new Map<string, OpeningHourRow[]>();
  for (const row of rows) {
    if (row.spaceId) {
      const list = bySpace.get(row.spaceId) ?? [];
      list.push(row);
      bySpace.set(row.spaceId, list);
    } else if (row.buildingSlug) {
      const list = byBuilding.get(row.buildingSlug) ?? [];
      list.push(row);
      byBuilding.set(row.buildingSlug, list);
    }
  }
  return { bySpace, byBuilding };
}

export function hoursForSpace(space: SpaceSummary, index: HourIndex, now: Date): OpeningHours | null {
  const buildingRows = space.building?.slug ? (index.byBuilding.get(space.building.slug) ?? []) : [];
  const spaceRows = space.id ? (index.bySpace.get(space.id) ?? []) : [];
  const rows = [...buildingRows, ...spaceRows];
  if (!rows.length) return null;
  return resolveOpeningHours(rows, detroitParts(now).date);
}

/** Open at 11 PM tonight or later, including overnight and 24-hour days. */
export function isOpenLateTonight(hours: OpeningHours | null, now: Date): boolean {
  if (!hours) return false;
  const today = detroitParts(now).date;
  const day = hours.byDate.find((entry) => entry.date === today);
  if (!day) return false;
  return day.intervals.some((interval) => interval.opens < 1440 && interval.closes >= ELEVEN_PM);
}

export function isDimLighting(space: SpaceSummary): boolean {
  if (!space.source) return space.light_level === "dim";
  const resolved = resolveAttributes(
    {
      noiseLevel: space.noise_level,
      lightLevel: space.light_level ?? null,
      features: space.features,
      capacity: space.capacity ?? null,
      source: space.source,
      editedFields: space.edited_fields ?? [],
    },
    null,
  );
  return resolved.brightness?.value === "Dim";
}

export function spaceIsBookable(
  space: SpaceSummary,
  bookableSpaceIds: ReadonlySet<string>,
  bookableBuildings: ReadonlySet<string>,
): boolean {
  if (space.id && bookableSpaceIds.has(space.id)) return true;
  if (space.building?.slug && bookableBuildings.has(space.building.slug)) return true;
  return false;
}

export function describeSpace(
  space: SpaceSummary,
  hours: OpeningHours | null,
  bookable: boolean,
  now: Date,
): HomeSpace {
  return {
    ...space,
    open: isOpenNow(hours, now),
    openLabel: openStatus(hours, now),
    openLate: isOpenLateTonight(hours, now),
    bookable,
    dim: isDimLighting(space),
  };
}

export function matchesFilters(space: HomeSpace, filters: SpaceFilters): boolean {
  if (filters.quiet && space.noise_level !== "quiet" && space.noise_level !== "low_noise") return false;
  if (filters.openLate && !space.openLate) return false;
  if (filters.dimLighting && !space.dim) return false;
  if (filters.bookable && !space.bookable) return false;
  return true;
}

function fitsGroup(space: HomeSpace, groupSize: GroupSize): boolean {
  return supportsGroupSize(toRankableSpace({ ...space, bookable: space.bookable }), groupSize);
}

function noiseRank(level: SpaceSummary["noise_level"]): number {
  if (!level) return 4;
  return NOISE_RANK[level];
}

function compareDistance(a: HomeSpace, b: HomeSpace, origin: GeoPoint | null): number {
  if (!origin) return 0;
  const left = spaceMeters(a, origin) ?? Number.POSITIVE_INFINITY;
  const right = spaceMeters(b, origin) ?? Number.POSITIVE_INFINITY;
  return left - right;
}

/**
 * No study preferences: open now, then a group-size fit, then distance, then
 * typical quiet. Group size reorders; it does not drop a space.
 */
function compareFallback(a: HomeSpace, b: HomeSpace, groupSize: GroupSize | null, origin: GeoPoint | null): number {
  if (a.open !== b.open) return a.open ? -1 : 1;
  if (groupSize) {
    const fitA = fitsGroup(a, groupSize);
    const fitB = fitsGroup(b, groupSize);
    if (fitA !== fitB) return fitA ? -1 : 1;
  }
  const distance = compareDistance(a, b, origin);
  if (distance !== 0) return distance;
  const noise = noiseRank(a.noise_level) - noiseRank(b.noise_level);
  if (noise !== 0) return noise;
  return a.name.localeCompare(b.name);
}

export function orderRecommended(
  spaces: readonly HomeSpace[],
  options: {
    study: StudyPreferences;
    /** Null until the visitor picks a size. The default chip is not a ranking choice. */
    groupSize: GroupSize | null;
    origin: GeoPoint | null;
    filters?: SpaceFilters;
  },
): RecommendedPick[] {
  const filters = options.filters ?? EMPTY_SPACE_FILTERS;
  if (!hasStudyPreferences(options.study)) {
    return [...spaces]
      .sort((a, b) => compareFallback(a, b, options.groupSize, options.origin))
      .map((space) => ({ space, matchesLine: null }));
  }
  const ranked = rankSpaces(
    spaces.map((space) => ({
      ...space,
      isOpenNow: space.open,
      isOpenLate: space.openLate,
      bookable: space.bookable,
    })),
    {
      preferences: options.study,
      groupSize: options.groupSize ?? undefined,
      origin: options.origin,
      chips: {
        quiet: filters.quiet,
        openLate: filters.openLate,
        dimLighting: filters.dimLighting,
        bookable: filters.bookable,
      },
    },
  );
  return ranked.map((result) => ({
    space: result.space,
    matchesLine: result.matchesLine,
  }));
}

/** Open right now. Nearest first when there is a position, otherwise by name. */
export function orderOpenNow(spaces: readonly HomeSpace[], origin: GeoPoint | null): HomeSpace[] {
  return spaces
    .filter((space) => space.open)
    .sort((a, b) => {
      const distance = compareDistance(a, b, origin);
      if (distance !== 0) return distance;
      return a.name.localeCompare(b.name);
    });
}
