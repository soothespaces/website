// Home's quick chips, kept on the map so a later map filter can share them.
// A chip hides spaces. Group size and study preferences only re-sort.

export type SpaceFilters = {
  quiet: boolean;
  openLate: boolean;
  dimLighting: boolean;
  bookable: boolean;
};

export const EMPTY_SPACE_FILTERS: SpaceFilters = {
  quiet: false,
  openLate: false,
  dimLighting: false,
  bookable: false,
};

export function spaceFiltersActive(filters: SpaceFilters): boolean {
  return filters.quiet || filters.openLate || filters.dimLighting || filters.bookable;
}
