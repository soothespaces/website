import type { ReactNode } from "react";
import { SpaceListItem, type SpaceListDensity } from "./space-list-item";
import type { SpaceSummary } from "./types";

// A list of study spaces, with loading and empty states. Rendering only:
// the caller owns searching, filtering and what selecting a space does.
export function SpaceList({
  spaces,
  label,
  density = "comfortable",
  selectedSlug = null,
  showBuilding = true,
  loading = false,
  empty = "No study spaces match.",
  onSelect,
}: {
  spaces: SpaceSummary[];
  // The list's accessible name ("Search results", "Study spaces in …").
  label: string;
  density?: SpaceListDensity;
  selectedSlug?: string | null;
  showBuilding?: boolean;
  loading?: boolean;
  empty?: ReactNode;
  onSelect: (space: SpaceSummary) => void;
}) {
  if (loading) {
    return (
      <p role="status" className="px-3 py-6 text-sm text-muted-foreground">
        Loading study spaces…
      </p>
    );
  }
  if (!spaces.length) {
    return (
      <p role="status" className="px-3 py-6 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul aria-label={label} className="flex flex-col gap-0.5">
      {spaces.map((space) => (
        <li key={space.slug}>
          <SpaceListItem
            space={space}
            density={density}
            selected={space.slug === selectedSlug}
            showBuilding={showBuilding}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
