"use client";

import { ChevronRightIcon } from "@/components/ui/icons";
import { CheckInCard } from "@/features/side-view/space/check-in-card";
import { SpaceDetails } from "@/features/spaces";
import { useMapState } from "../map-state";
import { FloorSwitcher } from "./floor-switcher";
import { Button } from "@/components/ui/button";

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
      {/* G4. The space shell keeps this card under "What it's like". */}
      <CheckInCard spaceSlug={space.slug} />
      {floors?.length ? <FloorSwitcher floors={floors} floor={floor} onChange={setFloor} /> : null}
      {building ? (
        <Button
          variant="ghost"
          onClick={() =>
            select({
              kind: "building",
              slug: building.slug,
              recordNumber: data.buildingsBySlug.get(building.slug)?.recordNumber ?? null,
              name: building.name,
            })
          }
          className="-mx-3 justify-between rounded-lg px-3 text-left text-sm font-normal"
        >
          <span>
            <span className="text-muted-foreground">In </span>
            <span className="font-medium">{building.name}</span>
          </span>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </Button>
      ) : null}
    </div>
  );
}
