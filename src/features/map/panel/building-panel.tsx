"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SpaceList, type SpaceListDensity } from "@/features/spaces";
import { type MapSelection, useMapState } from "../map-state";
import { FloorSwitcher } from "./floor-switcher";

type BuildingSelection = Extract<MapSelection, { kind: "building" }>;

// A building: its accessible entrances, floor plans and study spaces.
export function BuildingPanel({ building, density }: { building: BuildingSelection; density: SpaceListDensity }) {
  const { data, select, floorPlans, floor, setFloor, push } = useMapState();

  const doors = useMemo(() => {
    if (!building.recordNumber) return null;
    const mine = data.entrances.filter((e) => e.building_record_number === building.recordNumber);
    return { accessible: mine.length, automatic: mine.filter((e) => e.automatic).length };
  }, [data.entrances, building.recordNumber]);
  const spaces = useMemo(
    () => (building.slug ? data.spaces.filter((s) => s.building?.slug === building.slug) : []),
    [data.spaces, building.slug],
  );
  const floors = building.slug ? floorPlans.get(building.slug) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 px-3">
        <h2 className="text-lg">{building.name}</h2>
        {doors && data.entrances.length ? (
          <p className="text-sm text-muted-foreground">
            {doors.accessible
              ? `${doors.accessible} accessible ${doors.accessible === 1 ? "entrance" : "entrances"}, ${doors.automatic} automatic`
              : "No accessible entrances on record"}
          </p>
        ) : null}
      </div>
      {floors?.length ? (
        <div className="px-3">
          <FloorSwitcher floors={floors} floor={floor} onChange={setFloor} />
        </div>
      ) : null}
      {spaces.length ? (
        <section aria-labelledby="building-spaces" className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 px-3">
            <h3 id="building-spaces" className="text-sm font-medium">
              Study spaces
            </h3>
            {building.slug && spaces.length ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (building.slug) push({ kind: "spaces", slug: building.slug });
                }}
                className="h-auto min-h-0 px-0 py-0 text-sm font-medium text-primary underline underline-offset-2 hover:bg-transparent"
              >
                {`See all ${spaces.length}`}
              </Button>
            ) : null}
          </div>
          <SpaceList
            spaces={spaces}
            label={`Study spaces in ${building.name}`}
            density={density}
            showBuilding={false}
            onSelect={(space) => select({ kind: "space", slug: space.slug })}
          />
        </section>
      ) : null}
    </div>
  );
}
