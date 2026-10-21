"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DetailScreen } from "@/components/ui/detail-screen";
import { Skeleton } from "@/components/ui/feedback";
import { printersOnFloor, usePrinters } from "@/lib/data/printers";
import { useCheckInOverview } from "@/lib/data/check-ins";
import { useMapState } from "@/features/map/map-state";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import type { PanelScreenProps } from "../builtin-screens";
import type { ListedSpace } from "./listed-space";
import { SpaceFilterChips } from "./space-filter-chips";
import { filterSpaces } from "./space-filters";
import { hasStudyPreferences, spacesSortCaption, spacesTitle, withFloorNotes } from "./space-floors";
import { SpaceRow } from "./space-row";
import { useBuildingSpaces } from "./use-building-spaces";
import { useRankedSpaces } from "./use-ranked-spaces";
import { useSpaceFilters } from "./use-space-filters";

export function SpacesScreen({ route }: PanelScreenProps) {
  if (route.kind !== "spaces") return null;
  return <SpacesList slug={route.slug} />;
}

function SpacesList({ slug }: { slug: string }) {
  const { back, push, data, groupSize } = useMapState();
  const catalog = useBuildingSpaces(slug);
  const printers = usePrinters(slug);
  const overview = useCheckInOverview("space");
  const { study } = useStudyPreferences();
  const [filters, setFilters] = useSpaceFilters();

  const printerFloors = useMemo(() => {
    // An error leaves printers empty. Treat that as unknown, not as "no printers",
    // or Printer nearby would hide every space and show no error.
    if (!printers.loaded || printers.error) return null;
    const floors = new Set<number>();
    for (const printer of printers.printers) {
      if (printer.floor != null) floors.add(printer.floor);
    }
    return floors;
  }, [printers.loaded, printers.error, printers.printers]);

  const entrances = useMemo(
    () => data.entrances.filter((entrance) => entrance.building_slug === slug),
    [data.entrances, slug],
  );

  const matched = useMemo(
    () => filterSpaces(catalog.spaces, filters, { printerFloors }),
    [catalog.spaces, filters, printerFloors],
  );
  const ranked = useRankedSpaces(matched);
  const groups = useMemo(
    () =>
      withFloorNotes(ranked, {
        bookableByFloor: catalog.bookableByFloor,
        entrances,
        overview: overview.byId,
      }),
    [ranked, catalog.bookableByFloor, entrances, overview.byId],
  );

  const buildingName =
    catalog.spaces.find((space) => space.building?.short_name)?.building?.short_name ||
    catalog.spaces[0]?.building?.name ||
    data.buildingsBySlug.get(slug)?.name ||
    "Building";
  const sortCaption = spacesSortCaption(study, groupSize);
  const canChangeSort = hasStudyPreferences(study);
  const openSpace = (space: ListedSpace) => push({ kind: "space", id: space.slug });

  let body = null;
  if (!catalog.loaded) {
    body = (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Loading study spaces</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  } else if (catalog.error) {
    body = <p className="text-sm text-muted-foreground">{catalog.error}</p>;
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {sortCaption ? (
          <p className="text-sm text-muted-foreground">
            {sortCaption}
            {canChangeSort ? (
              <>
                {" "}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => push({ kind: "preferences" })}
                  aria-label="Change study preferences"
                  className="h-auto min-h-0 px-0 py-0 text-sm font-medium text-primary underline underline-offset-2 hover:bg-transparent"
                >
                  Change
                </Button>
              </>
            ) : null}
          </p>
        ) : null}
        <SpaceFilterChips value={filters} onValueChange={setFilters} />
        {filters.includes("printer") && printers.error ? (
          <p className="text-sm text-muted-foreground">{printers.error}</p>
        ) : null}
        {catalog.spaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No study spaces listed yet.</p>
        ) : groups.length === 0 ? (
          <p className="text-sm">
            No spaces match.{" "}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters([])}
              className="h-auto min-h-0 px-0 py-0 text-sm font-medium text-primary underline underline-offset-2 hover:bg-transparent"
            >
              Clear filters
            </Button>
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`spaces-${group.key}`} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1">
                  <h2 id={`spaces-${group.key}`} className="min-w-0 text-sm font-semibold break-words">
                    {group.title}
                  </h2>
                  {group.note ? <p className="shrink-0 text-right text-sm text-muted-foreground">{group.note}</p> : null}
                </div>
                <ul className="flex flex-col">
                  {group.spaces.map((space) => (
                    <li key={space.id}>
                      <SpaceRow
                        space={space}
                        printerOnFloor={space.floor != null && printersOnFloor(printers.printers, space.floor).length > 0}
                        onOpen={openSpace}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <DetailScreen
      title={catalog.loaded && !catalog.error ? spacesTitle(catalog.spaces.length) : "Study spaces"}
      subtitle={buildingName}
      backTo={buildingName}
      onBack={back}
      className="h-auto min-h-0 flex-auto"
    >
      {body}
    </DetailScreen>
  );
}
