"use client";

import { SpaceList, type SpaceListDensity, type SpaceSummary } from "@/features/spaces";
import { useMapState } from "../map-state";

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
  return (
    <div className="flex flex-col gap-1">
      {data.loaded && !data.error ? (
        <p aria-live="polite" className="px-3 pb-1 text-xs text-muted-foreground">
          {search.query.trim()
            ? `${count} ${count === 1 ? "match" : "matches"}`
            : `${count} study ${count === 1 ? "space" : "spaces"}`}
        </p>
      ) : null}
      <SpaceList
        spaces={search.results}
        label={search.query.trim() ? "Search results" : "Study spaces"}
        density={density}
        loading={!data.loaded}
        empty={data.error ? `${data.error} Study spaces can’t be listed.` : "No study spaces match your search."}
        onSelect={(space: SpaceSummary) => {
          select({ kind: "space", slug: space.slug });
          onPicked?.();
        }}
      />
    </div>
  );
}
