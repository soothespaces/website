import { resolveAttributes } from "@/lib/data/attributes";
import type { Database } from "@/types/supabase";

type LightLevel = Database["public"]["Enums"]["light_level"];
type SpaceSource = Database["public"]["Enums"]["space_source"];

// Explicit filters for the Spaces screen. Unlike study preferences, a selected
// chip hides spaces that do not match. Restroom stays off until point
// amenities exist (BK1); the chip is disabled in the UI.

export const SPACE_FILTERS = ["quiet", "dim", "computers", "printer", "restroom"] as const;

export type SpaceFilter = (typeof SPACE_FILTERS)[number];

export const SPACE_FILTER_PARAM = "f";

const FILTER_SET: ReadonlySet<string> = new Set(SPACE_FILTERS);

export type FilterableSpace = {
  noise_level?: string | null;
  light_level?: string | null;
  features?: readonly string[] | null;
  floor?: number | null;
  /** Listing source. Dim uses the attribute resolver when this is set. */
  source?: SpaceSource | null;
  edited_fields?: readonly string[] | null;
};

export type SpaceFilterContext = {
  /** Floors that have a printer. Null while that list is still loading. */
  printerFloors?: ReadonlySet<number> | null;
  /** Floors that have a restroom point. Omit until those points exist. */
  restroomFloors?: ReadonlySet<number> | null;
};

/** Canonical order, unknown tokens dropped. `quiet,printer` round-trips. */
export function parseSpaceFilters(value: string | null | undefined): SpaceFilter[] {
  if (!value) return [];
  const present = new Set<string>();
  for (const part of value.split(",")) {
    const key = part.trim().toLowerCase();
    if (FILTER_SET.has(key)) present.add(key);
  }
  return SPACE_FILTERS.filter((filter) => present.has(filter));
}

/** Chip values the user can actually toggle. Restroom is parsed but not written. */
export function selectableFilters(filters: readonly SpaceFilter[]): SpaceFilter[] {
  return filters.filter((filter) => filter !== "restroom");
}

export function serializeSpaceFilters(filters: readonly SpaceFilter[]): string | null {
  const value = selectableFilters(parseSpaceFilters(filters.join(","))).join(",");
  return value || null;
}

export function searchWithSpaceFilters(search: string, filters: readonly SpaceFilter[]): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = serializeSpaceFilters(filters);
  if (!value) params.delete(SPACE_FILTER_PARAM);
  else params.set(SPACE_FILTER_PARAM, value);
  return params.toString();
}

function hasComputer(space: FilterableSpace): boolean {
  const features = space.features ?? [];
  return features.includes("computers") || features.includes("external_monitors");
}

const LIGHT_LEVELS = new Set<string>(["dim", "moderate", "bright"]);

// Same brightness the Home chips use: an edit wins, otherwise the listing.
function isDim(space: FilterableSpace): boolean {
  const light = space.light_level && LIGHT_LEVELS.has(space.light_level) ? (space.light_level as LightLevel) : null;
  if (!space.source) return light === "dim";
  const resolved = resolveAttributes(
    {
      noiseLevel: null,
      lightLevel: light,
      features: [],
      capacity: null,
      source: space.source,
      editedFields: space.edited_fields ?? [],
    },
    null,
  );
  return resolved.brightness?.value === "Dim";
}

function matches(space: FilterableSpace, filters: readonly SpaceFilter[], context: SpaceFilterContext): boolean {
  for (const filter of filters) {
    if (filter === "quiet" && space.noise_level !== "quiet" && space.noise_level !== "low_noise") return false;
    if (filter === "dim" && !isDim(space)) return false;
    if (filter === "computers" && !hasComputer(space)) return false;
    if (filter === "printer") {
      // Still loading: don't blank the list. An empty set means no printers.
      if (context.printerFloors == null) continue;
      if (space.floor == null || !context.printerFloors.has(space.floor)) return false;
    }
    if (filter === "restroom") {
      if (context.restroomFloors == null) continue;
      if (space.floor == null || !context.restroomFloors.has(space.floor)) return false;
    }
  }
  return true;
}

/** Selected chips narrow the list. Every chip has to match. An empty selection keeps every space. */
export function filterSpaces<T extends FilterableSpace>(
  spaces: readonly T[],
  filters: readonly SpaceFilter[],
  context: SpaceFilterContext = {},
): T[] {
  const active = filters.filter((filter) => filter !== "restroom" || context.restroomFloors != null);
  if (active.length === 0) return [...spaces];
  return spaces.filter((space) => matches(space, active, context));
}
