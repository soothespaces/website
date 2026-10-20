"use client";

import { Button } from "@/components/ui/button";
import { buildingAt } from "./arrival";
import { useArrivalBuildings } from "./buildings";
import { useCheckIn } from "./check-in-context";
import { useGrantedPosition } from "./live-position";

// Shown in the building panel header while the user is inside that building.
export function CheckInHereButton({ buildingSlug, buildingName }: { buildingSlug: string; buildingName: string }) {
  const fix = useGrantedPosition();
  const buildings = useArrivalBuildings();
  const checkIn = useCheckIn();
  const inside =
    fix != null &&
    buildingAt({ latitude: fix.latitude, longitude: fix.longitude }, buildings)?.slug === buildingSlug;
  if (!inside || !checkIn) return null;
  return (
    <Button
      size="sm"
      className="shrink-0"
      onClick={() =>
        checkIn.openCheckIn({
          arrivalBuildingSlug: buildingSlug,
          arrivalBuildingName: buildingName,
        })
      }
    >
      Check in here
    </Button>
  );
}
