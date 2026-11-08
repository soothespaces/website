"use client";

import { SpaceList, type SpaceListDensity, type SpaceSummary } from "@/features/spaces";
import { ErrorNote } from "@/components/ui/error-note";
import { Button } from "@/components/ui/button";
import { useMapState } from "../map-state";
import { matchBuildings } from "./building-matches";

// The search results: every listed study space, or the ones matching the
// query. Picking one selects it on the map.
export function ResultsPanel({
  density,
  onPicked,
}: {
  density: SpaceListDensity;
  // After a space is picked, e.g. to close the phone search screen.
  onPicked?: () => void;
}) {
  const { data, search, select } = useMapState();
  const count = search.results.length;
  const buildings = data.loaded ? matchBuildings(search.query, data.buildingsBySlug.values()) : [];
  if (data.loaded && data.error) {
    return <ErrorNote message="Study spaces failed to load." onRetry={data.reload} className="px-3 py-2" />;
  }
  return (
    <div className="flex flex-col gap-1">
      {data.loaded && !data.error ? (
        <p aria-live="polite" className="px-3 pb-1 text-xs text-muted-foreground">
          {search.query.trim()
            ? `${count} ${count === 1 ? "match" : "matches"}`
            : `${count} study ${count === 1 ? "space" : "spaces"}`}
        </p>
      ) : null}
      {buildings.length > 0 ? (
        <section aria-labelledby="building-matches" className="flex flex-col gap-1 pb-2">
          <h2 id="building-matches" className="px-3 text-xs font-medium tracking-wide text-muted-foreground">
            Buildings
          </h2>
          <ul className="flex flex-col">
            {buildings.map((building) => (
              <li key={building.slug}>
                <Button
                  variant="ghost"
                  className="h-auto min-h-11 w-full justify-start px-3 py-2 text-left font-normal"
                  onClick={() => {
                    select({
                      kind: "building",
                      slug: building.slug,
                      recordNumber: building.recordNumber,
                      name: building.name,
                    });
                    onPicked?.();
                  }}
                >
                  {building.shortName ?? building.name}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <SpaceList
        spaces={search.results}
        label={search.query.trim() ? "Search results" : "Study spaces"}
        density={density}
        loading={!data.loaded}
        empty="No study spaces match your search."
        onSelect={(space: SpaceSummary) => {
          select({ kind: "space", slug: space.slug });
          onPicked?.();
        }}
      />
    </div>
  );
}
