import { SpaceTags } from "@/components/ui/space-tags";
import { buildingShortName, spaceLocation, spaceShortName, spaceTags } from "./labels";
import { PlaceName } from "./place-name";
import type { SpaceSummary } from "./types";
import { Button } from "@/components/ui/button";

export type SpaceListDensity = "compact" | "comfortable";

// One study space as a row: name, where it is and its conditions. The whole
// row is a button. `compact` (the map's dock) drops the summary and shows
// fewer tags; `comfortable` (phone search, the list page) shows everything.
export function SpaceListItem({
  space,
  density = "comfortable",
  selected = false,
  showBuilding = true,
  onSelect,
}: {
  space: SpaceSummary;
  density?: SpaceListDensity;
  selected?: boolean;
  // Off when the list is already one building's spaces.
  showBuilding?: boolean;
  onSelect: (space: SpaceSummary) => void;
}) {
  const compact = density === "compact";
  // The building leads the name, so the line under it is only the floor.
  const location = spaceLocation(space, { building: false });
  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(space)}
      aria-current={selected ? "true" : undefined}
      className={`flex min-h-0 w-full flex-col items-stretch justify-start gap-1.5 rounded-lg px-3 text-left font-normal aria-[current]:bg-primary/10 ${
        compact ? "py-2.5" : "py-3"
      }`}
    >
      <span className="flex flex-col">
        <PlaceName
          building={showBuilding ? buildingShortName(space.building) : null}
          place={spaceShortName(space)}
          className="text-sm tracking-tight"
        />
        {location ? <span className="text-xs text-muted-foreground">{location}</span> : null}
      </span>
      {!compact && space.summary ? (
        <span className="line-clamp-2 text-sm text-muted-foreground">{space.summary}</span>
      ) : null}
      <SpaceTags tags={spaceTags(space, compact ? 2 : 4)} />
    </Button>
  );
}
