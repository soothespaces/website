"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { NoiseBadge, type NoiseLevel } from "@/components/ui/noise-badge";
import { PanelBackButton } from "@/components/ui/panel-back-button";
import { useMapState } from "@/features/map/map-state";
import { useFavorites } from "@/lib/data/favorites";
import { openStatus, useOpeningHours } from "@/lib/data/opening-hours";
import { useLocation } from "@/lib/location/use-location";
import { buildingDisplayName, spaceOpenStatus, walkPoint, walkTimeLabel } from "./format";

export type SpaceHeaderBuilding = {
  slug: string;
  name: string;
  shortName: string | null;
  lat: number | null;
  lng: number | null;
};

// Back, heart, building, name, and the noise · hours · walk line.
export function SpaceHeader({
  titleId,
  name,
  spaceId,
  noiseLevel,
  lat,
  lng,
  building,
  hoursTarget,
  backLabel,
  onBack,
}: {
  titleId: string;
  name: string;
  spaceId: string | null;
  noiseLevel: NoiseLevel | null;
  lat: number | null;
  lng: number | null;
  building: SpaceHeaderBuilding | null;
  /** Null until we know whether this space has hours of its own. */
  hoursTarget: { buildingSlug: string | null; spaceId: string | null } | null;
  backLabel: string;
  onBack: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { data, push } = useMapState();
  const favorites = useFavorites();
  const hours = useOpeningHours(hoursTarget);
  const location = useLocation();

  useEffect(() => {
    titleRef.current?.focus({ focusVisible: true });
  }, [name]);

  const status = spaceOpenStatus(hours.loaded ? openStatus(hours.hours, new Date()) : null);
  const point = walkPoint({ lat, lng }, building);
  const walk = walkTimeLabel(point ? location.distanceTo(point.lat, point.lng) : null);
  const buildingLabel = buildingDisplayName(building);
  const showHeart = favorites.signedIn ? spaceId != null : favorites.loaded;
  const pressed = spaceId != null && favorites.isFavorite({ kind: "space", spaceId });

  const meta: { key: string; node: ReactNode }[] = [];
  if (noiseLevel) meta.push({ key: "noise", node: <NoiseBadge level={noiseLevel} size="sm" /> });
  if (status) meta.push({ key: "hours", node: <span>{status}</span> });
  if (walk) meta.push({ key: "walk", node: <span>{walk}</span> });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="-ml-2">
          <PanelBackButton label={backLabel} onClick={onBack} icon={<ChevronLeftIcon />} />
        </div>
        {showHeart ? (
          <div className="-mr-2">
            <FavoriteButton
              name={name}
              pressed={pressed}
              signedIn={favorites.signedIn}
              onPressedChange={(next) => {
                if (!spaceId) return;
                const target = { kind: "space" as const, spaceId };
                void (next ? favorites.add(target) : favorites.remove(target));
              }}
            />
          </div>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        {building && buildingLabel ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const known = data.buildingsBySlug.get(building.slug);
              push({
                kind: "building",
                slug: building.slug,
                recordNumber: known?.recordNumber ?? null,
                name: known?.name ?? building.name,
              });
            }}
            className="h-auto min-h-0 justify-start px-0 py-0 text-left text-sm font-medium whitespace-normal text-primary hover:bg-transparent hover:underline"
          >
            {buildingLabel}
          </Button>
        ) : null}
        <h1 id={titleId} ref={titleRef} tabIndex={-1} className="text-2xl break-words">
          {name}
        </h1>
        {meta.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {meta.map((item, index) => (
              <li key={item.key} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-muted-foreground">
                    ·
                  </span>
                ) : null}
                {item.node}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
