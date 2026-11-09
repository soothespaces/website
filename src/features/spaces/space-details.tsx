import { SpaceTags } from "@/components/ui/space-tags";
import { buildingShortName, spaceLocation, spaceShortName, spaceTags } from "./labels";
import { PlaceName } from "./place-name";
import type { SpaceSummary } from "./types";

// Everything we know about one study space, for a side panel or a page.
// The heading level is the caller's, so it fits under whatever is above it.
export function SpaceDetails({
  space,
  headingLevel: Heading = "h2",
}: {
  space: SpaceSummary;
  headingLevel?: "h1" | "h2" | "h3";
}) {
  const location = spaceLocation(space, { building: false });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Heading className="text-lg">
          <PlaceName building={buildingShortName(space.building)} place={spaceShortName(space)} />
        </Heading>
        {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
      </div>
      <SpaceTags tags={spaceTags(space, Infinity)} />
      {space.summary ? <p className="text-sm">{space.summary}</p> : null}
    </div>
  );
}
