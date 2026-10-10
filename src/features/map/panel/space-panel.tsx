"use client";

import { ChevronRightIcon } from "@/components/ui/icons";
import { SpaceDetails } from "@/features/spaces";
import { useMapState } from "../map-state";
import { FloorSwitcher } from "./floor-switcher";

// One study space, with a way to its building and its building's floors.
export function SpacePanel({ slug }: { slug: string }) {
  const { data, select, floorPlans, floor, setFloor } = useMapState();
  const space = data.spaces.find((s) => s.slug === slug);
  if (!space) {
    return <p className="px-3 text-sm text-muted-foreground">{data.loaded ? "This space isn’t listed." : "Loading…"}</p>;
  }
  const building = space.building;
  const floors = building ? floorPlans.get(building.slug) : undefined;
  return (
    <div className="flex flex-col gap-4 px-3">
      <SpaceDetails space={space} />
      {floors?.length ? <FloorSwitcher floors={floors} floor={floor} onChange={setFloor} /> : null}
      {building ? (
        <button
          type="button"
          onClick={() =>
            select({
              kind: "building",
              slug: building.slug,
              recordNumber: data.buildingsBySlug.get(building.slug)?.recordNumber ?? null,
              name: building.name,
            })
          }
          className="-mx-3 flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-accent"
        >
          <span>
            <span className="text-muted-foreground">In </span>
            <span className="font-medium">{building.name}</span>
          </span>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </button>
      ) : null}
    </div>
  );
}
