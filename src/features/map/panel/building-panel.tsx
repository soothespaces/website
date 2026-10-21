"use client";

import { useMemo } from "react";
import { CheckInHereButton } from "@/features/check-in/check-in-here";
import { SpaceList, type SpaceListDensity } from "@/features/spaces";
import { type MapSelection, useMapState } from "../map-state";
import { FloorSwitcher } from "./floor-switcher";

type BuildingSelection = Extract<MapSelection, { kind: "building" }>;

// A building: its accessible entrances, floor plans and study spaces.
export function BuildingPanel({ building, density }: { building: BuildingSelection; density: SpaceListDensity }) {
  const { data, select, floorPlans, floor, setFloor } = useMapState();

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
      <div className="flex items-start justify-between gap-3 px-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg">{building.name}</h2>
          {doors && data.entrances.length ? (
            <p className="text-sm text-muted-foreground">
              {doors.accessible
                ? `${doors.accessible} accessible ${doors.accessible === 1 ? "entrance" : "entrances"}, ${doors.automatic} automatic`
                : "No accessible entrances on record"}
            </p>
          ) : null}
        </div>
        {building.slug ? <CheckInHereButton buildingSlug={building.slug} buildingName={building.name} /> : null}
      </div>
      {floors?.length ? (
        <div className="px-3">
          <FloorSwitcher floors={floors} floor={floor} onChange={setFloor} />
        </div>
      ) : null}
      {spaces.length ? (
        <section aria-labelledby="building-spaces" className="flex flex-col gap-1">
          <h3 id="building-spaces" className="px-3 text-sm font-medium">
            Study spaces
          </h3>
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
