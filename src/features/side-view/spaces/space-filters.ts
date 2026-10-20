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

function matches(space: FilterableSpace, filters: readonly SpaceFilter[], context: SpaceFilterContext): boolean {
  for (const filter of filters) {
    if (filter === "quiet" && space.noise_level !== "quiet" && space.noise_level !== "low_noise") return false;
    if (filter === "dim" && space.light_level !== "dim") return false;
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
